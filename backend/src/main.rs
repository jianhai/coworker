use axum::{
    routing::{get, post},
    Router,
};
use tower_http::cors::CorsLayer;
use tokio::net::TcpListener;

mod auth;
mod models;
mod rooms;
mod websocket;
mod bot;
mod storage;
mod ai;
mod config;

use config::load_config;

use auth::{login, register};
use rooms::routes as room_routes;
use websocket::websocket_handler;
use bot::routes as bot_routes;
use storage::{init_state_with_persistence, auto_save_task};

#[tokio::main]
async fn main() {
    // 加载配置
    let app_config = load_config().unwrap_or_default();
    let bind_address = &app_config.backend.bind_address;

    // 加载环境变量
    dotenv::dotenv().ok();

    // 检查 AI 配置
    if ai::AiService::is_configured() {
        println!("AI API configured - AI bots enabled");
    } else {
        println!("Warning: API key not configured - AI bots will use keyword-only mode");
        println!("Add your API key to ~/.cowork/settings.json to enable AI features");
    }

    // 使用持久化状态初始化
    let state = init_state_with_persistence();

    // 克隆状态用于自动保存任务
    let state_for_save = state.clone();

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/api/register", post(register))
        .route("/api/login", post(login))
        .route("/ws", get(websocket_handler))
        .merge(room_routes())
        .merge(bot_routes())
        .with_state(state)
        .layer(CorsLayer::permissive());

    let listener = TcpListener::bind(bind_address)
        .await
        .expect("Failed to bind");

    // 启动自动保存任务（每30秒保存一次）
    tokio::spawn(async move {
        auto_save_task(state_for_save, 30).await;
    });

    println!("Server running on http://{}", bind_address);
    println!("Data persistence enabled - auto-saving every 30 seconds");
    axum::serve(listener, app)
        .await
        .expect("Server error");
}

async fn health_check() -> &'static str {
    "OK"
}
