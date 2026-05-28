use crate::client::ApiClient;
use crate::config::Config;
use crate::output;

pub async fn list() -> Result<(), anyhow::Error> {
    let config = Config::load();
    let client = ApiClient::from_config(&config);
    let resp: serde_json::Value = client.get("/api/jobs").await?;
    output::print_json(&resp);
    Ok(())
}

pub async fn logs(id: Option<String>) -> Result<(), anyhow::Error> {
    let config = Config::load();
    let client = ApiClient::from_config(&config);
    let path = format!("/api/jobs/{}/logs", id.unwrap_or_default());
    let resp: serde_json::Value = client.get(&path).await?;
    output::print_json(&resp);
    Ok(())
}

pub async fn cancel(id: Option<String>) -> Result<(), anyhow::Error> {
    let config = Config::load();
    let client = ApiClient::from_config(&config);
    let path = format!("/api/jobs/{}/cancel", id.unwrap_or_default());
    let resp: serde_json::Value = client.post(&path, &serde_json::json!({})).await?;
    output::print_success("Job cancelled");
    output::print_json(&resp);
    Ok(())
}
