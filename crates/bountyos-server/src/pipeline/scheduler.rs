use chrono::Utc;
use std::sync::Arc;
use tokio::time::{interval, Duration};
use uuid::Uuid;

use crate::models::scan_job::ScanJob;
use crate::pipeline::queue;
use crate::AppState;
use bountyos_common::ScanStage;

pub fn start_scheduler(app_state: Arc<AppState>) {
    tokio::spawn(async move {
        let mut timer = interval(Duration::from_secs(60));
        loop {
            timer.tick().await;
            if let Err(e) = check_and_enqueue_rescans(&app_state).await {
                tracing::error!("Scheduler error: {:?}", e);
            }
        }
    });
}

async fn check_and_enqueue_rescans(app_state: &AppState) -> Result<(), anyhow::Error> {
    let pool = app_state.db();
    let now = Utc::now();

    let programs = sqlx::query_as::<_, (Uuid, i32)>(
        "SELECT id, rescan_interval_hrs FROM programs WHERE active = true",
    )
    .fetch_all(pool)
    .await?;

    for (program_id, interval_hrs) in programs {
        let last_scanned = sqlx::query_scalar::<_, Option<chrono::DateTime<Utc>>>(
            "SELECT MAX(created_at) FROM scan_jobs WHERE program_id = $1 AND status = 'completed'",
        )
        .bind(program_id)
        .fetch_one(pool)
        .await?;

        let should_rescan = match last_scanned {
            Some(last) => {
                let elapsed = (now - last).num_hours();
                elapsed >= interval_hrs as i64
            }
            None => true,
        };

        if should_rescan {
            tracing::info!("Enqueuing rescan for program {}", program_id);
            let job = ScanJob {
                id: Uuid::new_v4(),
                program_id,
                stage: ScanStage::Passive,
                status: "queued".to_string(),
                subdomain_id: None,
                target: None,
                flags: Default::default(),
                error_log: None,
                started_at: None,
                completed_at: None,
                created_at: now,
                updated_at: now,
            };
            let redis_client = app_state.redis();
            queue::enqueue_job(redis_client, &job).await?;

            sqlx::query(
                "INSERT INTO scan_jobs (id, program_id, stage, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)"
            )
            .bind(job.id)
            .bind(job.program_id)
            .bind(job.stage.to_i32())
            .bind(&job.status)
            .bind(job.created_at)
            .bind(job.updated_at)
            .execute(pool)
            .await?;
        }
    }

    Ok(())
}
