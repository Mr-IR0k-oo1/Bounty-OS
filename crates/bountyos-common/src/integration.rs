use crate::errors::BountyError;
use crate::findings_engine::{CandidateFindingSpec, EvidenceStore, FindingsEngine};
use crate::ids::{AssetId, FindingId, JobId, ProgramId, ReportId, ScopeId, TargetId};
use crate::job_engine::JobEngine;
use crate::model_gateway::ModelGateway;
use crate::models::{Asset, Evidence, EvidenceType, Finding, Job, Program, Report, Scope, Target};
use crate::recon_pipeline::{
    InMemoryAssetStore, ReconPipeline, ReconPipelineResult, ReconStepExecutor,
};
use crate::scope::ScopePolicy;
use crate::types::{Platform, ScopeType};
use crate::validation_engine::{
    ValidationDriver, ValidationEngine, ValidationPlan, ValidationResult,
};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

/// Unified Bounty OS End-to-End System Integration Service
#[derive(Clone)]
pub struct BountySystem {
    programs: Arc<RwLock<HashMap<ProgramId, Program>>>,
    scopes: Arc<RwLock<HashMap<ScopeId, Scope>>>,
    targets: Arc<RwLock<HashMap<TargetId, Target>>>,
    reports: Arc<RwLock<HashMap<ReportId, Report>>>,
    validation_results: Arc<RwLock<HashMap<Uuid, ValidationResult>>>,
    scope_policies: Arc<RwLock<HashMap<ProgramId, ScopePolicy>>>,
    job_engine: JobEngine,
    asset_store: InMemoryAssetStore,
    evidence_store: EvidenceStore,
    findings_engine: FindingsEngine,
    validation_engine: ValidationEngine,
    model_gateway: ModelGateway,
}

impl Default for BountySystem {
    fn default() -> Self {
        Self::new()
    }
}

impl BountySystem {
    pub fn new() -> Self {
        let job_engine = JobEngine::new();
        let asset_store = InMemoryAssetStore::new();
        let evidence_store = EvidenceStore::new();
        let findings_engine = FindingsEngine::new(evidence_store.clone());
        let validation_engine = ValidationEngine::new(findings_engine.clone());
        let model_gateway = ModelGateway::with_model("VulnLLM-R-7B");

        Self {
            programs: Arc::new(RwLock::new(HashMap::new())),
            scopes: Arc::new(RwLock::new(HashMap::new())),
            targets: Arc::new(RwLock::new(HashMap::new())),
            reports: Arc::new(RwLock::new(HashMap::new())),
            validation_results: Arc::new(RwLock::new(HashMap::new())),
            scope_policies: Arc::new(RwLock::new(HashMap::new())),
            job_engine,
            asset_store,
            evidence_store,
            findings_engine,
            validation_engine,
            model_gateway,
        }
    }

    // ------------------------------------------------------------------------
    // Program Management
    // ------------------------------------------------------------------------

    pub async fn create_program(&self, name: impl Into<String>, platform: Platform) -> Program {
        let program = Program::new(name, platform);
        let mut progs = self.programs.write().await;
        progs.insert(program.id, program.clone());

        let mut policies = self.scope_policies.write().await;
        policies.insert(program.id, ScopePolicy::new(program.id));

        program
    }

    pub async fn get_program(&self, id: ProgramId) -> Option<Program> {
        let progs = self.programs.read().await;
        progs.get(&id).cloned()
    }

    // ------------------------------------------------------------------------
    // Scope Management
    // ------------------------------------------------------------------------

    pub async fn create_scope(
        &self,
        program_id: ProgramId,
        target: impl Into<String>,
        scope_type: ScopeType,
        is_in_scope: bool,
    ) -> Result<Scope, BountyError> {
        let scope = Scope::new(program_id, target, scope_type, is_in_scope)?;

        // Update active program policy
        {
            let mut policies = self.scope_policies.write().await;
            if let Some(policy) = policies.get_mut(&program_id) {
                if is_in_scope {
                    policy.add_inclusion(&scope.target, scope_type);
                } else {
                    policy.add_exclusion(&scope.target, scope_type);
                }
            }
        }

        let mut scopes = self.scopes.write().await;
        scopes.insert(scope.id, scope.clone());
        Ok(scope)
    }

