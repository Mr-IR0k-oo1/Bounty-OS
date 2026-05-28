use crate::client::ApiClient;
use crate::config::Config;
use crate::output;

pub async fn run_scan(
    program: Option<String>,
    stage: Option<i32>,
    full: bool,
    skip_active: bool,
) -> Result<(), anyhow::Error> {
    let config = Config::load();
    let client = ApiClient::from_config(&config);
    let body = serde_json::json!({
        "program_id": program,
        "stage": stage,
        "full": full,
        "skip_active": skip_active,
    });
    let resp: serde_json::Value = client.post("/api/scan", &body).await?;
    output::print_success("Scan initiated");
    output::print_json(&resp);
    Ok(())
}
