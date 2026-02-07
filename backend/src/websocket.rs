use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use axum::{
    extract::{
        State,
        ws::{WebSocket, WebSocketUpgrade},
    },
    response::IntoResponse,
};
use futures_util::{SinkExt, StreamExt};
use crate::auth::verify_token;
use crate::models::{
    AppState, ClientMessage, ServerMessage, Message as ModelMessage, MessageContent, ActiveBotInfo,
};

/// 全局连接管理器
/// room_id -> Set of usernames in that room
type RoomMembers = Arc<RwLock<HashMap<String, HashSet<String>>>>;
/// username -> message sender
type Connections = Arc<RwLock<HashMap<String, mpsc::UnboundedSender<axum::extract::ws::Message>>>>;

pub async fn websocket_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: AppState) {
    println!("New WebSocket connection attempt");
    let (mut sender, mut receiver) = socket.split();
    let username = Arc::new(RwLock::new(String::new()));

    // 验证 token 并获取用户名
    {
        let first_msg = receiver.next().await;
        println!("First message received: {:?}", first_msg.is_some());
        if let Some(Ok(msg)) = first_msg {
            if let axum::extract::ws::Message::Text(text) = msg {
                println!("Token received: {}", text);
                if let Ok(token) = serde_json::from_str::<serde_json::Value>(&text) {
                    if let Some(token_str) = token.get("token").and_then(|t| t.as_str()) {
                        println!("Attempting to verify token...");
                        if let Ok(claims) = verify_token(token_str) {
                            *username.write().await = claims.sub.clone();
                            println!("User '{}' authenticated successfully", claims.sub);

                            // 发送认证成功
                            let _ = sender
                                .send(axum::extract::ws::Message::Text(
                                    serde_json::to_string(&ServerMessage::UserJoined {
                                        room_id: String::new(),
                                        username: claims.sub.clone(),
                                    })
                                    .unwrap_or_default()
                                ))
                                .await;
                        } else {
                            println!("Token verification failed");
                        }
                    }
                }
            }
        }
    }

    let user = username.read().await.clone();
    if user.is_empty() {
        println!("Authentication failed, closing connection");
        let _ = sender
            .send(axum::extract::ws::Message::Text(
                serde_json::to_string(&ServerMessage::Error {
                    message: "Authentication failed".to_string(),
                })
                .unwrap_or_default(),
            ))
            .await;
        let _ = sender.close().await;
        return;
    }

    println!("WebSocket connection established for user '{}'", user);

    let (tx, mut rx) = mpsc::unbounded_channel::<axum::extract::ws::Message>();

    // 注册连接
    state.connections.write().await.insert(user.clone(), tx.clone());

    // 接收消息循环
    let sender_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if sender.send(msg).await.is_err() {
                break;
            }
        }
    });

    // 处理接收的消息
    while let Some(Ok(msg)) = receiver.next().await {
        if let axum::extract::ws::Message::Text(text) = msg {
            println!("Received text message from '{}': {}", user, text);
            if let Ok(client_msg) = serde_json::from_str::<ClientMessage>(&text) {
                handle_client_message(client_msg, &user, &state).await;
            } else {
                println!("Failed to parse message: {}", text);
            }
        }
    }

    // 清理：用户断开连接
    sender_task.abort();
    state.connections.write().await.remove(&user);

    // 从所有房间移除用户
    let mut rooms = state.rooms.write().await;
    let mut rooms_to_remove = Vec::new();
    for room in rooms.iter_mut() {
        if room.members.contains(&user) {
            room.remove_member(&user);
        }
        // 如果房间为空，可以选择删除或保留
        if room.members.is_empty() && room.messages.is_empty() {
            rooms_to_remove.push(room.id.clone());
        }
    }
    // 移除空房间
    rooms.retain(|r| !rooms_to_remove.contains(&r.id));
}

