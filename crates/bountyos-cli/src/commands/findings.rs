use crate::client::ApiClient;
use crate::config::Config;
use crate::output;

pub async fn list(
    program: Option<String>,
    severity: Option<String>,
    status: Option<String>,
    unassigned: bool,
) -> Result<(), anyhow::Error> {
    let config = Config::load();
    let client = ApiClient::from_config(&config);
    let mut params = Vec::new();
    if let Some(p) = program {
        params.push(format!("program_id={}", p));
    }
    if let Some(s) = severity {
        params.push(format!("severity={}", s));
    }
    if let Some(s) = status {
        params.push(format!("status={}", s));
    }
    if unassigned {
        params.push("unassigned=true".to_string());
    }
    let query = if params.is_empty() {
        String::new()
    } else {
        format!("?{}", params.join("&"))
    };
    let resp: serde_json::Value = client.get(&format!("/api/findings{}", query)).await?;
    output::print_json(&resp);
    Ok(())
}

pub async fn claim(id: Option<String>) -> Result<(), anyhow::Error> {
    let config = Config::load();
    let client = ApiClient::from_config(&config);
    let path = format!("/api/findings/{}/claim", id.unwrap_or_default());
    let resp: serde_json::Value = client.post(&path, &serde_json::json!({})).await?;
    output::print_success("Finding claimed");
    output::print_json(&resp);
    Ok(())
}

pub async fn validate(id: Option<String>) -> Result<(), anyhow::Error> {
    let config = Config::load();
    let client = ApiClient::from_config(&config);
    let path = format!("/api/findings/{}/validate", id.unwrap_or_default());
    let resp: serde_json::Value = client.post(&path, &serde_json::json!({})).await?;
    output::print_success("Finding validated");
    output::print_json(&resp);
    Ok(())
}

pub async fn fp(id: Option<String>) -> Result<(), anyhow::Error> {
    let config = Config::load();
    let client = ApiClient::from_config(&config);
    let path = format!("/api/findings/{}/fp", id.unwrap_or_default());
    let resp: serde_json::Value = client.post(&path, &serde_json::json!({})).await?;
    output::print_success("Finding marked as false positive");
    output::print_json(&resp);
    Ok(())
}

pub async fn report(id: Option<String>, platform: Option<String>) -> Result<(), anyhow::Error> {
    let config = Config::load();
    let client = ApiClient::from_config(&config);
    let body = serde_json::json!({
        "platform": platform,
    });
    let path = format!("/api/findings/{}/report", id.unwrap_or_default());
    let resp: serde_json::Value = client.post(&path, &body).await?;
    output::print_success("Finding reported");
    output::print_json(&resp);
    Ok(())
}