    pub async fn get_policy(&self, program_id: ProgramId) -> Option<ScopePolicy> {
        let policies = self.scope_policies.read().await;
        policies.get(&program_id).cloned()
    }

    // ------------------------------------------------------------------------
    // Target Management
    // ------------------------------------------------------------------------

    pub async fn create_target(
        &self,
        program_id: ProgramId,
        identifier: impl Into<String>,
    ) -> Result<Target, BountyError> {
        let target = Target::new(program_id, identifier)?;

        // Enforce that target is allowed by program policy
        let policy = self.get_policy(program_id).await.ok_or_else(|| {
            BountyError::NotFound(format!("Policy for program {} not found", program_id))
        })?;

        policy.enforce(&target.identifier)?;

        let mut targets = self.targets.write().await;
        targets.insert(target.id, target.clone());
        Ok(target)
    }

    // ------------------------------------------------------------------------
    // Recon Orchestration
    // ------------------------------------------------------------------------

    pub async fn start_recon<E: ReconStepExecutor>(
        &self,
        program_id: ProgramId,
        target_str: &str,
        executor: &E,
    ) -> Result<ReconPipelineResult, BountyError> {
        let policy = self.get_policy(program_id).await.ok_or_else(|| {
            BountyError::NotFound(format!("Policy for program {} not found", program_id))
        })?;

        let pipeline = ReconPipeline::new(self.job_engine.clone(), self.asset_store.clone());
        pipeline
            .run(target_str, program_id, &policy, executor)
            .await
    }

    pub async fn inspect_job(&self, job_id: JobId) -> Option<Job> {
        self.job_engine.get_job(job_id).await
    }

    // ------------------------------------------------------------------------
    // Asset Management
    // ------------------------------------------------------------------------

    pub async fn list_assets(&self, program_id: ProgramId) -> Vec<Asset> {
        let all = self.asset_store.get_all().await;
        all.into_iter()
            .filter(|a| a.program_id == program_id)
            .collect()
    }

    pub async fn inspect_asset(&self, asset_id: AssetId) -> Option<Asset> {
        let all = self.asset_store.get_all().await;
        all.into_iter().find(|a| a.id == asset_id)
    }

    // ------------------------------------------------------------------------
    // Findings & Evidence Management
    // ------------------------------------------------------------------------

    pub async fn create_candidate_finding(
        &self,
        spec: CandidateFindingSpec,
    ) -> Result<Finding, BountyError> {
        self.findings_engine.create_candidate(spec).await
    }

    pub async fn list_findings(&self, program_id: ProgramId) -> Vec<Finding> {
        let all = self.findings_engine.list_findings().await;
        all.into_iter()
            .filter(|f| f.program_id == program_id)
            .collect()
    }

    pub async fn inspect_finding(&self, finding_id: FindingId) -> Option<Finding> {
        self.findings_engine.get_finding(finding_id).await
    }

    pub async fn attach_evidence(
        &self,
        finding_id: FindingId,
        evidence_type: EvidenceType,
        content_type: impl Into<String>,
        raw_bytes: &[u8],
    ) -> Result<Evidence, BountyError> {
        self.findings_engine
            .attach_new_evidence(finding_id, evidence_type, content_type, raw_bytes)
            .await
    }

    // ------------------------------------------------------------------------
    // Validation Orchestration
    // ------------------------------------------------------------------------

    pub async fn start_validation<D: ValidationDriver>(
        &self,
        plan: &ValidationPlan,
        driver: &D,
    ) -> Result<ValidationResult, BountyError> {
        let finding = self.inspect_finding(plan.finding_id).await.ok_or_else(|| {
            BountyError::NotFound(format!("Finding {} not found", plan.finding_id))
        })?;

        let policy = self.get_policy(finding.program_id).await.ok_or_else(|| {
            BountyError::NotFound(format!(
                "Policy for program {} not found",
                finding.program_id
            ))
        })?;

        let result = self
            .validation_engine
            .validate_candidate(plan, &policy, driver)
            .await?;

        let mut val_results = self.validation_results.write().await;
        val_results.insert(plan.id, result.clone());
        Ok(result)
    }

