use crate::config::Config;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use serde::de::DeserializeOwned;

pub struct ApiClient {
    pub base_url: String,
    pub client: reqwest::Client,
}

impl ApiClient {
    pub fn from_config(config: &Config) -> Self {
        let mut headers = HeaderMap::new();
        if let Some(token) = &config.api_token {
            let value = HeaderValue::from_str(&format!("Bearer {}", token)).unwrap();
            headers.insert(AUTHORIZATION, value);
        }

        let client = reqwest::Client::builder()
            .default_headers(headers)
            .build()
            .unwrap();

        ApiClient {
            base_url: config.get_server_url(),
            client,
        }
    }

    pub async fn get<T: DeserializeOwned>(&self, path: &str) -> Result<T, anyhow::Error> {
        let url = format!("{}{}", self.base_url, path);
        let resp = self.client.get(&url).send().await?;
        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            anyhow::bail!("HTTP {}: {}", status, body);
        }
        Ok(resp.json::<T>().await?)
    }

    pub async fn post<T: DeserializeOwned>(
        &self,
        path: &str,
        body: &impl serde::Serialize,
    ) -> Result<T, anyhow::Error> {
        let url = format!("{}{}", self.base_url, path);
        let resp = self.client.post(&url).json(body).send().await?;
        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            anyhow::bail!("HTTP {}: {}", status, body);
        }
        Ok(resp.json::<T>().await?)
    }

    pub async fn delete<T: DeserializeOwned>(&self, path: &str) -> Result<T, anyhow::Error> {
        let url = format!("{}{}", self.base_url, path);
        let resp = self.client.delete(&url).send().await?;
        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            anyhow::bail!("HTTP {}: {}", status, body);
        }
        Ok(resp.json::<T>().await?)
    }
}
