use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
pub struct AiConfig {
    pub api_key: String,
    #[serde(default = "default_api_url")]
    pub api_url: String,
}

fn default_api_url() -> String {
    "https://api.deepseek.com/v1/chat/completions".to_string()
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct FrontendConfig {
    #[serde(default = "default_frontend_port")]
    pub port: u16,
    #[serde(default = "default_frontend_host")]
    pub host: String,
}

fn default_frontend_host() -> String {
    "127.0.0.1".to_string()
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct BackendConfig {
    #[serde(default = "default_backend_url")]
    pub url: String,
    #[serde(default = "default_bind_address")]
    pub bind_address: String,
}

fn default_frontend_port() -> u16 {
    5173
}

fn default_backend_url() -> String {
    "https://127.0.0.1:3000".to_string()
}

fn default_bind_address() -> String {
    "127.0.0.1:3000".to_string()
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Config {
    #[serde(default)]
    pub backend: BackendConfig,
    #[serde(default)]
    pub frontend: FrontendConfig,
    pub ai: AiConfig,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            backend: BackendConfig {
                url: default_backend_url(),
                bind_address: default_bind_address(),
            },
            frontend: FrontendConfig {
                port: default_frontend_port(),
                host: default_frontend_host(),
            },
            ai: AiConfig {
                api_key: String::new(),
                api_url: default_api_url(),
            },
        }
    }
}

pub fn get_config_path() -> PathBuf {
    let mut path = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push(".cowork");
    path.push("settings.json");
    path
}

pub fn load_config() -> Result<Config, Box<dyn std::error::Error>> {
    let config_path = get_config_path();

    if !config_path.exists() {
        // 创建默认配置文件
        let default_config = Config::default();
        fs::create_dir_all(config_path.parent().unwrap())?;
        fs::write(
            &config_path,
            serde_json::to_string_pretty(&default_config)?
        )?;
        eprintln!("Created default config file at: {:?}", config_path);
        return Ok(default_config);
    }

    let content = fs::read_to_string(&config_path)?;
    let config: Config = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse config file: {}", e))?;

    Ok(config)
}

pub fn load_ai_config() -> Result<AiConfig, Box<dyn std::error::Error>> {
    load_config().map(|c| c.ai)
}

pub fn load_backend_config() -> Result<BackendConfig, Box<dyn std::error::Error>> {
    load_config().map(|c| c.backend)
}

pub fn load_frontend_config() -> Result<FrontendConfig, Box<dyn std::error::Error>> {
    load_config().map(|c| c.frontend)
}
