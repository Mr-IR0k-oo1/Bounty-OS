use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct Config {
    pub server_url: Option<String>,
    pub api_token: Option<String>,
}

impl Config {
    fn config_path() -> PathBuf {
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        let dir = home.join(".bountyos");
        std::fs::create_dir_all(&dir).ok();
        dir.join("config.toml")
    }

    pub fn load() -> Self {
        let path = Self::config_path();
        if path.exists() {
            if let Ok(content) = std::fs::read_to_string(&path) {
                if let Ok(config) = toml::from_str(&content) {
                    return config;
                }
            }
        }
        Config::default()
    }

    pub fn save(&self) -> Result<(), anyhow::Error> {
        let path = Self::config_path();
        let content = toml::to_string_pretty(self)?;
        std::fs::write(path, content)?;
        Ok(())
    }

    pub fn get_server_url(&self) -> String {
        self.server_url
            .clone()
            .unwrap_or_else(|| "http://localhost:8000".to_string())
    }
}
