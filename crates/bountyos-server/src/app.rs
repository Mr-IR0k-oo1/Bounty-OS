//! Application router and middleware setup

use axum::{
    routing::{get, post},
    Router,
};
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

mod auth;
mod handlers;

use crate::config::AppConfig;
use crate::state::AppState;
use tokio::sync::broadcast;

/// Creates the main application router
pub fn create_router(db_pool: sqlx::PgPool, redis_pool: crate::redis::RedisPool, config: AppConfig, ws_tx: broadcast::Sender<String>) -> Router {
    // Create shared state
    let shared_state = AppState {
        db_pool,
        redis_pool,
        config,
        ws_tx,
    };

    // Build our application with routes
    Router::new()
        // Health check
        .route("/health", get(handlers::health_check))
        // Auth routes
        .route("/auth/login", post(handlers::auth::login))
        .route("/auth/logout", post(handlers::auth::logout))
        .route("/auth/refresh", post(handlers::auth::refresh))
        .route("/auth/2fa/setup", post(handlers::auth::setup_2fa))
        .route("/auth/2fa/verify", post(handlers::auth::verify_2fa))
        .route("/auth/me", get(handlers::auth::me))
        // Project routes
        .route("/projects", get(handlers::projects::list_projects))
        .route("/projects", post(handlers::projects::create_project))
        .route("/projects/:id", get(handlers::projects::get_project))
        .route("/projects/:id", put(handlers::projects::update_project))
        .route("/projects/:id", delete(handlers::projects::delete_project))
        .route(
            "/projects/:id/stats",
            get(handlers::projects::get_project_stats),
        )
        .route(
            "/projects/:id/milestones",
            get(handlers::projects::list_milestones),
        )
        .route(
            "/projects/:id/milestones",
            post(handlers::projects::create_milestone),
        )
        .route(
            "/projects/:id/milestones/:mid",
            put(handlers::projects::update_milestone),
        )
        .route(
            "/projects/:id/team",
            get(handlers::projects::get_project_team),
        )
        .route(
            "/projects/:id/team",
            post(handlers::projects::add_team_member),
        )
        .route(
            "/projects/:id/team/:hunter_id",
            delete(handlers::projects::remove_team_member),
        )
        .route(
            "/projects/:id/notes",
            get(handlers::projects::get_project_notes),
        )
        .route(
            "/projects/:id/notes",
            put(handlers::projects::update_project_notes),
        )
        .route(
            "/projects/:id/kanban",
            get(handlers::projects::get_kanban_board),
        )
        .route(
            "/projects/:id/kanban/columns",
            put(handlers::projects::update_kanban_columns),
        )
        .route(
            "/findings/:id/kanban",
            put(handlers::findings::move_finding_kanban),
        )
        // Program routes
        .route(
            "/projects/:id/programs",
            get(handlers::programs::list_programs),
        )
        .route(
            "/projects/:id/programs",
            post(handlers::programs::create_program),
        )
        .route("/programs/:id", get(handlers::programs::get_program))
        .route("/programs/:id", put(handlers::programs::update_program))
        .route("/programs/:id", delete(handlers::programs::delete_program))
        .route(
            "/programs/:id/approve",
            post(handlers::programs::approve_program),
        )
        .route("/programs/:id/scan", post(handlers::programs::scan_program))
        // Scope routes
        .route("/programs/:id/scope", get(handlers::scope::list_scope))
        .route("/programs/:id/scope", post(handlers::scope::add_scope))
        .route("/scope/:id", put(handlers::scope::update_scope))
        .route("/scope/:id", delete(handlers::scope::delete_scope))
        .route(
            "/programs/:id/scope/import",
            post(handlers::scope::import_scope),
        )
        // Subdomain routes
        .route(
            "/programs/:id/subdomains",
            get(handlers::subdomains::list_subdomains),
        )
        .route("/subdomains/:id", get(handlers::subdomains::get_subdomain))
        // Port routes
        .route("/subdomains/:id/ports", get(handlers::ports::list_ports))
        // URL routes
        .route("/programs/:id/urls", get(handlers::urls::list_urls))
        // Finding routes
        .route("/findings", get(handlers::findings::list_findings))
        .route(
            "/projects/:id/findings",
            get(handlers::findings::list_project_findings),
        )
        .route(
            "/programs/:id/findings",
            get(handlers::findings::list_program_findings),
        )
        .route("/findings/:id", get(handlers::findings::get_finding))
        .route("/findings/:id", put(handlers::findings::update_finding))
        .route(
            "/findings/:id/claim",
            post(handlers::findings::claim_finding),
        )
        .route(
            "/findings/:id/validate",
            post(handlers::findings::validate_finding),
        )
        .route(
            "/findings/:id/report",
            post(handlers::findings::report_finding),
        )
        // Job routes
        .route("/jobs", get(handlers::jobs::list_jobs))
        .route("/programs/:id/jobs", get(handlers::jobs::list_program_jobs))
        .route("/jobs/:id", get(handlers::jobs::get_job))
        .route("/jobs/:id", delete(handlers::jobs::cancel_job))
        // Hunter routes
        .route("/hunters", get(handlers::hunters::list_hunters))
        .route("/hunters", post(handlers::hunters::create_hunter))
        .route("/hunters/:id", put(handlers::hunters::update_hunter))
        .route("/hunters/:id", delete(handlers::hunters::delete_hunter))
        // Token routes
        .route("/tokens", get(handlers::tokens::list_tokens))
        .route("/tokens", post(handlers::tokens::create_token))
        .route("/tokens/:id", delete(handlers::tokens::delete_token))
        // Settings routes
        .route("/settings", get(handlers::settings::get_settings))
        .route("/settings", put(handlers::settings::update_settings))
        .route(
            "/settings/tools/check",
            post(handlers::settings::check_tools),
        )
        // WebSocket route
        .route("/ws/jobs/:id", get(handlers::ws::ws_handler))
        // Static file serving for evidence
        .route(
            "/evidence/*path",
            get(handlers::static_files::serve_evidence),
        )
        // Set up shared state
        .with_state(shared_state)
        // Add middleware
        .layer(CorsLayer::permissive().and_then(TraceLayer::new_for_http()))
}


