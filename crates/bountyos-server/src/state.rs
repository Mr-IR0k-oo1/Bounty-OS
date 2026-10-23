use crate::config::AppConfig;
use sqlx::PgPool;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::broadcast;

use crate::llm::OllamaClient;

pub type RedisPool = Arc<redis::Client>;

#[derive(Clone)]
pub struct AppState {
    db_pool: PgPool,
    redis_pool: RedisPool,
    config: AppConfig,
    ws_tx: broadcast::Sender<String>,
    /// Ollama client for LLM triage. None when llm.enabled = false.
    llm_client: Option<Arc<OllamaClient>>,
    /// Evidence base directory path (from config.evidence_base_path)
    evidence_base: std::path::PathBuf,
    has_db: bool,
    in_memory_projects: Arc<tokio::sync::RwLock<Vec<crate::models::project::Project>>>,
    in_memory_hunters: Arc<tokio::sync::RwLock<Vec<crate::models::hunter::Hunter>>>,
    in_memory_programs: Arc<tokio::sync::RwLock<Vec<crate::models::program::Program>>>,
    in_memory_scope: Arc<tokio::sync::RwLock<Vec<crate::models::scope::ScopeTarget>>>,
    in_memory_subdomains: Arc<tokio::sync::RwLock<Vec<crate::models::subdomain::Subdomain>>>,
    in_memory_findings: Arc<tokio::sync::RwLock<Vec<crate::models::finding::Finding>>>,
    in_memory_jobs: Arc<tokio::sync::RwLock<Vec<crate::models::scan_job::ScanJob>>>,
    in_memory_investigation_actions: Arc<tokio::sync::RwLock<Vec<crate::models::investigation_action::InvestigationAction>>>,
    in_memory_action_outcomes: Arc<tokio::sync::RwLock<Vec<crate::models::action_outcome::ActionOutcome>>>,
    in_memory_hypotheses: Arc<tokio::sync::RwLock<Vec<crate::models::hypothesis::SecurityHypothesis>>>,
    in_memory_experience: Arc<tokio::sync::RwLock<Vec<crate::models::experience::ExperienceAction>>>,
    in_memory_provenance: Arc<tokio::sync::RwLock<Vec<crate::models::experience::ExperienceProvenance>>>,
    in_memory_target_profiles: Arc<tokio::sync::RwLock<Vec<crate::models::target_profile::TargetProfile>>>,
}

impl AppState {
    pub fn new(
        db_pool: PgPool,
        redis_pool: RedisPool,
        config: AppConfig,
        ws_tx: broadcast::Sender<String>,
        has_db: bool,
    ) -> Self {
        let llm_client = Self::build_llm_client(&config);
        let evidence_base = std::path::PathBuf::from(&config.evidence_base_path);
        let in_memory_projects = Arc::new(tokio::sync::RwLock::new(Self::default_projects()));
        let in_memory_hunters = Arc::new(tokio::sync::RwLock::new(Self::default_hunters()));
        let in_memory_programs = Arc::new(tokio::sync::RwLock::new(Self::default_programs()));
        let in_memory_scope = Arc::new(tokio::sync::RwLock::new(Self::default_scope()));
        let in_memory_subdomains = Arc::new(tokio::sync::RwLock::new(Self::default_subdomains()));
        let in_memory_findings = Arc::new(tokio::sync::RwLock::new(Self::default_findings()));
        let in_memory_jobs = Arc::new(tokio::sync::RwLock::new(Self::default_jobs()));
        let in_memory_investigation_actions = Arc::new(tokio::sync::RwLock::new(Vec::new()));
        let in_memory_action_outcomes = Arc::new(tokio::sync::RwLock::new(Vec::new()));
        let in_memory_hypotheses = Arc::new(tokio::sync::RwLock::new(Vec::new()));
        let in_memory_experience = Arc::new(tokio::sync::RwLock::new(Vec::new()));
        let in_memory_provenance = Arc::new(tokio::sync::RwLock::new(Vec::new()));
        let in_memory_target_profiles = Arc::new(tokio::sync::RwLock::new(Vec::new()));
        Self {
            db_pool,
            redis_pool,
            config,
            ws_tx,
            llm_client,
            evidence_base,
            has_db,
            in_memory_projects,
            in_memory_hunters,
            in_memory_programs,
            in_memory_scope,
            in_memory_subdomains,
            in_memory_findings,
            in_memory_jobs,
            in_memory_investigation_actions,
            in_memory_action_outcomes,
            in_memory_hypotheses,
            in_memory_experience,
            in_memory_provenance,
            in_memory_target_profiles,
        }
    }

