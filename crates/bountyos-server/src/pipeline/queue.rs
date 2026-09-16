use redis::AsyncCommands;
use uuid::Uuid;

use crate::models::scan_job::ScanJob;

const QUEUE_KEY: &str = "scan_queue";

pub async fn enqueue_job(redis_client: &redis::Client, job: &ScanJob) -> Result<(), anyhow::Error> {
    let mut conn = redis_client.get_async_connection().await?;
    let json = serde_json::to_string(job)?;
    conn.rpush::<&str, String, ()>(QUEUE_KEY, json).await?;
    Ok(())
}

pub async fn dequeue_job(redis_client: &redis::Client) -> Result<Option<ScanJob>, anyhow::Error> {
    let mut conn = redis_client.get_async_connection().await?;
    let result: Option<String> = conn.lpop(QUEUE_KEY, None).await?;
    match result {
        Some(json) => {
            let job: ScanJob = serde_json::from_str(&json)?;
            Ok(Some(job))
        }
        None => Ok(None),
    }
}

pub async fn update_job_status(
    redis_client: &redis::Client,
    job_id: Uuid,
    status: &str,
) -> Result<(), anyhow::Error> {
    let mut conn = redis_client.get_async_connection().await?;
    let key = format!("job:{}:status", job_id);
    conn.set::<&str, &str, ()>(&key, status).await?;
    Ok(())
}

pub async fn get_queue_length(redis_client: &redis::Client) -> Result<usize, anyhow::Error> {
    let mut conn = redis_client.get_async_connection().await?;
    let len: usize = conn.llen(QUEUE_KEY).await?;
    Ok(len)
}
