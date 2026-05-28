use crate::client::ApiClient;
use crate::config::Config;
use crate::output;

pub async fn list(project: Option<String>) -> Result<(), anyhow::Error> {
    let config = Config::load();
    let client = ApiClient::from_config(&config);
    let path = match project {
        Some(pid) => format!("/api/programs?project_id={}", pid),
        None => "/api/programs".to_string(),
    };
    let resp: serde_json::Value = client.get(&path).await?;
    output::print_json(&resp);
    Ok(())
}

pub async fn add(
    project: Option<String>,
    name: Option<String>,
    platform: Option<String>,
    url: Option<String>,
) -> Result<(), anyhow::Error> {
    let config = Config::load();
    let client = ApiClient::from_config(&config);
    let body = serde_json::json!({
        "project_id": project,
        "name": name,
        "platform": platform,
        "program_url": url,
    });
    let resp: serde_json::Value = client.post("/api/programs", &body).await?;
    output::print_success("Program created");
    output::print_json(&resp);
    Ok(())
}

pub async fn delete(slug: Option<String>) -> Result<(), anyhow::Error> {
    let config = Config::load();
    let client = ApiClient::from_config(&config);
    let path = format!("/api/programs/{}", slug.unwrap_or_default());
    let _: serde_json::Value = client.delete(&path).await?;
    output::print_success("Program deleted");
    Ok(())
}