    pub fn test_state() -> Self {
        let db_pool = sqlx::PgPool::connect_lazy("postgres://localhost/test").unwrap();
        let redis_client = Arc::new(redis::Client::open("redis://127.0.0.1:6379").unwrap());
        let (ws_tx, _) = broadcast::channel(16);
        let config = crate::config::AppConfig {
            database_url: "postgres://localhost/test".to_string(),
            redis_url: "redis://127.0.0.1:6379".to_string(),
            jwt_secret: "super-secret-key-that-is-long-enough-for-testing".to_string(),
            first_run: false,
            rust_log: "info".to_string(),
            evidence_base_path: "/tmp/bountyos_test_evidence".to_string(),
            host: "127.0.0.1".to_string(),
            port: 8000,
            max_concurrent_jobs: 2,
            llm: crate::config::LlmConfig::default(),
        };
        Self::new(db_pool, redis_client, config, ws_tx, false)
    }

    pub fn has_db(&self) -> bool {
        self.has_db
    }

    pub fn in_memory_projects(
        &self,
    ) -> &Arc<tokio::sync::RwLock<Vec<crate::models::project::Project>>> {
        &self.in_memory_projects
    }

    pub fn in_memory_programs(
        &self,
    ) -> &Arc<tokio::sync::RwLock<Vec<crate::models::program::Program>>> {
        &self.in_memory_programs
    }

    pub fn in_memory_scope(
        &self,
    ) -> &Arc<tokio::sync::RwLock<Vec<crate::models::scope::ScopeTarget>>> {
        &self.in_memory_scope
    }

    pub fn in_memory_subdomains(
        &self,
    ) -> &Arc<tokio::sync::RwLock<Vec<crate::models::subdomain::Subdomain>>> {
        &self.in_memory_subdomains
    }

    pub fn in_memory_findings(
        &self,
    ) -> &Arc<tokio::sync::RwLock<Vec<crate::models::finding::Finding>>> {
        &self.in_memory_findings
    }

    pub async fn find_hunter(&self, username: &str) -> Option<crate::models::hunter::Hunter> {
        let hunters = self.in_memory_hunters.read().await;
        let clean = username.trim();
        hunters.iter().find(|h| h.username.eq_ignore_ascii_case(clean)).cloned()
    }

    pub async fn get_hunter_by_id(&self, id: &uuid::Uuid) -> Option<crate::models::hunter::Hunter> {
        let hunters = self.in_memory_hunters.read().await;
        hunters.iter().find(|h| h.id == *id).cloned()
    }

