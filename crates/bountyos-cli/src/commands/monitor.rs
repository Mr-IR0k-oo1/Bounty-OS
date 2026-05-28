use crate::client::ApiClient;
use crate::config::Config;
use crate::output;

pub async fn status() -> Result<(), anyhow::Error> {
    let config = Config::load();
    let client = ApiClient::from_config(&config);
    let resp: serde_json::Value = client.get("/api/monitor/status").await?;
    output::print_json(&resp);
    Ok(())
}

pub async fn start() -> Result<(), anyhow::Error> {
    let config = Config::load();
    let client = ApiClient::from_config(&config);
    let resp: serde_json::Value = client.post("/api/monitor/start", &serde_json::json!({})).await?;
    output::print_success("Monitor started");
    output::print_json(&resp);
    Ok(())
}

pub async fn stop() -> Result<(), anyhow::Error> {
    let config = Config::load();
    let client = ApiClient::from_config(&config);
    let resp: serde_json::Value = client.post("/api/monitor/stop", &serde_json::json!({})).await?;
    output::print_success("Monitor stopped");
    output::print_json(&resp);
    Ok(())
}

pub async fn set_interval(program: Option<String>, hours: Option<i32>) -> Result<(), anyhow::Error> {
    let config = Config::load();
    let client = ApiClient::from_config(&config);
    let body = serde_json::json!({
        "program_id": program,
        "hours": hours,
    });
    let resp: serde_json::Value = client.post("/api/monitor/interval", &body).await?;
    output::print_success("Monitor interval updated");
    output::print_json(&resp);
    Ok(())
}
