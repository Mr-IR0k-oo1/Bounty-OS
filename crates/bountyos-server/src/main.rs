//! Main entry point for the BountyOS server

use axum::{
    routing::{get, post},
    Router,
};
use std::net::SocketAddr;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod app;
mod config;
mod db;
mod redis;

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

    // Initialize database connection pool
    let db_pool = db::init_db_pool(&config.database_url)
        .await
        .expect("Failed to initialize database pool");

    // Initialize Redis connection pool
    let redis_pool = redis::init_redis_pool(&config.redis_url)
        .await
        .expect("Failed to initialize Redis pool");

    // Build our application with routes
    let app = Router::new()
        .route("/", get(root))
        .route("/health", get(health_check))
        .nest("/api", app::create_router(db_pool, redis_pool))
        .layer(TraceLayer::new_for_http());

    // Run our app with hyper, listening globally on port 8000
    let addr = SocketAddr::from(([0, 0, 0, 0], 8000));
    tracing::debug!("listening on {}", addr);
    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await
        .unwrap();
}

// Basic handler that responds with a static string
async fn root() -> &'static str {
    "Welcome to BountyOS API"
}

// Health check endpoint
async fn health_check() -> &'static str {
    "OK"
}