    fn default_projects() -> Vec<crate::models::project::Project> {
        vec![
            crate::models::project::Project {
                id: uuid::Uuid::parse_str("11111111-1111-1111-1111-111111111111").unwrap(),
                name: "H1 Private Programs — Q1 2025".to_string(),
                description: Some("Top-tier private invite-only programs on HackerOne".to_string()),
                start_date: chrono::NaiveDate::from_ymd_opt(2025, 1, 1),
                end_date: chrono::NaiveDate::from_ymd_opt(2025, 3, 31),
                active: true,
                created_by: None,
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            },
            crate::models::project::Project {
                id: uuid::Uuid::parse_str("22222222-2222-2222-2222-222222222222").unwrap(),
                name: "Client Pentest — Acme Corp".to_string(),
                description: Some(
                    "Quarterly penetration test for Acme Corp infrastructure".to_string(),
                ),
                start_date: chrono::NaiveDate::from_ymd_opt(2025, 2, 15),
                end_date: None,
                active: true,
                created_by: None,
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            },
            crate::models::project::Project {
                id: uuid::Uuid::parse_str("33333333-3333-3333-3333-333333333333").unwrap(),
                name: "Personal Continuous Bug Bounty".to_string(),
                description: Some(
                    "Ongoing personal bug bounty hunting across public programs".to_string(),
                ),
                start_date: chrono::NaiveDate::from_ymd_opt(2024, 6, 1),
                end_date: None,
                active: true,
                created_by: None,
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            },
            crate::models::project::Project {
                id: uuid::Uuid::parse_str("44444444-4444-4444-4444-444444444444").unwrap(),
                name: "Archive — 2024 Programs".to_string(),
                description: Some("Archived programs from 2024".to_string()),
                start_date: chrono::NaiveDate::from_ymd_opt(2024, 1, 1),
                end_date: chrono::NaiveDate::from_ymd_opt(2024, 12, 31),
                active: false,
                created_by: None,
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            },
        ]
    }

    fn default_hunters() -> Vec<crate::models::hunter::Hunter> {
        let admin_hash = crate::auth::password::hash_password("admin")
            .unwrap_or_else(|_| "$argon2id$v=19$m=65536,t=3,p=1$fake$fake".to_string());
        vec![crate::models::hunter::Hunter {
            id: uuid::Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap(),
            username: "admin".to_string(),
            display_name: "Admin Hunter".to_string(),
            role: "admin".to_string(),
            password_hash: admin_hash,
            totp_secret: None,
            totp_enabled: false,
            discord_webhook: None,
            slack_webhook: None,
            email: Some("admin@bountyos.local".to_string()),
            active: true,
            last_login: None,
            created_by: None,
            created_at: chrono::Utc::now(),
        }]
    }

    fn default_programs() -> Vec<crate::models::program::Program> {
        let proj1_id = uuid::Uuid::parse_str("11111111-1111-1111-1111-111111111111").unwrap();
        let proj2_id = uuid::Uuid::parse_str("22222222-2222-2222-2222-222222222222").unwrap();
        vec![
            crate::models::program::Program {
                id: uuid::Uuid::parse_str("a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1").unwrap(),
                project_id: proj1_id,
                name: "Uber".to_string(),
                slug: "uber".to_string(),
                platform: "h1".to_string(),
                program_url: Some("https://hackerone.com/uber".to_string()),
                active: true,
                active_approved: false,
                rescan_interval_hrs: 24,
                notes: Some("Main ride-sharing and food delivery endpoints in scope.".to_string()),
                created_by: None,
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            },
            crate::models::program::Program {
                id: uuid::Uuid::parse_str("b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2").unwrap(),
                project_id: proj1_id,
                name: "Airbnb".to_string(),
                slug: "airbnb".to_string(),
                platform: "bugcrowd".to_string(),
                program_url: Some("https://bugcrowd.com/airbnb".to_string()),
                active: true,
                active_approved: true,
                rescan_interval_hrs: 24,
                notes: Some("Vacation rental and experiences platform.".to_string()),
                created_by: None,
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            },
            crate::models::program::Program {
                id: uuid::Uuid::parse_str("c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3").unwrap(),
                project_id: proj1_id,
                name: "Twitter".to_string(),
                slug: "twitter".to_string(),
                platform: "h1".to_string(),
                program_url: Some("https://hackerone.com/twitter".to_string()),
                active: true,
                active_approved: false,
                rescan_interval_hrs: 24,
                notes: Some("Microblogging and social networking service.".to_string()),
                created_by: None,
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            },
            crate::models::program::Program {
                id: uuid::Uuid::parse_str("d4d4d4d4-d4d4-d4d4-d4d4-d4d4d4d4d4d4").unwrap(),
                project_id: proj2_id,
                name: "Acme Corp Web".to_string(),
                slug: "acme-corp-web".to_string(),
                platform: "other".to_string(),
                program_url: Some("https://acme.local".to_string()),
                active: true,
                active_approved: false,
                rescan_interval_hrs: 12,
                notes: Some("Client infrastructure web assessment.".to_string()),
                created_by: None,
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            },
        ]
    }

