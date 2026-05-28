use uuid::Uuid;
use tokio::sync::broadcast;
use tokio::process::Command;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum RunnerError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Process exited with non-zero status: {0}")]
    NonZeroExit(i32),
    #[error("JSON parse error: {0}")]
    JsonParse(#[from] serde_json::Error),
    #[error("UTF-8 decode error: {0}")]
    Utf8(#[from] std::string::FromUtf8Error),
}

pub struct ScriptRunner {
    pub script: String,
    pub args: Vec<String>,
    pub job_id: Uuid,
    pub ws_tx: broadcast::Sender<String>,
}

impl ScriptRunner {
    pub async fn run(&self) -> Result<Vec<serde_json::Value>, anyhow::Error> {
        let mut cmd = Command::new("bash");
        cmd.arg(&self.script);
        for arg in &self.args {
            cmd.arg(arg);
        }
        cmd.stdout(std::process::Stdio::piped());
        cmd.stderr(std::process::Stdio::piped());

        let mut child = cmd.spawn()?;
        let stdout = child.stdout.take().unwrap();
        let stderr = child.stderr.take().unwrap();

        let ws_tx = self.ws_tx.clone();
        let job_id = self.job_id;
        let stdout_handle = tokio::spawn(async move {
            use tokio::io::AsyncBufReadExt;
            let reader = tokio::io::BufReader::new(stdout);
            let mut lines = reader.lines();
            let mut results = Vec::new();
            while let Ok(Some(line)) = lines.next_line().await {
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&line) {
                    results.push(val);
                }
            }
            results
        });

        let stderr_handle = tokio::spawn(async move {
            use tokio::io::AsyncBufReadExt;
            let reader = tokio::io::BufReader::new(stderr);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let msg = format!("[job:{}] {}", job_id, line);
                let _ = ws_tx.send(msg);
            }
        });

        let results = stdout_handle.await.unwrap_or_default();
        stderr_handle.await.ok();

        let status = child.wait().await?;
        if !status.success() {
            if let Some(code) = status.code() {
                anyhow::bail!(RunnerError::NonZeroExit(code));
            }
        }

        Ok(results)
    }
}
