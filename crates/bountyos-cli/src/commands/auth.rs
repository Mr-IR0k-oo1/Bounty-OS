use std::io::{self, Write};

use crate::config::Config;
use crate::client::ApiClient;
use crate::output;

pub async fn login() -> Result<(), anyhow::Error> {
    let mut config = Config::load();

    print!("Username: ");
    io::stdout().flush()?;
    let mut username = String::new();
    io::stdin().read_line(&mut username)?;
    let username = username.trim();

    print!("Password: ");
    io::stdout().flush()?;
    let password = rpassword::read_password()?;

    print!("TOTP (leave empty if not enabled): ");
    io::stdout().flush()?;
    let mut totp = String::new();
    io::stdin().read_line(&mut totp)?;
    let totp = totp.trim();

    let client = ApiClient::from_config(&config);
    let mut body = serde_json::json!({
        "username": username,
        "password": password,
    });
    if !totp.is_empty() {
        body["totp"] = serde_json::json!(totp);
    }

    let resp: serde_json::Value = client.post("/api/auth/login", &body).await?;
    if let Some(token) = resp.get("token").and_then(|t| t.as_str()) {
        config.api_token = Some(token.to_string());
        config.save()?;
        output::print_success("Logged in successfully");
    } else {
        output::print_error("No token in response");
    }

    Ok(())
}

pub async fn logout() -> Result<(), anyhow::Error> {
    let mut config = Config::load();
    config.api_token = None;
    config.save()?;
    output::print_success("Logged out");
    Ok(())
}