    fn default_scope() -> Vec<crate::models::scope::ScopeTarget> {
        let prog1_id = uuid::Uuid::parse_str("a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1").unwrap();
        vec![
            crate::models::scope::ScopeTarget {
                id: uuid::Uuid::parse_str("10000000-0000-0000-0000-000000000001").unwrap(),
                program_id: prog1_id,
                target: "*.uber.com".to_string(),
                target_type: "domain".to_string(),
                out_of_scope: false,
                source: Some("hackerone".to_string()),
                added_by: None,
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            },
            crate::models::scope::ScopeTarget {
                id: uuid::Uuid::parse_str("10000000-0000-0000-0000-000000000002").unwrap(),
                program_id: prog1_id,
                target: "10.0.0.0/24".to_string(),
                target_type: "ip".to_string(),
                out_of_scope: false,
                source: Some("hackerone".to_string()),
                added_by: None,
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            },
            crate::models::scope::ScopeTarget {
                id: uuid::Uuid::parse_str("10000000-0000-0000-0000-000000000003").unwrap(),
                program_id: prog1_id,
                target: "https://auth.uber.com/*".to_string(),
                target_type: "url".to_string(),
                out_of_scope: false,
                source: Some("manual".to_string()),
                added_by: None,
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            },
            crate::models::scope::ScopeTarget {
                id: uuid::Uuid::parse_str("10000000-0000-0000-0000-000000000004").unwrap(),
                program_id: prog1_id,
                target: "*.corp.uber.com".to_string(),
                target_type: "domain".to_string(),
                out_of_scope: true,
                source: Some("hackerone".to_string()),
                added_by: None,
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            },
            crate::models::scope::ScopeTarget {
                id: uuid::Uuid::parse_str("10000000-0000-0000-0000-000000000005").unwrap(),
                program_id: prog1_id,
                target: "192.168.0.0/16".to_string(),
                target_type: "cidr".to_string(),
                out_of_scope: true,
                source: Some("policy".to_string()),
                added_by: None,
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            },
        ]
    }

    fn default_subdomains() -> Vec<crate::models::subdomain::Subdomain> {
        let prog1_id = uuid::Uuid::parse_str("a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1").unwrap();
        vec![
            crate::models::subdomain::Subdomain {
                id: uuid::Uuid::parse_str("20000000-0000-0000-0000-000000000001").unwrap(),
                program_id: prog1_id,
                subdomain: "www.uber.com".to_string(),
                ip_address: Some("104.16.99.52".to_string()),
                status_code: Some(200),
                title: Some("Uber - Get a Ride".to_string()),
                web_server: Some("cloudflare".to_string()),
                content_type: Some("text/html".to_string()),
                content_length: Some(45201),
                tech: vec!["React".to_string(), "Cloudflare".to_string()],
                cdn_name: Some("Cloudflare".to_string()),
                source: "subfinder".to_string(),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            },
            crate::models::subdomain::Subdomain {
                id: uuid::Uuid::parse_str("20000000-0000-0000-0000-000000000002").unwrap(),
                program_id: prog1_id,
                subdomain: "api.uber.com".to_string(),
                ip_address: Some("104.16.98.52".to_string()),
                status_code: Some(403),
                title: Some("403 Forbidden".to_string()),
                web_server: Some("nginx".to_string()),
                content_type: Some("application/json".to_string()),
                content_length: Some(124),
                tech: vec!["nginx".to_string()],
                cdn_name: None,
                source: "subfinder".to_string(),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            },
            crate::models::subdomain::Subdomain {
                id: uuid::Uuid::parse_str("20000000-0000-0000-0000-000000000003").unwrap(),
                program_id: prog1_id,
                subdomain: "auth.uber.com".to_string(),
                ip_address: Some("104.16.97.52".to_string()),
                status_code: Some(200),
                title: Some("Sign In - Uber".to_string()),
                web_server: Some("cloudflare".to_string()),
                content_type: Some("text/html".to_string()),
                content_length: Some(31200),
                tech: vec!["React".to_string(), "Auth0".to_string()],
                cdn_name: Some("Cloudflare".to_string()),
                source: "subfinder".to_string(),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            },
        ]
    }

