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
pub mod intelligence;
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
    let (db_pool, has_db) = match db::init_db_pool(&config.database_url).await {
        Ok(pool) => {
            tracing::info!("Connected to PostgreSQL database");
            if let Err(e) = db::migrations::run_migrations(&pool).await {
                tracing::warn!("Failed to run database migrations: {:?}. Proceeding.", e);
            }
            if let Err(e) = db::seed_defaults_if_empty(&pool).await {
                tracing::warn!(
                    "Failed to seed default database records: {:?}. Proceeding.",
                    e
                );
            }
            (pool, true)
        }
        Err(e) => {
            tracing::warn!(
                "Could not connect to PostgreSQL at {}: {:?}. Falling back to lazy pool and in-memory store.",
                config.database_url,
                e
            );
            let pool = db::init_lazy_db_pool(&config.database_url)
                .expect("Failed to initialize lazy database pool");
            (pool, false)
        }
    };

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
            app::create_router(db_pool, redis_pool, config.clone(), ws_tx, has_db),
        )
        .layer(TraceLayer::new_for_http());

    // Run our app with hyper, listening on configured address (defaults to 127.0.0.1:8000 for private interface binding)
    let addr: SocketAddr = format!("{}:{}", config.host, config.port)
        .parse()
        .unwrap_or_else(|_| {
            tracing::warn!(
                "Invalid host:port '{}:{}', falling back to 127.0.0.1:8000",
                config.host,
                config.port
            );
            SocketAddr::from(([127, 0, 0, 1], 8000))
        });
    tracing::info!("Listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("Failed to bind to address");

    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await
    .unwrap();
}

/// Basic handler that responds with a static string
async fn root() -> &'static str {
    "Welcome to BountyOS API"
}

/// Health check endpoint
async fn health_check() -> &'static str {
    "OK"
}
