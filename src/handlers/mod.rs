pub mod lists;
pub mod todos;

use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};

pub struct AppError(pub sqlx::Error);

impl From<sqlx::Error> for AppError {
    fn from(err: sqlx::Error) -> Self {
        Self(err)
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        tracing::error!(error = %self.0, "database error");
        (StatusCode::INTERNAL_SERVER_ERROR, "Internal Server Error").into_response()
    }
}
