pub async fn send_discord_alert(
    webhook_url: &str,
    message: &str,
    severity: &str,
) -> Result<(), reqwest::Error> {
    let client = reqwest::Client::new();
    let color = match severity {
        "critical" => 0xf85149,
        "high" => 0xd29922,
        "medium" => 0x58a6ff,
        _ => 0x8b949e,
    };
    let payload = serde_json::json!({
        "embeds": [{
            "title": "BountyOS Alert",
            "description": message,
            "color": color,
            "timestamp": chrono::Utc::now().to_rfc3339()
        }]
    });
    client.post(webhook_url).json(&payload).send().await?;
    Ok(())
}
