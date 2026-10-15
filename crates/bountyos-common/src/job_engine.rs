use crate::errors::BountyError;
use crate::ids::{JobId, ProgramId};
use crate::models::{Job, JobCategory, JobExecutionState};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};

#[derive(Clone, Default)]
pub struct JobEngine {
    jobs: Arc<RwLock<HashMap<JobId, Job>>>,
    cancels: Arc<RwLock<HashMap<JobId, broadcast::Sender<()>>>>,
}

impl JobEngine {
    pub fn new() -> Self {
        Self {
            jobs: Arc::new(RwLock::new(HashMap::new())),
            cancels: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Create and register a new job in QUEUED state.
    pub async fn create_job(
        &self,
        program_id: ProgramId,
        target: impl Into<String>,
        category: JobCategory,
        parent_job_id: Option<JobId>,
    ) -> Result<Job, BountyError> {
        let mut job = Job::new(program_id, target, category)?;
        job.parent_job_id = parent_job_id;

        let (tx, _) = broadcast::channel(1);

        let mut jobs = self.jobs.write().await;
        let mut cancels = self.cancels.write().await;

        cancels.insert(job.id, tx);
        jobs.insert(job.id, job.clone());

        Ok(job)
    }

    /// Retrieve a job by ID
    pub async fn get_job(&self, id: JobId) -> Option<Job> {
        let jobs = self.jobs.read().await;
        jobs.get(&id).cloned()
    }

    /// List all registered jobs
    pub async fn list_jobs(&self) -> Vec<Job> {
        let jobs = self.jobs.read().await;
        jobs.values().cloned().collect()
    }

    /// List jobs filtered by category
    pub async fn list_by_category(&self, category: JobCategory) -> Vec<Job> {
        let jobs = self.jobs.read().await;
        jobs.values()
            .filter(|j| j.category == category)
            .cloned()
            .collect()
    }

    /// List child jobs of a specific parent job
    pub async fn list_child_jobs(&self, parent_id: JobId) -> Vec<Job> {
        let jobs = self.jobs.read().await;
        jobs.values()
            .filter(|j| j.parent_job_id == Some(parent_id))
            .cloned()
            .collect()
    }

    /// Transition a job from QUEUED to RUNNING
    pub async fn start_job(&self, id: JobId) -> Result<Job, BountyError> {
        let mut jobs = self.jobs.write().await;
        let job = jobs
            .get_mut(&id)
            .ok_or_else(|| BountyError::NotFound(format!("Job {} not found", id)))?;
        job.start()?;
        Ok(job.clone())
    }

    /// Transition a job from RUNNING to SUCCEEDED
    pub async fn succeed_job(&self, id: JobId) -> Result<Job, BountyError> {
        let mut jobs = self.jobs.write().await;
        let job = jobs
            .get_mut(&id)
            .ok_or_else(|| BountyError::NotFound(format!("Job {} not found", id)))?;
        job.succeed()?;
        Ok(job.clone())
    }

    /// Transition a job to FAILED with structured error message
    pub async fn fail_job(
        &self,
        id: JobId,
        error_msg: impl Into<String>,
    ) -> Result<Job, BountyError> {
        let mut jobs = self.jobs.write().await;
        let job = jobs
            .get_mut(&id)
            .ok_or_else(|| BountyError::NotFound(format!("Job {} not found", id)))?;
        job.fail(error_msg)?;
        Ok(job.clone())
    }

    /// Cancel a job and notify any registered cancellation listeners
    pub async fn cancel_job(&self, id: JobId) -> Result<Job, BountyError> {
        // Send cancellation signal
        {
            let cancels = self.cancels.read().await;
            if let Some(tx) = cancels.get(&id) {
                let _ = tx.send(());
            }
        }

        let mut jobs = self.jobs.write().await;
        let job = jobs
            .get_mut(&id)
            .ok_or_else(|| BountyError::NotFound(format!("Job {} not found", id)))?;
        job.cancel()?;
        Ok(job.clone())
    }

    /// Transition a job from RUNNING to TIMEOUT
    pub async fn timeout_job(&self, id: JobId) -> Result<Job, BountyError> {
        // Send cancellation signal
        {
            let cancels = self.cancels.read().await;
            if let Some(tx) = cancels.get(&id) {
                let _ = tx.send(());
            }
        }

        let mut jobs = self.jobs.write().await;
        let job = jobs
            .get_mut(&id)
            .ok_or_else(|| BountyError::NotFound(format!("Job {} not found", id)))?;
        job.timeout()?;
        Ok(job.clone())
    }

    /// Retry a failed or timed out job
    pub async fn retry_job(&self, id: JobId) -> Result<Job, BountyError> {
        let mut jobs = self.jobs.write().await;
        let job = jobs
            .get_mut(&id)
            .ok_or_else(|| BountyError::NotFound(format!("Job {} not found", id)))?;
        job.retry()?;
        Ok(job.clone())
    }

    /// Subscribe to cancellation signal for a job
    pub async fn subscribe_cancellation(&self, id: JobId) -> Option<broadcast::Receiver<()>> {
        let cancels = self.cancels.read().await;
        cancels.get(&id).map(|tx| tx.subscribe())
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[tokio::test]
    async fn test_job_engine_creation_and_lifecycle() {
        let engine = JobEngine::new();
        let prog_id = ProgramId::new();

        let job = engine
            .create_job(prog_id, "recon-example.com", JobCategory::Recon, None)
            .await
            .unwrap();

        assert_eq!(job.state, JobExecutionState::Queued);
        assert_eq!(job.category, JobCategory::Recon);

        // Start
        let running = engine.start_job(job.id).await.unwrap();
        assert_eq!(running.state, JobExecutionState::Running);
        assert!(running.started_at.is_some());

        // Succeed
        let succeeded = engine.succeed_job(job.id).await.unwrap();
        assert_eq!(succeeded.state, JobExecutionState::Succeeded);
        assert!(succeeded.completed_at.is_some());
    }

    #[tokio::test]
    async fn test_invalid_transitions_rejected() {
        let engine = JobEngine::new();
        let prog_id = ProgramId::new();

        let job = engine
            .create_job(prog_id, "target.com", JobCategory::ToolExecution, None)
            .await
            .unwrap();

        // Cannot succeed a QUEUED job directly
        let res = engine.succeed_job(job.id).await;
        assert!(res.is_err());
        assert!(matches!(
            res.unwrap_err(),
            BountyError::InvalidStateTransition { .. }
        ));
    }

    #[tokio::test]
    async fn test_job_cancellation() {
        let engine = JobEngine::new();
        let prog_id = ProgramId::new();

        let job = engine
            .create_job(prog_id, "test-cancel", JobCategory::Analysis, None)
            .await
            .unwrap();

        let cancelled = engine.cancel_job(job.id).await.unwrap();
        assert_eq!(cancelled.state, JobExecutionState::Cancelled);
    }

    #[tokio::test]
    async fn test_job_timeout_and_retry() {
        let engine = JobEngine::new();
        let prog_id = ProgramId::new();

        let job = engine
            .create_job(prog_id, "target-timeout", JobCategory::Validation, None)
            .await
            .unwrap();

        engine.start_job(job.id).await.unwrap();
        let timed_out = engine.timeout_job(job.id).await.unwrap();
        assert_eq!(timed_out.state, JobExecutionState::Timeout);

        // Retry returns it to QUEUED
        let retried = engine.retry_job(job.id).await.unwrap();
        assert_eq!(retried.state, JobExecutionState::Queued);
        assert_eq!(retried.retry_count, 1);
    }

    #[tokio::test]
    async fn test_parent_child_relationships() {
        let engine = JobEngine::new();
        let prog_id = ProgramId::new();

        let parent = engine
            .create_job(prog_id, "root-recon", JobCategory::Recon, None)
            .await
            .unwrap();

        let child1 = engine
            .create_job(
                prog_id,
                "sub-dns",
                JobCategory::ToolExecution,
                Some(parent.id),
            )
            .await
            .unwrap();

        let child2 = engine
            .create_job(
                prog_id,
                "sub-http",
                JobCategory::ToolExecution,
                Some(parent.id),
            )
            .await
            .unwrap();

        let children = engine.list_child_jobs(parent.id).await;
        assert_eq!(children.len(), 2);
        assert!(children.iter().any(|c| c.id == child1.id));
        assert!(children.iter().any(|c| c.id == child2.id));
    }

    #[tokio::test]
    async fn test_concurrent_job_handling() {
        let engine = JobEngine::new();
        let prog_id = ProgramId::new();

        let mut handles = Vec::new();

        // Spawn 10 concurrent jobs
        for i in 0..10 {
            let eng = engine.clone();
            let target = format!("worker-{i}.target.test");
            let handle = tokio::spawn(async move {
                let job = eng
                    .create_job(prog_id, target, JobCategory::ToolExecution, None)
                    .await
                    .unwrap();

                eng.start_job(job.id).await.unwrap();
                tokio::time::sleep(Duration::from_millis(10)).await;
                eng.succeed_job(job.id).await.unwrap()
            });
            handles.push(handle);
        }

        for h in handles {
            let completed = h.await.unwrap();
            assert_eq!(completed.state, JobExecutionState::Succeeded);
        }

        let all = engine.list_jobs().await;
        assert_eq!(all.len(), 10);
    }
}
