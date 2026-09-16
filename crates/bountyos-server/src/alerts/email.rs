pub async fn send_email_alert(_to: &str, subject: &str, body: &str) -> Result<(), anyhow::Error> {
    tracing::info!(
        "Email alert (stub) - To: {}, Subject: {}, Body: {}",
        _to,
        subject,
        body
    );
    Ok(())
}
