use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use thiserror::Error;
use super::config::load_ai_config;

#[derive(Debug, Serialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Debug, Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
}

#[derive(Debug, Deserialize)]
struct ChatChoice {
    message: ChatMessageResponse,
    index: i32,
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ChatResponse {
    choices: Vec<ChatChoice>,
    created: u64,
    id: String,
    model: String,
    usage: Option<Usage>,
}

#[derive(Debug, Deserialize)]
struct Usage {
    prompt_tokens: u32,
    completion_tokens: u32,
    total_tokens: u32,
}

#[derive(Debug, Deserialize)]
struct ChatMessageResponse {
    content: String,
    role: String,
}

#[derive(Debug, Deserialize)]
struct ErrorResponse {
    error: ErrorDetail,
}

#[derive(Debug, Deserialize)]
struct ErrorDetail {
    message: String,
    code: Option<String>,
    #[serde(rename = "type")]
    error_type: Option<String>,
}

#[derive(Debug, Error)]
pub enum AiError {
    #[error("API key not set")]
    NoApiKey,
    #[error("HTTP request failed: {0}")]
    RequestError(#[from] reqwest::Error),
    #[error("API returned error: {0}")]
    ApiError(String),
    #[error("Config error: {0}")]
    ConfigError(String),
}

pub struct AiService {
    client: Client,
    api_key: String,
    api_url: String,
}

impl AiService {
    pub fn new() -> Result<Self, AiError> {
        let config = load_ai_config()
            .map_err(|e| AiError::ConfigError(e.to_string()))?;

        if config.api_key.is_empty() {
            return Err(AiError::NoApiKey);
        }

        println!("AI Service initialized with API URL: {}", config.api_url);

        Ok(Self {
            client: Client::builder()
                .timeout(Duration::from_secs(60))
                .build()
                .map_err(AiError::RequestError)?,
            api_key: config.api_key,
            api_url: config.api_url,
        })
    }

    pub async fn get_reply(
        &self,
        message: &str,
        model: &str,
        system_prompt: Option<&str>,
        bot_name: &str,
        history: &[(String, String)],  // (role, content) 对话历史
    ) -> Result<String, AiError> {
        let default_system = format!(
            "你是{}，一个友好的AI助手。请用简洁、自然的中文语气回复。",
            bot_name
        );

        let system = system_prompt.unwrap_or(&default_system);

        let mut messages = vec![];
        if !system.is_empty() {
            messages.push(ChatMessage {
                role: "system".to_string(),
                content: system.to_string(),
            });
        }

        // 添加历史对话（最近10条，避免token过长）
        for (role, content) in history.iter().take(10) {
            messages.push(ChatMessage {
                role: role.clone(),
                content: content.clone(),
            });
        }

        // 添加当前消息
        messages.push(ChatMessage {
            role: "user".to_string(),
            content: message.to_string(),
        });

        let request = ChatRequest {
            model: model.to_string(),
            messages,
        };

        println!("Sending request to AI API: model={}, history_len={}, message={}", model, history.len(), message);

        let response = self
            .client
            .post(&self.api_url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await?;

        let status = response.status();
        let body = response.text().await?;

        println!("API response status: {}", status);

        if !status.is_success() {
            return Err(AiError::ApiError(format!("{}: {}", status, body)));
        }

        let chat_response: ChatResponse =
            serde_json::from_str(&body).map_err(|e| AiError::ApiError(format!("Parse error: {}, body: {}", e, body)))?;

        if let Some(choice) = chat_response.choices.first() {
            let reply = choice.message.content.trim().to_string();
            println!("Got reply from AI: {}", reply);
            Ok(reply)
        } else {
            Err(AiError::ApiError("No response from API".to_string()))
        }
    }

    pub fn is_configured() -> bool {
        load_ai_config()
            .ok()
            .filter(|c| !c.api_key.is_empty())
            .is_some()
    }
}

lazy_static::lazy_static! {
    static ref AI_SERVICE: Option<AiService> = {
        println!("Initializing AI service...");
        match AiService::new() {
            Ok(service) => {
                println!("AI service initialized successfully");
                Some(service)
            }
            Err(e) => {
                eprintln!("Failed to initialize AI service: {}", e);
                None
            }
        }
    };
}

pub async fn get_ai_reply(
    message: &str,
    model: &str,
    system_prompt: Option<&str>,
    bot_name: &str,
    history: &[(String, String)],  // (role, content) 对话历史
) -> Option<String> {
    AI_SERVICE.as_ref()?
        .get_reply(message, model, system_prompt, bot_name, history)
        .await
        .ok()
}
