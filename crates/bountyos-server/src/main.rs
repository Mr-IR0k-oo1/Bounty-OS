//! Main entry point for the BountyOS server

use std::net::SocketAddr;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod alerts;
mod app;
mod auth;
mod config;
mod db;
mod errors;
pub mod handlers;
mod llm;
mod middleware;
mod models;
mod pipeline;
mod redis;
mod state;

// Re-export AppState at crate root so handlers can use `crate::AppState`
pub use state::AppState;

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG")
                .unwrap_or_else(|_| "bountyos_server=debug,tower_http=debug".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load configuration
    let config = config::load_config().expect("Failed to load configuration");

    // Connect PostgreSQL
    let db_pool = db::init_db_pool(&config.database_url)
        .await
        .expect("Failed to initialize database pool");

    // Run database migrations (idempotent across runs)
    db::migrations::run_migrations(&db_pool)
        .await
        .expect("Failed to run database migrations");

    // Connect Redis
    let redis_pool = redis::init_redis_pool(&config.redis_url)
        .await
        .expect("Failed to initialize Redis pool");

    // Create WebSocket broadcast channel
    let (ws_tx, _) = tokio::sync::broadcast::channel::<String>(256);

    // Build our application with routes
    use axum::routing::get;
    use axum::Router;
    let app = Router::new()
        .route("/", get(root))
        .route("/health", get(health_check))
        .nest(
            "/api",
            app::create_router(db_pool, redis_pool, config.clone(), ws_tx),
        )
        .layer(TraceLayer::new_for_http());

    // Run our app with hyper, listening globally on port 8000
    let addr = SocketAddr::from(([0, 0, 0, 0], 8000));
    tracing::info!("Listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("Failed to bind to address");

    axum::serve(listener, app).await.unwrap();
}

/// Basic handler that responds with a static string
async fn root() -> &'static str {
    "Welcome to BountyOS API"
}

/// Health check endpoint
async fn health_check() -> &'static str {
    "OK"
}