    fn default_findings() -> Vec<crate::models::finding::Finding> {
        let prog1_id = uuid::Uuid::parse_str("a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1").unwrap();
        vec![
            crate::models::finding::Finding {
                id: uuid::Uuid::parse_str("30000000-0000-0000-0000-000000000001").unwrap(),
                program_id: prog1_id,
                subdomain_id: None,
                title: "SSRF in api.uber.com/internal/health".to_string(),
                description: Some(
                    "Server-Side Request Forgery vulnerability in internal health-check parameter."
                        .to_string(),
                ),
                severity: "critical".to_string(),
                status: "new".to_string(),
                finding_type: "ssrf".to_string(),
                matched_at: Some(
                    "https://api.uber.com/internal/health?url=http://169.254.169.254/".to_string(),
                ),
                curl_command: Some(
                    "curl -s https://api.uber.com/internal/health?url=http://169.254.169.254/"
                        .to_string(),
                ),
                tags: vec!["ssrf".to_string(), "cloud".to_string()],
                assigned_to: None,
                cvss_score: Some(9.1),
                kanban_column: Some("triaged".to_string()),
                duplicate_of: None,
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
                llm_triage_json: None,
                llm_confidence: None,
                llm_triaged_at: None,
            },
            crate::models::finding::Finding {
                id: uuid::Uuid::parse_str("30000000-0000-0000-0000-000000000002").unwrap(),
                program_id: prog1_id,
                subdomain_id: None,
                title: "SQLi at /rides/search?q=".to_string(),
                description: Some(
                    "Boolean-based blind SQL injection in rides search query parameter."
                        .to_string(),
                ),
                severity: "high".to_string(),
                status: "validated".to_string(),
                finding_type: "sqli".to_string(),
                matched_at: Some("https://www.uber.com/rides/search?q=' OR 1=1--".to_string()),
                curl_command: Some(
                    "curl -s 'https://www.uber.com/rides/search?q=%27%20OR%201=1--'".to_string(),
                ),
                tags: vec!["sqli".to_string(), "database".to_string()],
                assigned_to: None,
                cvss_score: Some(8.2),
                kanban_column: Some("validated".to_string()),
                duplicate_of: None,
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
                llm_triage_json: None,
                llm_confidence: None,
                llm_triaged_at: None,
            },
        ]
    }

