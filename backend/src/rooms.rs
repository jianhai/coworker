use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Json, Response},
    routing::get,
    Router,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::models::{Room, AppState};
use crate::storage::save_data;
use crate::config::load_backend_config;

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateRoomRequest {
    pub name: String,
}

#[derive(Debug, Serialize)]
pub struct RoomResponse {
    pub id: String,
    pub name: String,
    pub member_count: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub members: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
pub struct RoomMembersResponse {
    pub members: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct RoomListResponse {
    pub rooms: Vec<RoomResponse>,
}

pub async fn list_rooms(State(state): State<AppState>) -> Json<RoomListResponse> {
    let rooms = state.rooms.read().await;
    let room_responses = rooms
        .iter()
        .map(|r| {
            println!("Room '{}' has {} members", r.name, r.members.len());
            RoomResponse {
                id: r.id.clone(),
                name: r.name.clone(),
                member_count: r.members.len(),
                members: None,
            }
        })
        .collect();

    Json(RoomListResponse {
        rooms: room_responses,
    })
}

pub async fn create_room(
    State(state): State<AppState>,
    Json(req): Json<CreateRoomRequest>,
) -> Response {
    if req.name.len() < 1 || req.name.len() > 50 {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "Room name must be 1-50 characters"})),
        )
            .into_response();
    }

    let id = Uuid::new_v4().to_string();
    let room = Room::new(id.clone(), req.name);

    let mut rooms = state.rooms.write().await;
    rooms.push(room);
    drop(rooms);  // 释放锁

    // 保存数据
    let _ = save_data(&state).await;

    let rooms = state.rooms.read().await;
    let room_response = RoomResponse {
        id: id.clone(),
        name: rooms.last().unwrap().name.clone(),
        member_count: 0,
        members: None,
    };

    (StatusCode::CREATED, Json(room_response)).into_response()
}

pub async fn get_room(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Response {
    let rooms = state.rooms.read().await;

    match rooms.iter().find(|r| r.id == id) {
        Some(room) => {
            let members: Vec<String> = room.members.iter().cloned().collect();
            let response = RoomResponse {
                id: room.id.clone(),
                name: room.name.clone(),
                member_count: room.members.len(),
                members: Some(members),
            };
            (StatusCode::OK, Json(response)).into_response()
        }
        None => {
            let error = serde_json::json!({"error": "Room not found"});
            (StatusCode::NOT_FOUND, Json(error)).into_response()
        }
    }
}

pub async fn get_room_members(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Response {
    let rooms = state.rooms.read().await;

    match rooms.iter().find(|r| r.id == id) {
        Some(room) => {
            let members: Vec<String> = room.members.iter().cloned().collect();
            (StatusCode::OK, Json(RoomMembersResponse { members })).into_response()
        }
        None => {
            let error = serde_json::json!({"error": "Room not found"});
            (StatusCode::NOT_FOUND, Json(error)).into_response()
        }
    }
}

pub async fn delete_room(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Response {
    // 删除房间的 bots
    {
        let mut bots = state.room_bots.write().await;
        bots.remove(&id);
    }

    // 删除房间
    let mut rooms = state.rooms.write().await;
    let original_len = rooms.len();
    rooms.retain(|r| r.id != id);

    if rooms.len() < original_len {
        drop(rooms);
        // 保存数据
        let _ = save_data(&state).await;
        (StatusCode::OK, Json(serde_json::json!({"success": true}))).into_response()
    } else {
        (StatusCode::NOT_FOUND, Json(serde_json::json!({"error": "Room not found"}))).into_response()
    }
}

#[derive(Debug, Serialize)]
pub struct ConfigResponse {
    pub backend_url: String,
}

pub async fn get_config(State(_state): State<AppState>) -> Json<ConfigResponse> {
    let backend_config = load_backend_config().unwrap_or_default();
    Json(ConfigResponse {
        backend_url: backend_config.url,
    })
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/config", get(get_config))
        .route("/api/rooms", get(list_rooms).post(create_room))
        .route("/api/rooms/:id", get(get_room).delete(delete_room))
        .route("/api/rooms/:id/members", get(get_room_members))
}
