use crate::client::ApiClient;
use crate::config::Config;
use crate::output;

pub async fn list() -> Result<(), anyhow::Error> {
    let config = Config::load();
    let client = ApiClient::from_config(&config);
    let resp: serde_json::Value = client.get("/api/projects").await?;
    output::print_json(&resp);
    Ok(())
}

pub async fn add(name: Option<String>, _start: Option<String>) -> Result<(), anyhow::Error> {
    let config = Config::load();
    let client = ApiClient::from_config(&config);
    let body = serde_json::json!({
        "name": name,
    });
    let resp: serde_json::Value = client.post("/api/projects", &body).await?;
    output::print_success("Project created");
    output::print_json(&resp);
    Ok(())
}

pub async fn notes(id: Option<String>) -> Result<(), anyhow::Error> {
    let config = Config::load();
    let client = ApiClient::from_config(&config);
    let path = format!("/api/projects/{}/notes", id.unwrap_or_default());
    let resp: serde_json::Value = client.get(&path).await?;
    output::print_json(&resp);
    Ok(())
}

pub async fn delete(id: Option<String>) -> Result<(), anyhow::Error> {
    let config = Config::load();
    let client = ApiClient::from_config(&config);
    let path = format!("/api/projects/{}", id.unwrap_or_default());
    let _: serde_json::Value = client.delete(&path).await?;
    output::print_success("Project deleted");
    Ok(())
}
