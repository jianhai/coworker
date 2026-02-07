use crate::models::{AppState, Room, User, Bot, ActiveBotInfo};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::sync::Arc;
use tokio::sync::RwLock;

const DATA_DIR: &str = "./data";
const USERS_FILE: &str = "./data/users.json";
const ROOMS_FILE: &str = "./data/rooms.json";
const BOTS_FILE: &str = "./data/bots.json";

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct StorageData {
    users: Vec<User>,
    rooms: Vec<RoomData>,
    bots: HashMap<String, HashMap<String, Bot>>,
    #[serde(default)]
    bot_memory: HashMap<String, Vec<(String, String)>>,  // (room_id_bot_id) -> [(role, content)]
    #[serde(default)]
    active_bots: HashMap<String, ActiveBotInfo>,  // (room_id:username) -> (bot_id, timestamp)
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
struct RoomData {
    id: String,
    name: String,
    members: Vec<String>,
    messages: Vec<crate::models::Message>,
    bots: Vec<String>,
}

impl From<Room> for RoomData {
    fn from(room: Room) -> Self {
        RoomData {
            id: room.id,
            name: room.name,
            members: room.members.into_iter().collect(),
            messages: room.messages,
            bots: room.bots,
        }
    }
}

impl From<RoomData> for Room {
    fn from(data: RoomData) -> Self {
        Room {
            id: data.id,
            name: data.name,
            members: data.members.into_iter().collect(),
            messages: data.messages,
            bots: data.bots,
        }
    }
}

/// 确保数据目录存在
fn ensure_data_dir() {
    if !Path::new(DATA_DIR).exists() {
        let _ = fs::create_dir_all(DATA_DIR);
    }
}

/// 保存数据到文件
pub async fn save_data(state: &AppState) -> Result<(), Box<dyn std::error::Error>> {
    ensure_data_dir();

    let users = state.users.read().await;
    let rooms = state.rooms.read().await;
    let bots = state.room_bots.read().await;
    let bot_memory = state.bot_memory.read().await;
    let active_bots = state.active_bots.read().await;

    let room_data: Vec<RoomData> = rooms.iter().map(|r| r.clone().into()).collect();

    // 将 bot_memory 转换为可序列化的格式
    let memory_serialized: HashMap<String, Vec<(String, String)>> = bot_memory
        .iter()
        .map(|(k, v)| (k.to_string(), v.clone()))
        .collect();

    let data = StorageData {
        users: users.clone(),
        rooms: room_data,
        bots: bots.clone(),
        bot_memory: memory_serialized,
        active_bots: active_bots.clone(),
    };

    // 保存到文件
    let json = serde_json::to_string_pretty(&data)?;
    fs::write(DATA_DIR.to_string() + "/data.json", json)?;

    Ok(())
}

/// 从文件加载数据
pub fn load_data() -> Result<StorageData, Box<dyn std::error::Error>> {
    ensure_data_dir();

    let file_path = DATA_DIR.to_string() + "/data.json";
    if !Path::new(&file_path).exists() {
        // 文件不存在，返回空数据
        return Ok(StorageData {
            users: Vec::new(),
            rooms: Vec::new(),
            bots: HashMap::new(),
            bot_memory: HashMap::new(),
            active_bots: HashMap::new(),
        });
    }

    let content = fs::read_to_string(file_path)?;
    let data: StorageData = serde_json::from_str(&content)?;
    Ok(data)
}

/// 初始化AppState并加载持久化数据
pub fn init_state_with_persistence() -> AppState {
    match load_data() {
        Ok(data) => {
            let rooms: Vec<Room> = data.rooms.into_iter().map(|r| r.into()).collect();
            AppState {
                users: Arc::new(RwLock::new(data.users)),
                rooms: Arc::new(RwLock::new(rooms)),
                connections: Arc::new(RwLock::new(HashMap::new())),
                room_bots: Arc::new(RwLock::new(data.bots)),
                bot_memory: Arc::new(RwLock::new(data.bot_memory)),
                active_bots: Arc::new(RwLock::new(data.active_bots)),
            }
        }
        Err(e) => {
            eprintln!("Failed to load data: {}, starting with empty state", e);
            AppState::new()
        }
    }
}

/// 后台自动保存任务
pub async fn auto_save_task(state: AppState, interval_secs: u64) {
    let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(interval_secs));
    loop {
        interval.tick().await;
        if let Err(e) = save_data(&state).await {
            eprintln!("Failed to save data: {}", e);
        } else {
            println!("Data saved successfully");
        }
    }
}
