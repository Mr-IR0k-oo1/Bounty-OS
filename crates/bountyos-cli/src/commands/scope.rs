use crate::client::ApiClient;
use crate::config::Config;
use crate::output;

pub async fn list(program: Option<String>) -> Result<(), anyhow::Error> {
    let config = Config::load();
    let client = ApiClient::from_config(&config);
    let path = match program {
        Some(pid) => format!("/api/scope?program_id={}", pid),
        None => "/api/scope".to_string(),
    };
    let resp: serde_json::Value = client.get(&path).await?;
    output::print_json(&resp);
    Ok(())
}

pub async fn add(
    program: Option<String>,
    target: Option<String>,
    target_type: Option<String>,
    out_of_scope: bool,
) -> Result<(), anyhow::Error> {
    let config = Config::load();
    let client = ApiClient::from_config(&config);
    let body = serde_json::json!({
        "program_id": program,
        "target": target,
        "target_type": target_type,
        "out_of_scope": out_of_scope,
    });
    let resp: serde_json::Value = client.post("/api/scope", &body).await?;
    output::print_success("Scope target added");
    output::print_json(&resp);
    Ok(())
}

pub async fn import(program: Option<String>, file: Option<String>) -> Result<(), anyhow::Error> {
    let config = Config::load();
    let client = ApiClient::from_config(&config);
    let content = match file {
        Some(path) => std::fs::read_to_string(&path)?,
        None => {
            output::print_error("No file specified");
            return Ok(());
        }
    };
    let targets: Vec<String> = content.lines().map(|l| l.trim().to_string()).filter(|l| !l.is_empty()).collect();
    let body = serde_json::json!({
        "program_id": program,
        "targets": targets,
    });
    let resp: serde_json::Value = client.post("/api/scope/import", &body).await?;
    output::print_success("Scope targets imported");
    output::print_json(&resp);
    Ok(())
}

pub async fn approve(program: Option<String>) -> Result<(), anyhow::Error> {
    let config = Config::load();
    let client = ApiClient::from_config(&config);
    let body = serde_json::json!({
        "program_id": program,
    });
    let resp: serde_json::Value = client.post("/api/programs/approve", &body).await?;
    output::print_success("Program approved for active scanning");
    output::print_json(&resp);
    Ok(())
}
