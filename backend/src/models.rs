use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use uuid::Uuid;

/// 用户信息
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct User {
    pub username: String,
    pub password_hash: String,
}

/// 消息内容类型
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(untagged)]
pub enum MessageContent {
    #[serde(rename = "text")]
    Text { content_type: String, text: String },
    #[serde(rename = "image")]
    Image { content_type: String, image: String },
}

/// 消息
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub sender: String,
    pub content: MessageContent,
    pub timestamp: i64,
    pub room_id: String,
}

/// 聊天室
#[derive(Clone, serde::Serialize, serde::Deserialize)]
pub struct Room {
    pub id: String,
    pub name: String,
    pub members: HashSet<String>,
    pub messages: Vec<Message>,
    pub bots: Vec<String>,  // bot IDs in this room
}

impl Room {
    pub fn new(id: String, name: String) -> Self {
        Self {
            id,
            name,
            members: HashSet::new(),
            messages: Vec::new(),
            bots: Vec::new(),
        }
    }

    pub fn add_member(&mut self, username: String) {
        self.members.insert(username);
    }

    pub fn remove_member(&mut self, username: &str) {
        self.members.remove(username);
    }

    pub fn add_message(&mut self, message: Message) {
        self.messages.push(message);
        // 保留最近100条消息
        if self.messages.len() > 100 {
            self.messages.remove(0);
        }
    }
}

/// WebSocket 消息类型
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ClientMessage {
    #[serde(rename = "join_room")]
    JoinRoom { room_id: String },
    #[serde(rename = "leave_room")]
    LeaveRoom { room_id: String },
    #[serde(rename = "message")]
    Message { room_id: String, content: MessageContent },
    #[serde(rename = "typing")]
    Typing { room_id: String },
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ServerMessage {
    #[serde(rename = "message")]
    Message { room_id: String, message: Message },
    #[serde(rename = "user_joined")]
    UserJoined { room_id: String, username: String },
    #[serde(rename = "user_left")]
    UserLeft { room_id: String, username: String },
    #[serde(rename = "typing")]
    Typing { room_id: String, username: String },
    #[serde(rename = "error")]
    Error { message: String },
    #[serde(rename = "history")]
    History { room_id: String, messages: Vec<Message> },
}

/// 全局连接类型（用于 WebSocket）
pub type WsConnections = Arc<RwLock<HashMap<String, mpsc::UnboundedSender<axum::extract::ws::Message>>>>;

/// 房间机器人 (room_id -> (bot_id -> bot))
pub type RoomBots = Arc<RwLock<HashMap<String, HashMap<String, Bot>>>>;

/// 对话历史记忆 (room_id:bot_id -> [(role, content)])
pub type BotMemory = Arc<RwLock<HashMap<String, Vec<(String, String)>>>>;

/// 活跃机器人信息
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct ActiveBotInfo {
    pub bot_id: String,
    pub timestamp: i64,  // 设置活跃的时间戳
}

/// 活跃机器人 (room_id:username -> ActiveBotInfo) 记录每个用户在每个房间最后@的机器人
pub type ActiveBots = Arc<RwLock<HashMap<String, ActiveBotInfo>>>;

/// 全局状态
#[derive(Clone)]
pub struct AppState {
    pub users: Arc<RwLock<Vec<User>>>,
    pub rooms: Arc<RwLock<Vec<Room>>>,
    pub connections: WsConnections,
    pub room_bots: RoomBots,
    pub bot_memory: BotMemory,
    pub active_bots: ActiveBots,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            users: Arc::new(RwLock::new(Vec::new())),
            rooms: Arc::new(RwLock::new(Vec::new())),
            connections: Arc::new(RwLock::new(HashMap::new())),
            room_bots: Arc::new(RwLock::new(HashMap::new())),
            bot_memory: Arc::new(RwLock::new(HashMap::new())),
            active_bots: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

/// JWT Claims
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
}

/// 虚拟人物（Bot）
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Bot {
    pub id: String,
    pub name: String,
    pub avatar: String,  // 头像 emoji 或 URL
    pub keywords: HashMap<String, String>,  // 关键词 -> 回复
    pub default_reply: String,  // 默认回复（无匹配关键词时）
    #[serde(default)]
    pub ai_model: Option<String>,  // AI 模型 (如 "gpt-4", "gpt-3.5-turbo", None 表示只用关键词)
    #[serde(default)]
    pub system_prompt: Option<String>,  // AI 系统提示词
}

impl Bot {
    pub fn new(name: String, avatar: String, default_reply: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name,
            avatar,
            keywords: HashMap::new(),
            default_reply,
            ai_model: None,
            system_prompt: None,
        }
    }

    #[allow(dead_code)]
    pub fn with_ai(mut self, model: String, system_prompt: Option<String>) -> Self {
        self.ai_model = Some(model);
        self.system_prompt = system_prompt;
        self
    }

    pub fn add_keyword(&mut self, keyword: String, reply: String) {
        self.keywords.insert(keyword, reply);
    }

    /// 根据消息内容获取回复
    pub fn get_reply(&self, message: &str) -> String {
        let lower_msg = message.to_lowercase();
        for (keyword, reply) in &self.keywords {
            if lower_msg.contains(keyword) {
                return reply.clone();
            }
        }
        self.default_reply.clone()
    }
}

/// 创建 Bot 请求
#[derive(Debug, Deserialize)]
pub struct CreateBotRequest {
    pub name: String,
    pub avatar: Option<String>,
    pub default_reply: Option<String>,
    pub keywords: Option<HashMap<String, String>>,
    #[serde(default)]
    pub ai_model: Option<String>,
    #[serde(default)]
    pub system_prompt: Option<String>,
}

/// Bot 响应
#[derive(Debug, Serialize)]
#[allow(dead_code)]
pub struct BotResponse {
    pub id: String,
    pub name: String,
    pub avatar: String,
    pub room_id: String,
}
