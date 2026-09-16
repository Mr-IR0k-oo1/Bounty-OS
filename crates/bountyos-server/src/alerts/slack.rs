use serde_json::json;

pub async fn send_slack_alert(
    webhook_url: &str,
    message: &str,
    severity: &str,
) -> Result<(), reqwest::Error> {
    let client = reqwest::Client::new();
    let emoji = match severity {
        "critical" => ":red_circle:",
        "high" => ":orange_circle:",
        "medium" => ":large_blue_circle:",
        _ => ":white_circle:",
    };
    let payload = json!({
        "blocks": [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "BountyOS Alert"
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": format!("{} {}", emoji, message)
                }
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": format!("Severity: {} | {}", severity, chrono::Utc::now().to_rfc3339())
                    }
                ]
            }
        ]
    });
    client.post(webhook_url).json(&payload).send().await?;
    Ok(())
}
