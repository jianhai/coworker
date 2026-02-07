use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Json, Response},
};
use bcrypt::{hash, verify, DEFAULT_COST};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use crate::models::{AppState, Claims, User};
use crate::storage::save_data;

const JWT_SECRET: &[u8] = b"your-secret-key-change-in-production";
const TOKEN_EXPIRATION_HOURS: usize = 24;

#[derive(Debug, Serialize, Deserialize)]
pub struct RegisterRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub username: String,
}

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
}

pub async fn register(
    State(state): State<AppState>,
    Json(req): Json<RegisterRequest>,
) -> Response {
    // 验证用户名和密码长度
    if req.username.len() < 3 || req.password.len() < 6 {
        return (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Username must be at least 3 chars, password at least 6".to_string(),
            }),
        )
            .into_response();
    }

    let mut users = state.users.write().await;

    // 检查用户是否已存在
    if users.iter().any(|u| u.username == req.username) {
        return (
            StatusCode::CONFLICT,
            Json(ErrorResponse {
                error: "Username already exists".to_string(),
            }),
        )
            .into_response();
    }

    // 哈希密码
    let password_hash = match hash(&req.password, DEFAULT_COST) {
        Ok(hash) => hash,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: format!("Failed to hash password: {}", e),
                }),
            )
                .into_response();
        }
    };

    let user = User {
        username: req.username.clone(),
        password_hash,
    };
    users.push(user);
    drop(users);  // 释放锁

    // 保存数据
    let _ = save_data(&state).await;

    // 生成 token
    let token = match generate_token(&req.username) {
        Ok(t) => t,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: format!("Failed to generate token: {}", e),
                }),
            )
                .into_response();
        }
    };

    (
        StatusCode::CREATED,
        Json(AuthResponse {
            token,
            username: req.username,
        }),
    )
        .into_response()
}

pub async fn login(
    State(state): State<AppState>,
    Json(req): Json<LoginRequest>,
) -> Response {
    let users = state.users.read().await;

    // 查找用户
    let user = match users.iter().find(|u| u.username == req.username) {
        Some(u) => u,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(ErrorResponse {
                    error: "Invalid username or password".to_string(),
                }),
            )
                .into_response();
        }
    };

    // 验证密码
    match verify(&req.password, &user.password_hash) {
        Ok(true) => {}
        _ => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(ErrorResponse {
                    error: "Invalid username or password".to_string(),
                }),
            )
                .into_response();
        }
    };

    let token = match generate_token(&req.username) {
        Ok(t) => t,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: format!("Failed to generate token: {}", e),
                }),
            )
                .into_response();
        }
    };

    (
        StatusCode::OK,
        Json(AuthResponse {
            token,
            username: req.username,
        }),
    )
        .into_response()
}

fn generate_token(username: &str) -> Result<String, jsonwebtoken::errors::Error> {
    let expiration = chrono::Utc::now()
        .checked_add_signed(chrono::Duration::hours(TOKEN_EXPIRATION_HOURS as i64))
        .expect("valid timestamp")
        .timestamp() as usize;

    let claims = Claims {
        sub: username.to_string(),
        exp: expiration,
    };

    encode(&Header::default(), &claims, &EncodingKey::from_secret(JWT_SECRET))
}

pub fn verify_token(token: &str) -> Result<Claims, jsonwebtoken::errors::Error> {
    decode::<Claims>(
        token,
        &DecodingKey::from_secret(JWT_SECRET),
        &Validation::default(),
    )
    .map(|data| data.claims)
}