    pub async fn inspect_validation(&self, plan_id: Uuid) -> Option<ValidationResult> {
        let val_results = self.validation_results.read().await;
        val_results.get(&plan_id).cloned()
    }

    // ------------------------------------------------------------------------
    // Reporting
    // ------------------------------------------------------------------------

    pub async fn generate_report(
        &self,
        program_id: ProgramId,
        title: impl Into<String>,
        finding_ids: Vec<FindingId>,
        summary: impl Into<String>,
    ) -> Result<Report, BountyError> {
        let mut report = Report::new(program_id, title, finding_ids, summary)?;
        report.status = crate::models::ReportStatus::Ready;

        let mut reports = self.reports.write().await;
        reports.insert(report.id, report.clone());
        Ok(report)
    }

    pub fn model_gateway(&self) -> &ModelGateway {
        &self.model_gateway
    }

    pub fn evidence_store(&self) -> &EvidenceStore {
        &self.evidence_store
    }

    pub fn findings_engine(&self) -> &FindingsEngine {
        &self.findings_engine
    }

    pub fn validation_engine(&self) -> &ValidationEngine {
        &self.validation_engine
    }

    pub fn asset_store(&self) -> &InMemoryAssetStore {
        &self.asset_store
    }

    pub fn job_engine(&self) -> &JobEngine {
        &self.job_engine
    }
}

