use std::env;

use todo::vite::ViteAssets;
use todo::{AppState, build_router, db};
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info,sqlx=warn")),
        )
        .init();

    let database_url = env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite:todo.db".to_owned());
    let bind_addr = env::var("BIND_ADDR").unwrap_or_else(|_| {
        let port = env::var("PORT").unwrap_or_else(|_| "3000".to_owned());
        format!("127.0.0.1:{port}")
    });

    let pool = db::connect(&database_url)
        .await
        .expect("failed to connect to SQLite and run migrations");
    db::seed_if_empty(&pool)
        .await
        .expect("failed to seed starter todo data");

    let app = build_router(AppState { db: pool }, ViteAssets::new());
    let listener = tokio::net::TcpListener::bind(&bind_addr)
        .await
        .expect("failed to bind TCP listener");

    let local_addr = listener.local_addr().expect("listener should have local address");
    tracing::info!("Taskflow listening on http://{local_addr}");

    axum::serve(listener, app).await.expect("server exited with error");
}