    fn default_jobs() -> Vec<crate::models::scan_job::ScanJob> {
        use bountyos_common::ScanStage;
        let uber_id = uuid::Uuid::parse_str("a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1").unwrap();
        let airbnb_id = uuid::Uuid::parse_str("b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2").unwrap();
        let now = chrono::Utc::now();

        vec![
            crate::models::scan_job::ScanJob {
                id: uuid::Uuid::parse_str("40000000-0000-0000-0000-000000000001").unwrap(),
                program_id: uber_id,
                stage: ScanStage::Passive,
                status: "running".to_string(),
                subdomain_id: None,
                target: Some("*.uber.com".to_string()),
                flags: Some(serde_json::json!({
                    "tool": "subfinder",
                    "command": "subfinder -d uber.com -silent",
                    "concurrency": 25,
                    "stdout": "[subfinder] Enumerating subdomains for *.uber.com...\n[subfinder] Found api.uber.com\n[subfinder] Found auth.uber.com\n[subfinder] Found www.uber.com",
                    "stderr": ""
                })),
                error_log: None,
                started_at: Some(now - chrono::Duration::minutes(3)),
                completed_at: None,
                created_at: now - chrono::Duration::minutes(3),
                updated_at: now,
            },
            crate::models::scan_job::ScanJob {
                id: uuid::Uuid::parse_str("40000000-0000-0000-0000-000000000002").unwrap(),
                program_id: uber_id,
                stage: ScanStage::Validate,
                status: "queued".to_string(),
                subdomain_id: None,
                target: Some("*.uber.com".to_string()),
                flags: Some(serde_json::json!({
                    "tool": "httpx",
                    "command": "httpx -l targets.txt -title -tech-detect",
                    "concurrency": 50
                })),
                error_log: None,
                started_at: None,
                completed_at: None,
                created_at: now - chrono::Duration::minutes(1),
                updated_at: now - chrono::Duration::minutes(1),
            },
            crate::models::scan_job::ScanJob {
                id: uuid::Uuid::parse_str("40000000-0000-0000-0000-000000000003").unwrap(),
                program_id: uber_id,
                stage: ScanStage::Active,
                status: "done".to_string(),
                subdomain_id: None,
                target: Some("https://auth.uber.com/*".to_string()),
                flags: Some(serde_json::json!({
                    "tool": "katana",
                    "command": "katana -u https://auth.uber.com -d 3",
                    "exit_code": 0,
                    "stdout": "[katana] Crawling https://auth.uber.com\n[katana] Discovered 48 unique endpoints\n[katana] Discovered 12 forms and inputs\n[katana] Finished crawl.",
                    "stderr": "",
                    "evidence_path": "evidence/jobs/katana_auth_uber.json"
                })),
                error_log: None,
                started_at: Some(now - chrono::Duration::minutes(45)),
                completed_at: Some(now - chrono::Duration::minutes(37)),
                created_at: now - chrono::Duration::minutes(45),
                updated_at: now - chrono::Duration::minutes(37),
            },
            crate::models::scan_job::ScanJob {
                id: uuid::Uuid::parse_str("40000000-0000-0000-0000-000000000004").unwrap(),
                program_id: uber_id,
                stage: ScanStage::Vuln,
                status: "failed".to_string(),
                subdomain_id: None,
                target: Some("10.0.0.0/24".to_string()),
                flags: Some(serde_json::json!({
                    "tool": "nuclei",
                    "command": "nuclei -target 10.0.0.0/24 -tags cve,misconfig",
                    "exit_code": 2,
                    "stdout": "[nuclei] Starting vulnerability detection against 10.0.0.0/24...\n[nuclei] Error connecting to target network.",
                    "stderr": "FATAL: Connection timeout to subnet gateway 10.0.0.1. Network unreachable."
                })),
                error_log: Some(
                    "FATAL: Connection timeout to subnet gateway 10.0.0.1. Network unreachable."
                        .to_string(),
                ),
                started_at: Some(now - chrono::Duration::hours(2)),
                completed_at: Some(now - chrono::Duration::hours(2) + chrono::Duration::minutes(4)),
                created_at: now - chrono::Duration::hours(2),
                updated_at: now - chrono::Duration::hours(2) + chrono::Duration::minutes(4),
            },
            crate::models::scan_job::ScanJob {
                id: uuid::Uuid::parse_str("40000000-0000-0000-0000-000000000005").unwrap(),
                program_id: uber_id,
                stage: ScanStage::Active,
                status: "cancelled".to_string(),
                subdomain_id: None,
                target: Some("*.uber.com".to_string()),
                flags: Some(serde_json::json!({
                    "tool": "naabu",
                    "command": "naabu -host api.uber.com -top-ports 1000",
                    "exit_code": 130,
                    "stdout": "[naabu] Initiating port scan on api.uber.com...",
                    "stderr": "[naabu] Received SIGINT. Terminating scan job early upon user request."
                })),
                error_log: Some("Scan manually terminated by operator".to_string()),
                started_at: Some(now - chrono::Duration::hours(5)),
                completed_at: Some(now - chrono::Duration::hours(5) + chrono::Duration::minutes(2)),
                created_at: now - chrono::Duration::hours(5),
                updated_at: now - chrono::Duration::hours(5) + chrono::Duration::minutes(2),
            },
            crate::models::scan_job::ScanJob {
                id: uuid::Uuid::parse_str("40000000-0000-0000-0000-000000000006").unwrap(),
                program_id: airbnb_id,
                stage: ScanStage::Passive,
                status: "timed_out".to_string(),
                subdomain_id: None,
                target: Some("*.airbnb.com".to_string()),
                flags: Some(serde_json::json!({
                    "tool": "subfinder",
                    "command": "subfinder -d airbnb.com -all",
                    "exit_code": 124,
                    "stdout": "[subfinder] Gathering passive OSINT...",
                    "stderr": "TIMEOUT: Operation exceeded execution limit of 600 seconds. Process killed."
                })),
                error_log: Some(
                    "TIMEOUT: Operation exceeded execution limit of 600 seconds. Process killed."
                        .to_string(),
                ),
                started_at: Some(now - chrono::Duration::hours(8)),
                completed_at: Some(
                    now - chrono::Duration::hours(8) + chrono::Duration::minutes(10),
                ),
                created_at: now - chrono::Duration::hours(8),
                updated_at: now - chrono::Duration::hours(8) + chrono::Duration::minutes(10),
            },
        ]
    }

