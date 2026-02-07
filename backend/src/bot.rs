use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Json, Response},
    routing::{delete, get, post},
    Router,
};
use std::collections::HashMap;
use crate::models::{AppState, Bot, CreateBotRequest};
use crate::storage::save_data;

/// 获取房间内的所有 Bot
pub async fn get_room_bots(
    State(state): State<AppState>,
    Path(room_id): Path<String>,
) -> Response {
    let bots = state.room_bots.read().await;
    if let Some(room_bots) = bots.get(&room_id) {
        let bot_list: Vec<serde_json::Value> = room_bots.values().map(|bot| {
            serde_json::json!({
                "id": bot.id,
                "name": bot.name,
                "avatar": bot.avatar,
                "default_reply": bot.default_reply,
                "keywords": bot.keywords,
            })
        }).collect();
        (StatusCode::OK, Json(serde_json::json!({ "bots": bot_list }))).into_response()
    } else {
        (StatusCode::OK, Json(serde_json::json!({ "bots": [] }))).into_response()
    }
}

/// 创建房间 Bot
pub async fn create_bot(
    State(state): State<AppState>,
    Path(room_id): Path<String>,
    Json(req): Json<CreateBotRequest>,
) -> Response {
    // 验证房间存在
    {
        let rooms = state.rooms.read().await;
        if rooms.iter().find(|r| r.id == room_id).is_none() {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": "Room not found"}))
            ).into_response();
        }
    }

    let avatar = req.avatar.as_ref().unwrap_or(&"🤖".to_string()).clone();
    let default_reply = req.default_reply.as_ref().unwrap_or(&"你好！".to_string()).clone();

    let mut bot = Bot::new(
        req.name.clone(),
        avatar.clone(),
        default_reply,
    );

    // 设置 AI 模型
    if let Some(ai_model) = &req.ai_model {
        bot.ai_model = Some(ai_model.clone());
        bot.system_prompt = req.system_prompt.clone();
    }

    // 添加关键词
    if let Some(keywords) = req.keywords {
        for (keyword, reply) in keywords {
            bot.add_keyword(keyword, reply);
        }
    }

    let bot_id = bot.id.clone();

    // 将 bot 添加到房间
    {
        let mut bots = state.room_bots.write().await;
        bots.entry(room_id.clone())
            .or_insert_with(HashMap::new)
            .insert(bot_id.clone(), bot);
    }

    // 将 bot ID 添加到房间
    {
        let mut rooms = state.rooms.write().await;
        if let Some(room) = rooms.iter_mut().find(|r| r.id == room_id) {
            if !room.bots.contains(&bot_id) {
                room.bots.push(bot_id.clone());
            }
        }
    }

    // 保存数据
    let _ = save_data(&state).await;

    let response = serde_json::json!({
        "id": bot_id,
        "name": req.name,
        "avatar": avatar,
        "room_id": room_id,
    });

    (StatusCode::CREATED, Json(response)).into_response()
}

/// 删除房间 Bot
pub async fn delete_bot(
    State(state): State<AppState>,
    Path(params): Path<(String, String)>,  // (room_id, bot_id)
) -> Response {
    let (room_id, bot_id) = params;

    // 从房间移除 bot ID
    {
        let mut rooms = state.rooms.write().await;
        if let Some(room) = rooms.iter_mut().find(|r| r.id == room_id) {
            room.bots.retain(|id| id != &bot_id);
        }
    }

    // 删除 bot
    let mut bots = state.room_bots.write().await;
    if let Some(room_bots) = bots.get_mut(&room_id) {
        if room_bots.remove(&bot_id).is_some() {
            // 如果房间没有 bot 了，删除房间条目
            if room_bots.is_empty() {
                bots.remove(&room_id);
            }
            drop(bots);
            // 保存数据
            let _ = save_data(&state).await;
            (StatusCode::OK, Json(serde_json::json!({"success": true}))).into_response()
        } else {
            (StatusCode::NOT_FOUND, Json(serde_json::json!({"error": "Bot not found"}))).into_response()
        }
    } else {
        (StatusCode::NOT_FOUND, Json(serde_json::json!({"error": "Room has no bots"}))).into_response()
    }
}

/// 获取所有带 Bot 的房间列表
pub async fn list_bots(State(state): State<AppState>) -> Json<serde_json::Value> {
    let bots = state.room_bots.read().await;
    let rooms = state.rooms.read().await;

    let mut result = Vec::new();
    for (room_id, room_bots) in bots.iter() {
        let room_name = rooms.iter()
            .find(|r| r.id == *room_id)
            .map(|r| r.name.clone())
            .unwrap_or_default();

        let bot_list: Vec<serde_json::Value> = room_bots.values().map(|bot| {
            serde_json::json!({
                "id": bot.id,
                "name": bot.name,
                "avatar": bot.avatar,
                "default_reply": bot.default_reply,
                "keywords": bot.keywords,
            })
        }).collect();

        result.push(serde_json::json!({
            "room_id": room_id,
            "room_name": room_name,
            "bots": bot_list,
        }));
    }

    Json(serde_json::json!({ "rooms_with_bots": result }))
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/bots", get(list_bots))
        .route("/api/rooms/:room_id/bots", get(get_room_bots).post(create_bot))
        .route("/api/rooms/:room_id/bots/:bot_id", delete(delete_bot))
}
