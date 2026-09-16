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
) -> Router {
    // Create shared state
    let shared_state = AppState::new(db_pool, redis_pool, config, ws_tx);

    // Public routes (no authentication required)
    let public_router = Router::new()
        .route("/health", get(api_health))
        .route("/auth/login", post(crate::auth::handlers::login))
        .route("/auth/refresh", post(crate::auth::handlers::refresh))
        // WebSocket route (not globally protected yet per spec)
        .route("/ws/jobs/:id", get(crate::handlers::ws::ws_handler))
        // Static evidence route
        .route(
            "/evidence/*path",
            get(crate::handlers::static_files::serve_evidence),
        );

    // Protected routes (require valid JWT access token)
    let protected_router = Router::new()
        // Authenticated auth routes
        .route("/auth/logout", post(crate::auth::handlers::logout))
        .route("/auth/2fa/setup", post(crate::auth::handlers::setup_2fa))
        .route("/auth/2fa/verify", post(crate::auth::handlers::verify_2fa))
        .route("/auth/me", get(crate::auth::handlers::me))
        // Project routes
        .route("/projects", get(crate::handlers::projects::list_projects))
        .route("/projects", post(crate::handlers::projects::create_project))
        .route("/projects/:id", get(crate::handlers::projects::get_project))
        .route(
            "/projects/:id",
            put(crate::handlers::projects::update_project),
        )
        .route(
            "/projects/:id",
            delete(crate::handlers::projects::delete_project),
        )
        // Program routes
        .route(
            "/projects/:id/programs",
            get(crate::handlers::programs::list_programs),
        )
        .route(
            "/projects/:id/programs",
            post(crate::handlers::programs::create_program),
        )
        .route("/programs/:id", get(crate::handlers::programs::get_program))
        .route(
            "/programs/:id",
            put(crate::handlers::programs::update_program),
        )
        .route(
            "/programs/:id",
            delete(crate::handlers::programs::delete_program),
        )
        .route(
            "/programs/:id/approve",
            post(crate::handlers::programs::approve_program),
        )
        .route(
            "/programs/:id/scan",
            post(crate::handlers::programs::scan_program),
        )
        // Scope routes
        .route(
            "/programs/:id/scope",
            get(crate::handlers::scope::list_scope),
        )
        .route(
            "/programs/:id/scope",
            post(crate::handlers::scope::add_scope),
        )
        .route("/scope/:id", put(crate::handlers::scope::update_scope))
        .route("/scope/:id", delete(crate::handlers::scope::delete_scope))
        .route(
            "/programs/:id/scope/import",
            post(crate::handlers::scope::import_scope),
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
        // URL routes
        .route("/programs/:id/urls", get(crate::handlers::urls::list_urls))
        // Finding routes
        .route("/findings", get(crate::handlers::findings::list_findings))
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
            put(crate::handlers::findings::update_finding),
        )
        .route(
            "/findings/:id/claim",
            post(crate::handlers::findings::claim_finding),
        )
        .route(
            "/findings/:id/validate",
            post(crate::handlers::findings::validate_finding),
        )
        .route(
            "/findings/:id/report",
            post(crate::handlers::findings::report_finding),
        )
        // LLM triage routes
        .route(
            "/findings/:id/triage",
            post(crate::handlers::findings::triage_finding),
        )
        .route(
            "/findings/:id/triage",
            get(crate::handlers::findings::get_finding_triage),
        )
        // Kanban (finding-level)
        .route(
            "/findings/:id/kanban",
            put(crate::handlers::findings::move_finding_kanban),
        )
        // Job routes
        .route("/jobs", get(crate::handlers::jobs::list_jobs))
        .route(
            "/programs/:id/jobs",
            get(crate::handlers::jobs::list_program_jobs),
        )
        .route("/jobs/:id", get(crate::handlers::jobs::get_job))
        .route("/jobs/:id", delete(crate::handlers::jobs::cancel_job))
        // Hunter routes
        .route("/hunters", get(crate::handlers::hunters::list_hunters))
        .route("/hunters", post(crate::handlers::hunters::create_hunter))
        .route("/hunters/:id", put(crate::handlers::hunters::update_hunter))
        .route(
            "/hunters/:id",
            delete(crate::handlers::hunters::delete_hunter),
        )
        // Token routes
        .route("/tokens", get(crate::handlers::tokens::list_tokens))
        .route("/tokens", post(crate::handlers::tokens::create_token))
        .route("/tokens/:id", delete(crate::handlers::tokens::delete_token))
        // Settings routes
        .route("/settings", get(crate::handlers::settings::get_settings))
        .route("/settings", put(crate::handlers::settings::update_settings))
        .route(
            "/settings/tools/check",
            post(crate::handlers::settings::check_tools),
        )
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
