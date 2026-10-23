//! Application router and middleware setup

use axum::{
    routing::{delete, get, post, put},
    Router,
};
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

use crate::config::AppConfig;
use crate::state::AppState;
use tokio::sync::broadcast;

/// Creates the main application router
pub fn create_router(
    db_pool: sqlx::PgPool,
    redis_pool: crate::redis::RedisPool,
    config: AppConfig,
    ws_tx: broadcast::Sender<String>,
    has_db: bool,
) -> Router {
    // Create shared state
    let shared_state = AppState::new(db_pool, redis_pool, config, ws_tx, has_db);

    let audit_layer = axum::middleware::from_fn_with_state(
        shared_state.clone(),
        crate::middleware::audit::audit_middleware,
    );
    let login_limiter = tower::ServiceBuilder::new()
        .layer(axum::error_handling::HandleErrorLayer::new(
            |e: axum::BoxError| async move { tower_governor::errors::display_error(e) },
        ))
        .layer(crate::middleware::rate_limit::login_rate_limit_layer())
        .layer(audit_layer.clone());

    let state_change_limiter = tower::ServiceBuilder::new()
        .layer(axum::error_handling::HandleErrorLayer::new(
            |e: axum::BoxError| async move { tower_governor::errors::display_error(e) },
        ))
        .layer(crate::middleware::rate_limit::rate_limit_layer());

    let refresh_limiter = tower::ServiceBuilder::new()
        .layer(axum::error_handling::HandleErrorLayer::new(
            |e: axum::BoxError| async move { tower_governor::errors::display_error(e) },
        ))
        .layer(crate::middleware::rate_limit::rate_limit_layer())
        .layer(audit_layer.clone());

    // Public routes (no authentication required)
    let public_router = Router::new()
        .route("/health", get(api_health))
        .route("/health/doctor", get(api_doctor))
        .route(
            "/auth/login",
            post(crate::auth::handlers::login).layer(login_limiter),
        )
        .route(
            "/auth/refresh",
            post(crate::auth::handlers::refresh).layer(refresh_limiter),
        )
        .route(
            "/auth/setup",
            post(crate::auth::handlers::setup).layer(state_change_limiter.clone()),
        )
        .route(
            "/auth/2fa/verify",
            post(crate::auth::handlers::verify_2fa).layer(state_change_limiter.clone()),
        )
        // WebSocket route (not globally protected yet per spec)
        .route("/ws/jobs/:id", get(crate::handlers::ws::ws_handler))
        // Static evidence route
        .route(
            "/evidence/*path",
            get(crate::handlers::static_files::serve_evidence),
        )
        // Intelligence routes
        .route(
            "/investigations/plan",
            post(crate::handlers::intelligence::plan_investigation),
        )
        .route(
            "/investigations/:id/plan",
            get(crate::handlers::intelligence::get_investigation_plan),
        )
        .route(
            "/investigations/run",
            post(crate::handlers::intelligence::run_investigation),
        )
        .route(
            "/investigations/:id/run",
            post(crate::handlers::intelligence::run_investigation_by_id),
        )
        .route(
            "/investigations/:id/actions",
            get(crate::handlers::intelligence::get_investigation_actions),
        )
        .route(
            "/investigations/:id/outcomes",
            get(crate::handlers::intelligence::get_investigation_outcomes),
        )
        .route(
            "/investigations/:id/hypotheses",
            get(crate::handlers::intelligence::get_investigation_hypotheses)
                .post(crate::handlers::intelligence::create_investigation_hypothesis),
        )
        .route(
            "/investigations/:id/context",
            get(crate::handlers::intelligence::get_investigation_context),
        )
        .route(
            "/investigations/:id/hypothesize",
            post(crate::handlers::intelligence::submit_investigation_hypotheses),
        )
        .route(
            "/investigations/:id/prioritize",
            post(crate::handlers::intelligence::prioritize_investigation_hypotheses),
        )
        .route(
            "/intelligence/action-values",
            get(crate::handlers::intelligence::get_action_values),
        )
        .route(
            "/investigations/:id/pause",
            post(crate::handlers::intelligence::pause_investigation),
        )
        .route(
            "/investigations/:id/resume",
            post(crate::handlers::intelligence::resume_investigation),
        )
        .route(
            "/investigations/:id/archetype",
            get(crate::handlers::intelligence::get_investigation_archetype),
        )
        .route(
            "/investigations/:id/profile",
            get(crate::handlers::intelligence::get_investigation_profile),
        )
        .route(
            "/investigations/:id/policy",
            get(crate::handlers::intelligence::get_investigation_policy),
        )
        .route(
            "/experience/actions",
            get(crate::handlers::intelligence::get_experience_actions),
        )
        .route(
            "/experience/provenance",
            get(crate::handlers::intelligence::get_experience_provenance),
        )
        .route(
            "/investigations/:id/stop",
            post(crate::handlers::intelligence::stop_investigation),
        )
        .route(
            "/investigations/:id/education",
            get(crate::handlers::intelligence::get_investigation_education),
        )
        .route(
            "/investigations/:id/threats",
            get(crate::handlers::intelligence::get_investigation_threats),
        )
        .route(
            "/investigations/:id/prioritization",
            get(crate::handlers::intelligence::get_investigation_prioritization),
        )
        .route(
            "/investigations/:id/behavior",
            post(crate::handlers::intelligence::analyze_investigation_behavior),
        )
        .route(
            "/investigations/:id/flows/replay",
            post(crate::handlers::intelligence::replay_investigation_flow),
        )
        .route(
            "/investigations/:id/authz/test",
            post(crate::handlers::intelligence::test_investigation_authz),
        )
        .route(
            "/investigations/:id/adaptive-plan",
            get(crate::handlers::intelligence::get_adaptive_plan)
                .post(crate::handlers::intelligence::get_adaptive_plan),
        )
        .route(
            "/investigations/:id/next-action",
            get(crate::handlers::intelligence::get_next_action),
        )
        .route(
            "/investigations/:id/explain-decision",
            get(crate::handlers::intelligence::explain_decision),
        )
        .route(
            "/investigations/:id/replan",
            post(crate::handlers::intelligence::replan_investigation),
        )
        .route(
            "/investigations/:id/executions",
            post(crate::handlers::intelligence::record_execution),
        )
        .route(
            "/investigations/:id/decisions",
            get(crate::handlers::intelligence::list_investigation_decisions),
        );

    // Protected routes (require valid JWT access token)
    let protected_router = Router::new()
        // Authenticated auth routes
        .route(
            "/auth/logout",
            post(crate::auth::handlers::logout).layer(state_change_limiter.clone()),
        )
        .route(
            "/auth/2fa/setup",
            post(crate::auth::handlers::setup_2fa).layer(state_change_limiter.clone()),
        )
        .route(
            "/auth/2fa/disable",
            post(crate::auth::handlers::disable_2fa).layer(state_change_limiter.clone()),
        )
        .route(
            "/auth/password",
            post(crate::auth::handlers::change_password).layer(state_change_limiter.clone()),
        )
        .route("/auth/me", get(crate::auth::handlers::me))
        // Project routes
        .route("/projects", get(crate::handlers::projects::list_projects))
        .route(
            "/projects",
            post(crate::handlers::projects::create_project).layer(state_change_limiter.clone()),
        )
        .route("/projects/:id", get(crate::handlers::projects::get_project))
        .route(
            "/projects/:id",
            put(crate::handlers::projects::update_project).layer(state_change_limiter.clone()),
        )
        .route(
            "/projects/:id",
            delete(crate::handlers::projects::delete_project).layer(state_change_limiter.clone()),
        )
        // Program routes
        .route(
            "/programs",
            get(crate::handlers::programs::list_all_programs),
        )
        .route(
            "/projects/:id/programs",
            get(crate::handlers::programs::list_programs),
        )
        .route(
            "/projects/:id/programs",
            post(crate::handlers::programs::create_program).layer(state_change_limiter.clone()),
        )
        .route("/programs/:id", get(crate::handlers::programs::get_program))
        .route(
            "/programs/:id",
            put(crate::handlers::programs::update_program).layer(state_change_limiter.clone()),
        )
        .route(
            "/programs/:id",
            delete(crate::handlers::programs::delete_program).layer(state_change_limiter.clone()),
        )
        .route(
            "/programs/:id/approve",
            post(crate::handlers::programs::approve_program).layer(state_change_limiter.clone()),
        )
        .route(
            "/programs/:id/scan",
            post(crate::handlers::programs::scan_program).layer(state_change_limiter.clone()),
        )
        .route(
            "/programs/:id/report",
            get(crate::handlers::reports::generate_report),
        )
        // Scope routes
        .route(
            "/programs/:id/scope",
            get(crate::handlers::scope::list_scope),
        )
        .route(
            "/programs/:id/scope",
            post(crate::handlers::scope::add_scope).layer(state_change_limiter.clone()),
        )
        .route(
            "/scope/:id",
            put(crate::handlers::scope::update_scope).layer(state_change_limiter.clone()),
        )
        .route(
            "/scope/:id",
            delete(crate::handlers::scope::delete_scope).layer(state_change_limiter.clone()),
        )
        .route(
            "/programs/:id/scope/import",
            post(crate::handlers::scope::import_scope).layer(state_change_limiter.clone()),
        )
        .route(
            "/programs/:id/scope/check",
            get(crate::handlers::scope::check_scope_endpoint),
        )
        // Subdomain routes
        .route(
            "/programs/:id/subdomains",
            get(crate::handlers::subdomains::list_subdomains),
        )
        .route(
            "/subdomains/:id",
            get(crate::handlers::subdomains::get_subdomain),
        )
        // Port routes
        .route(
            "/subdomains/:id/ports",
            get(crate::handlers::ports::list_ports),
        )
        .route(
            "/programs/:id/ports",
            get(crate::handlers::ports::list_program_ports),
        )
        // URL routes
        .route(
            "/programs/:id/urls",
            get(crate::handlers::urls::list_urls)
                .post(crate::handlers::urls::create_url)
                .layer(state_change_limiter.clone()),
        )
        // Finding routes
        .route("/findings", get(crate::handlers::findings::list_findings))
        .route(
            "/findings",
            post(crate::handlers::findings::create_finding).layer(state_change_limiter.clone()),
        )
        .route(
            "/projects/:id/findings",
            get(crate::handlers::findings::list_project_findings),
        )
        .route(
            "/programs/:id/findings",
            get(crate::handlers::findings::list_program_findings),
        )
        .route("/findings/:id", get(crate::handlers::findings::get_finding))
        .route(
            "/findings/:id",
            put(crate::handlers::findings::update_finding).layer(state_change_limiter.clone()),
        )
        .route(
            "/findings/:id",
            delete(crate::handlers::findings::delete_finding).layer(state_change_limiter.clone()),
        )
        .route(
            "/findings/:id/claim",
            post(crate::handlers::findings::claim_finding).layer(state_change_limiter.clone()),
        )
        .route(
            "/findings/:id/validate",
            post(crate::handlers::findings::validate_finding).layer(state_change_limiter.clone()),
        )
        .route(
            "/findings/:id/report",
            post(crate::handlers::findings::report_finding).layer(state_change_limiter.clone()),
        )
        // LLM triage routes
        .route(
            "/findings/:id/triage",
            post(crate::handlers::findings::triage_finding).layer(state_change_limiter.clone()),
        )
        .route(
            "/findings/:id/triage",
            get(crate::handlers::findings::get_finding_triage),
        )
        // Kanban (finding-level)
        .route(
            "/findings/:id/kanban",
            put(crate::handlers::findings::move_finding_kanban).layer(state_change_limiter.clone()),
        )
        // Job routes
        .route("/jobs", get(crate::handlers::jobs::list_jobs))
        .route(
            "/jobs",
            post(crate::handlers::jobs::create_job).layer(state_change_limiter.clone()),
        )
        .route(
            "/programs/:id/jobs",
            get(crate::handlers::jobs::list_program_jobs),
        )
        .route(
            "/programs/:id/jobs",
            post(crate::handlers::jobs::create_program_job).layer(state_change_limiter.clone()),
        )
        .route("/jobs/:id", get(crate::handlers::jobs::get_job))
        .route(
            "/jobs/:id",
            delete(crate::handlers::jobs::cancel_job).layer(state_change_limiter.clone()),
        )
        .route("/jobs/:id/logs", get(crate::handlers::jobs::get_job_logs))
        .route(
            "/jobs/:id/artifacts",
            get(crate::handlers::jobs::get_job_artifacts),
        )
        // Hunter routes
        .route("/hunters", get(crate::handlers::hunters::list_hunters))
        .route(
            "/hunters",
            post(crate::handlers::hunters::create_hunter).layer(state_change_limiter.clone()),
        )
        .route(
            "/hunters/:id",
            put(crate::handlers::hunters::update_hunter).layer(state_change_limiter.clone()),
        )
        .route(
            "/hunters/:id",
            delete(crate::handlers::hunters::delete_hunter).layer(state_change_limiter.clone()),
        )
        // Token routes
        .route("/tokens", get(crate::handlers::tokens::list_tokens))
        .route(
            "/tokens",
            post(crate::handlers::tokens::create_token).layer(state_change_limiter.clone()),
        )
        .route(
            "/tokens/:id",
            delete(crate::handlers::tokens::delete_token).layer(state_change_limiter.clone()),
        )
        // Settings routes
        .route("/settings", get(crate::handlers::settings::get_settings))
        .route(
            "/settings",
            put(crate::handlers::settings::update_settings).layer(state_change_limiter.clone()),
        )
        .route(
            "/settings/tools/check",
            post(crate::handlers::settings::check_tools).layer(state_change_limiter.clone()),
        )
        .route_layer(audit_layer)
        .route_layer(axum::middleware::from_fn_with_state(
            shared_state.clone(),
            crate::auth::middleware::auth_middleware,
        ));

    public_router
        .merge(protected_router)
        .with_state(shared_state)
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive())
}