async fn handle_client_message(
    msg: ClientMessage,
    username: &str,
    state: &AppState,
) {
    println!("Received message from '{}': {:?}", username, msg);
    match msg {
        ClientMessage::JoinRoom { room_id } => {
            println!("Processing JoinRoom: user='{}', room_id='{}'", username, room_id);
            let mut rooms = state.rooms.write().await;
            if let Some(room) = rooms.iter_mut().find(|r| r.id == room_id) {
                room.add_member(username.to_string());
                println!("User '{}' joined room '{}', total members: {}", username, room.name, room.members.len());

                // 发送历史消息给当前用户
                let history = room.messages.clone();
                let connections = state.connections.read().await;
                if let Some(tx) = connections.get(username) {
                    let _ = tx.send(axum::extract::ws::Message::Text(
                        serde_json::to_string(&ServerMessage::History {
                            room_id: room_id.clone(),
                            messages: history,
                        })
                        .unwrap_or_default(),
                    ));
                }
            } else {
                println!("Room '{}' not found", room_id);
            }
        }
        ClientMessage::LeaveRoom { room_id } => {
            let mut rooms = state.rooms.write().await;
            if let Some(room) = rooms.iter_mut().find(|r| r.id == room_id) {
                room.remove_member(username);
            }
        }
        ClientMessage::Message { room_id, content } => {
            let message = ModelMessage {
                id: uuid::Uuid::new_v4().to_string(),
                sender: username.to_string(),
                content: content.clone(),
                timestamp: chrono::Utc::now().timestamp(),
                room_id: room_id.clone(),
            };

            // 保存消息到房间，同时确保发送者在房间成员列表中
            let mut rooms = state.rooms.write().await;
            if let Some(room) = rooms.iter_mut().find(|r| r.id == room_id) {
                // 确保发送者在房间成员列表中
                if !room.members.contains(username) {
                    room.add_member(username.to_string());
                }
                room.add_message(message.clone());

                // 获取房间所有成员
                let members: Vec<String> = room.members.iter().cloned().collect();
                drop(rooms);

                // 准备广播消息
                let msg_json = serde_json::to_string(&ServerMessage::Message {
                    room_id: room_id.clone(),
                    message: message.clone(),
                }).unwrap_or_default();

                // 广播消息给房间内所有成员
                let connections = state.connections.read().await;
                for member in &members {
                    if let Some(tx) = connections.get(member) {
                        let _ = tx.send(axum::extract::ws::Message::Text(msg_json.clone()));
                    }
                }
                drop(connections);

                // Bot 自动回复逻辑
                // 1. 如果 @机器人名字，设置该机器人为活跃状态并回复
                // 2. 如果 @all，所有机器人回复，但不设置活跃状态
                // 3. 如果没有 @提及，但有活跃机器人且未超时，则该机器人继续回复
                // 4. 活跃机器人超时时间为1分钟，机器人回复后重置超时
                if let MessageContent::Text { text, .. } = &content {
                    let bots = state.room_bots.read().await;
                    if let Some(room_bots) = bots.get(&room_id) {
                        let active_key = format!("{}_{}", room_id, username);
                        let current_time = chrono::Utc::now().timestamp();
                        const ACTIVE_TIMEOUT: i64 = 60;  // 1分钟超时

                        // 检查是否 @all
                        let is_mention_all = text.contains("@all");

                        // 查找被 @提及的机器人
                        let mentioned_bot: Option<(String, _)> = room_bots.values()
                            .find(|bot| {
                                let mention = format!("@{}", bot.name);
                                text.contains(&mention)
                            })
                            .map(|bot| (bot.id.clone(), bot.clone()));

                        // 确定要回复的机器人和是否重置超时
                        let (bots_to_reply, should_reset_timeout): (Vec<_>, bool) = if is_mention_all {
                            // @all 时，所有机器人回复，但不设置/重置活跃状态
                            (room_bots.values().cloned().collect(), false)
                        } else if let Some((bot_id, bot)) = mentioned_bot {
                            // @特定机器人时，设置该机器人为活跃状态
                            let mut active_bots_write = state.active_bots.write().await;
                            active_bots_write.insert(active_key.clone(), ActiveBotInfo {
                                bot_id: bot_id.clone(),
                                timestamp: current_time,
                            });
                            println!("Set active bot '{}' for user '{}' in room '{}'", bot.name, username, room_id);
                            drop(active_bots_write);
                            (vec![bot], true)
                        } else {
                            // 没有 @提及时，检查活跃机器人是否超时
                            let active_bot_info = {
                                let active_bots = state.active_bots.read().await;
                                active_bots.get(&active_key).cloned()
                            };
                            if let Some(info) = active_bot_info {
                                let elapsed = current_time - info.timestamp;
                                if elapsed <= ACTIVE_TIMEOUT {
                                    // 未超时，使用活跃机器人
                                    if let Some(bot) = room_bots.get(&info.bot_id) {
                                        println!("Using active bot '{}' for user '{}' in room '{}' ({}s elapsed)", bot.name, username, room_id, elapsed);
                                        (vec![bot.clone()], true)
                                    } else {
                                        (vec![], false)  // 活跃机器人不存在
                                    }
                                } else {
                                    // 超时，移除活跃机器人
                                    println!("Active bot timed out for user '{}' in room '{}' ({}s > {}s)", username, room_id, elapsed, ACTIVE_TIMEOUT);
                                    let mut active_bots_write = state.active_bots.write().await;
                                    active_bots_write.remove(&active_key);
                                    drop(active_bots_write);
                                    (vec![], false)
                                }
                            } else {
                                (vec![], false)  // 没有活跃机器人
                            }
                        };

                        // 让每个要回复的机器人生成回复
                        for bot in bots_to_reply {
                            println!("Bot '{}' is generating reply", bot.name);

                            // 如果配置了 AI 模型，使用 AI 生成回复
                            let reply = if let Some(ai_model) = &bot.ai_model {
                                let system_prompt = bot.system_prompt.as_deref();
                                // 对于 @all，修改提示词让每个机器人给出不同的建议
                                let enhanced_prompt = if is_mention_all {
                                    format!("{} (请给出你的建议和观点)", text)
                                } else {
                                    text.to_string()
                                };

                                // 获取机器人的对话历史
                                let memory_key = format!("{}_{}", room_id, bot.id);
                                let history = {
                                    let memory = state.bot_memory.read().await;
                                    memory.get(&memory_key).cloned().unwrap_or_default()
                                };

                                match crate::ai::get_ai_reply(&enhanced_prompt, ai_model, system_prompt, &bot.name, &history).await {
                                    Some(ai_reply) => {
                                        // 保存对话到记忆中
                                        let mut memory = state.bot_memory.write().await;
                                        let key = format!("{}_{}", room_id, bot.id);
                                        let bot_history = memory.entry(key).or_insert_with(Vec::new);
                                        bot_history.push(("user".to_string(), enhanced_prompt));
                                        bot_history.push(("assistant".to_string(), ai_reply.clone()));
                                        // 限制记忆长度为最近20条
                                        if bot_history.len() > 20 {
                                            bot_history.drain(0..bot_history.len() - 20);
                                        }
                                        ai_reply
                                    },
                                    None => {
                                        eprintln!("AI service unavailable for bot '{}' (model: {}), using default reply", bot.name, ai_model);
                                        bot.default_reply.clone()
                                    }
                                }
                            } else {
                                // 使用关键词匹配
                                bot.get_reply(text)
                            };

                            // 创建 bot 回复消息
                            let bot_message = ModelMessage {
                                id: uuid::Uuid::new_v4().to_string(),
                                sender: bot.name.clone(),
                                content: MessageContent::Text {
                                    content_type: "text".to_string(),
                                    text: reply,
                                },
                                timestamp: chrono::Utc::now().timestamp(),
                                room_id: room_id.clone(),
                            };

                            // 保存 bot 消息到房间
                            let mut rooms = state.rooms.write().await;
                            if let Some(room) = rooms.iter_mut().find(|r| r.id == room_id) {
                                room.add_message(bot_message.clone());

                                // 获取房间所有成员
                                let members: Vec<String> = room.members.iter().cloned().collect();
                                drop(rooms);

                                // 广播 bot 消息给房间内所有成员
                                let bot_msg_json = serde_json::to_string(&ServerMessage::Message {
                                    room_id: room_id.clone(),
                                    message: bot_message.clone(),
                                }).unwrap_or_default();

                                let connections = state.connections.read().await;
                                for member in &members {
                                    if let Some(tx) = connections.get(member) {
                                        let _ = tx.send(axum::extract::ws::Message::Text(bot_msg_json.clone()));
                                    }
                                }
                            }

                            // 机器人回复后，重置超时时间（仅限非@all的情况）
                            if should_reset_timeout {
                                let mut active_bots_write = state.active_bots.write().await;
                                active_bots_write.insert(active_key.clone(), ActiveBotInfo {
                                    bot_id: bot.id.clone(),
                                    timestamp: chrono::Utc::now().timestamp(),
                                });
                                println!("Reset timeout for active bot '{}' for user '{}' in room '{}'", bot.name, username, room_id);
                            }
                        }
                    }
                }
            }
        }
        ClientMessage::Typing { room_id } => {
            // 获取房间所有成员（除了发送者）
            let rooms = state.rooms.read().await;
            if let Some(room) = rooms.iter().find(|r| r.id == room_id) {
                let members: Vec<String> = room.members.iter()
                    .filter(|m| *m != username)
                    .cloned()
                    .collect();
                drop(rooms);

                // 广播 typing 指示器
                let connections = state.connections.read().await;
                let msg_json = serde_json::to_string(&ServerMessage::Typing {
                    room_id,
                    username: username.to_string(),
                }).unwrap_or_default();

                for member in members {
                    if let Some(tx) = connections.get(&member) {
                        let _ = tx.send(axum::extract::ws::Message::Text(msg_json.clone()));
                    }
                }
            }
        }
    }
}