// ============================================================================
// End-To-End Comprehensive Integration Test
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::FindingLifecycleStatus;
    use crate::recon_pipeline::ReconStepExecutor;
    use crate::types::Severity;
    use crate::validation_engine::{
        StepExecutionOutput, ValidationOutcome, ValidationStep, ValidationTestType,
    };

    struct ControlledMockReconExecutor;

    #[async_trait::async_trait]
    impl ReconStepExecutor for ControlledMockReconExecutor {
        async fn discover_subdomains(&self, _target: &str) -> Result<String, BountyError> {
            Ok("api.target.com\nauth.target.com\nforbidden.target.com\n".to_string())
        }

        async fn resolve_dns(&self, _subdomains: &[String]) -> Result<String, BountyError> {
            Ok(r#"
                {"host":"api.target.com","a":["104.21.5.12"]}
                {"host":"auth.target.com","a":["104.21.5.13"]}
            "#
            .to_string())
        }

        async fn probe_http(&self, _targets: &[String]) -> Result<String, BountyError> {
            Ok(r#"
                {"url":"https://api.target.com/v1","status_code":200,"title":"API"}
                {"url":"https://auth.target.com/login","status_code":200,"title":"Login"}
            "#
            .to_string())
        }
    }

    struct ControlledMockValidationDriver {
        response_body: Vec<u8>,
    }

    #[async_trait::async_trait]
    impl ValidationDriver for ControlledMockValidationDriver {
        async fn execute_step(
            &self,
            _target: &str,
            _endpoint: Option<&str>,
            _step: &ValidationStep,
        ) -> Result<StepExecutionOutput, BountyError> {
            Ok(StepExecutionOutput {
                status_code: 200,
                headers: vec![("Content-Type".into(), "application/json".into())],
                body: self.response_body.clone(),
            })
        }
    }

    #[tokio::test]
    async fn test_full_bounty_os_end_to_end_flow() {
        let system = BountySystem::new();

        // 1. Program Created
        let program = system.create_program("Acme Bug Bounty", Platform::H1).await;
        assert_eq!(program.name, "Acme Bug Bounty");

        // 2. Scope Enforced (Include *.target.com, Exclude forbidden.target.com)
        system
            .create_scope(program.id, "*.target.com", ScopeType::Wildcard, true)
            .await
            .unwrap();
        system
            .create_scope(program.id, "forbidden.target.com", ScopeType::Domain, false)
            .await
            .unwrap();

        // 3. Target Accepted
        let target = system
            .create_target(program.id, "target.com")
            .await
            .unwrap();
        assert_eq!(target.identifier, "target.com");

        // Attempting to create out-of-scope target fails immediately
        let evil_target = system.create_target(program.id, "evil.com").await;
        assert!(evil_target.is_err());
        assert!(matches!(
            evil_target.unwrap_err(),
            BountyError::ScopeViolation(_)
        ));

        // 4. Recon Job Created & Executed
        let recon_result = system
            .start_recon(program.id, "target.com", &ControlledMockReconExecutor)
            .await
            .unwrap();
        assert_eq!(
            recon_result.root_job.state,
            crate::models::JobExecutionState::Succeeded
        );
        assert!(system.inspect_job(recon_result.root_job.id).await.is_some());

        // 5. Assets Produced & Exclusions Respected
        let assets = system.list_assets(program.id).await;
        let asset_values: Vec<String> = assets.iter().map(|a| a.value.clone()).collect();
        assert!(asset_values.contains(&"target.com".to_string()));
        assert!(asset_values.contains(&"api.target.com".to_string()));
        assert!(asset_values.contains(&"auth.target.com".to_string()));
        assert!(asset_values.contains(&"104.21.5.12".to_string()));
        assert!(asset_values.contains(&"https://api.target.com/v1".to_string()));
        // Excluded asset was NOT stored
        assert!(!asset_values.contains(&"forbidden.target.com".to_string()));

        // Inspect single asset
        let first_asset = assets.first().unwrap();
        let inspected = system.inspect_asset(first_asset.id).await;
        assert!(inspected.is_some());

        // 6. Candidate Finding Created (Using Model Gateway untrusted hypothesis)
        let raw_model_response = r#"{
            "target": "api.target.com",
            "vuln_class": "CWE-89",
            "hypothesis": "SQL injection in parameter id",
            "confidence": 0.85,
            "proposed_validation_step": "Send probe ' OR '1'='1",
            "required_evidence_type": "HTTP_RESPONSE"
        }"#;

        let model_hyp = system
            .model_gateway()
            .parse_model_response(raw_model_response, "api.target.com")
            .unwrap();

        let candidate = system
            .create_candidate_finding(CandidateFindingSpec {
                program_id: program.id,
                target_id: Some(target.id),
                endpoint: Some("/v1".into()),
                title: "SQL Injection in User Search".into(),
                vuln_class: model_hyp.vuln_class,
                severity: Severity::Critical,
                hypothesis: model_hyp.hypothesis,
                confidence: model_hyp.confidence,
                proposed_validation: model_hyp.proposed_validation_step,
                required_evidence: model_hyp.required_evidence_type,
                source_model_run: Some(model_hyp.model_id),
            })
            .await
            .unwrap();

        assert_eq!(candidate.status, FindingLifecycleStatus::Candidate);

        // 7. Validation Runs
        let validation_plan = ValidationPlan::new(
            candidate.id,
            "api.target.com",
            Some("/v1".into()),
            vec![ValidationStep {
                name: "Probe SQL error".into(),
                test_type: ValidationTestType::ResponseBodyContains,
                expected_status: Some(200),
                expected_pattern: Some("syntax error in SQL".into()),
                expected_header: None,
            }],
            EvidenceType::HttpResponse,
            "deterministic",
        )
        .unwrap();

        let driver = ControlledMockValidationDriver {
            response_body: b"{\"error\":\"syntax error in SQL query at line 1\"}".to_vec(),
        };

        let val_result = system
            .start_validation(&validation_plan, &driver)
            .await
            .unwrap();
        assert_eq!(val_result.outcome, ValidationOutcome::Confirmed);

        // Inspect validation
        let val_inspect = system.inspect_validation(validation_plan.id).await;
        assert!(val_inspect.is_some());

        // 8. Finding becomes CONFIRMED only when validation succeeds
        let confirmed_finding = system.inspect_finding(candidate.id).await.unwrap();
        assert_eq!(confirmed_finding.status, FindingLifecycleStatus::Confirmed);
        assert!(!confirmed_finding.evidence_ids.is_empty());

        // 9. Report Generated
        let report = system
            .generate_report(
                program.id,
                "Acme Security Assessment Report",
                vec![confirmed_finding.id],
                "Executive Summary: Confirmed SQL Injection finding in api.target.com/v1 with verified evidence.",
            )
            .await
            .unwrap();

        assert_eq!(report.status, crate::models::ReportStatus::Ready);
        assert_eq!(report.finding_ids, vec![confirmed_finding.id]);
    }
}
