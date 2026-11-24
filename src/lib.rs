pub mod db;
pub mod handlers;
pub mod models;
pub mod vite;

use axum::Router;
use axum::routing::{delete, get, patch, post};
use inertia::axum::InertiaLayer;
use inertia::{Config, View, props};
use sqlx::SqlitePool;
use tower_http::services::ServeDir;
use tower_http::trace::TraceLayer;
use tower_sessions::{MemoryStore, SessionManagerLayer};

use crate::vite::ViteAssets;

#[derive(Clone)]
pub struct AppState {
    pub db: SqlitePool,
}

pub fn build_router(state: AppState, vite: ViteAssets) -> Router {
    let version_vite = vite.clone();
    let view_vite = vite;

    let config = Config::new()
        .version_with(move || version_vite.version())
        .share(|_request| props! { appName => "Taskflow" })
        .root_view(move |view: &View<'_>| {
            format!(
                r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title inertia>Taskflow</title>
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%236366f1'/%3E%3Cpath d='M9.5 16.5l4.2 4.2L22.5 11.5' stroke='white' stroke-width='3' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E">
    <script>
      (() => {{
        try {{
          const stored = localStorage.getItem('theme');
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          if (stored === 'dark' || (!stored && prefersDark)) {{
            document.documentElement.classList.add('dark');
          }}
        }} catch {{}}
      }})();
    </script>
    {assets}
    {head}
</head>
<body class="bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
    {body}
</body>
</html>"#,
                assets = view_vite.tags(),
                head = view.head.join("\n"),
                body = view.body,
            )
        });

    let inertia_routes = Router::new()
        .route("/", get(handlers::todos::index))
        .route("/todos", post(handlers::todos::store))
        .route("/todos/completed", delete(handlers::todos::clear_completed))
        .route("/todos/{id}", patch(handlers::todos::update).delete(handlers::todos::destroy))
        .route("/todos/{id}/toggle", patch(handlers::todos::toggle))
        .route("/lists", post(handlers::lists::store))
        .route("/lists/{id}", delete(handlers::lists::destroy))
        .with_state(state)
        .layer(InertiaLayer::new(config))
        .layer(SessionManagerLayer::new(MemoryStore::default()).with_secure(false));

    Router::new()
        .nest_service("/build", ServeDir::new("public/build"))
        .merge(inertia_routes)
        .layer(TraceLayer::new_for_http())
}