async fn api_health() -> &'static str {
    "OK"
}

async fn api_doctor(
    axum::extract::State(state): axum::extract::State<AppState>,
) -> axum::Json<serde_json::Value> {
    let mut db_status = "connected";
    let db_ok = if state.has_db() {
        sqlx::query("SELECT 1").execute(state.db()).await.is_ok()
    } else {
        false
    };
    if !db_ok {
        db_status = "disconnected";
    }

    let tools = crate::pipeline::tools::ToolRegistry::check_all().await;
    let evidence_exists = state.evidence_base().is_dir();

    axum::Json(serde_json::json!({
        "status": if db_ok { "healthy" } else { "degraded" },
        "subsystems": {
            "api": { "status": "ok", "version": "2.0.0" },
            "database": { "status": db_status, "type": "postgresql" },
            "redis": { "status": "ok" },
            "evidence_store": {
                "status": if evidence_exists { "ok" } else { "warning" },
                "path": state.evidence_base().to_string_lossy(),
            },
            "vulnllm": {
                "enabled": state.llm_client().is_some(),
                "status": if state.llm_client().is_some() { "ready" } else { "offline_fallback_active" }
            },
            "workers": {
                "max_concurrency": state.config().max_concurrent_jobs,
                "status": "ready"
            }
        },
        "tools": tools,
    }))
}