    pub fn in_memory_jobs(
        &self,
    ) -> &Arc<tokio::sync::RwLock<Vec<crate::models::scan_job::ScanJob>>> {
        &self.in_memory_jobs
    }

    pub fn in_memory_investigation_actions(
        &self,
    ) -> &Arc<tokio::sync::RwLock<Vec<crate::models::investigation_action::InvestigationAction>>> {
        &self.in_memory_investigation_actions
    }

    pub fn in_memory_action_outcomes(
        &self,
    ) -> &Arc<tokio::sync::RwLock<Vec<crate::models::action_outcome::ActionOutcome>>> {
        &self.in_memory_action_outcomes
    }

    pub fn in_memory_hypotheses(
        &self,
    ) -> &Arc<tokio::sync::RwLock<Vec<crate::models::hypothesis::SecurityHypothesis>>> {
        &self.in_memory_hypotheses
    }

    pub fn in_memory_experience(
        &self,
    ) -> &Arc<tokio::sync::RwLock<Vec<crate::models::experience::ExperienceAction>>> {
        &self.in_memory_experience
    }

    pub fn in_memory_provenance(
        &self,
    ) -> &Arc<tokio::sync::RwLock<Vec<crate::models::experience::ExperienceProvenance>>> {
        &self.in_memory_provenance
    }

    pub fn in_memory_target_profiles(
        &self,
    ) -> &Arc<tokio::sync::RwLock<Vec<crate::models::target_profile::TargetProfile>>> {
        &self.in_memory_target_profiles
    }

    pub fn db(&self) -> &PgPool {
        &self.db_pool
    }

    pub fn db_pool(&self) -> &PgPool {
        &self.db_pool
    }

    pub fn redis(&self) -> &redis::Client {
        &self.redis_pool
    }

    pub fn redis_pool(&self) -> &RedisPool {
        &self.redis_pool
    }

    pub fn redis_arc(&self) -> RedisPool {
        self.redis_pool.clone()
    }

    pub fn config(&self) -> &AppConfig {
        &self.config
    }

    pub fn ws_tx(&self) -> &broadcast::Sender<String> {
        &self.ws_tx
    }

    pub fn evidence_base(&self) -> &std::path::PathBuf {
        &self.evidence_base
    }

    pub fn llm_client(&self) -> Option<&Arc<OllamaClient>> {
        self.llm_client.as_ref()
    }

    /// Build the LLM client from config, if enabled.
    pub fn build_llm_client(config: &AppConfig) -> Option<Arc<OllamaClient>> {
        if !config.llm.enabled {
            return None;
        }

        Some(Arc::new(OllamaClient::new(
            &config.llm.ollama_url,
            &config.llm.model,
            Duration::from_secs(config.llm.timeout_secs),
        )))
    }
}
