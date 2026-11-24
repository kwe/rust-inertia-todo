use axum::Json;
use axum::extract::{Path, State};
use axum::response::{IntoResponse, Response};
use inertia::{Inertia, ValidationErrors};

use crate::AppState;
use crate::db;
use crate::handlers::AppError;
use crate::models::{CreateListPayload, Toast};

pub async fn store(
    inertia: Inertia,
    State(state): State<AppState>,
    Json(payload): Json<CreateListPayload>,
) -> Result<Response, AppError> {
    let mut errors = ValidationErrors::new();

    let name = payload.name.trim().to_owned();
    if name.is_empty() {
        errors.add("name", "Please enter a list name.");
    } else if name.chars().count() > 40 {
        errors.add("name", "List name must be 40 characters or fewer.");
    }

    let color = match payload.color.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        None => "#6366f1".to_owned(),
        Some(hex) if is_valid_hex_color(hex) => hex.to_ascii_lowercase(),
        Some(_) => {
            errors.add("color", "Color must be a 6-digit hex code like #6366f1.");
            "#6366f1".to_owned()
        }
    };

    if !errors.is_empty() {
        return Ok(inertia.back_with_errors(errors).into_response());
    }

    let slug = slugify(&name);
    match db::create_list(&state.db, &name, &slug, &color).await? {
        Ok(id) => {
            inertia.flash("toast", Toast::success(format!("Created list \"{name}\"")));
            Ok(inertia::redirect(&format!("/?list={id}")).into_response())
        }
        Err(_) => {
            errors.add("name", "A list with this name already exists.");
            Ok(inertia.back_with_errors(errors).into_response())
        }
    }
}

pub async fn destroy(
    inertia: Inertia,
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Result<Response, AppError> {
    if db::delete_list(&state.db, id).await? {
        inertia.flash("toast", Toast::info("List deleted"));
    } else {
        inertia.flash("toast", Toast::info("List not found"));
    }

    Ok(inertia::redirect("/").into_response())
}

fn is_valid_hex_color(color: &str) -> bool {
    let bytes = color.as_bytes();
    bytes.len() == 7 && bytes[0] == b'#' && bytes[1..].iter().all(|b| b.is_ascii_hexdigit())
}

fn slugify(input: &str) -> String {
    let mut slug = String::new();
    let mut last_dash = false;

    for ch in input.chars().flat_map(char::to_lowercase) {
        if ch.is_ascii_alphanumeric() {
            slug.push(ch);
            last_dash = false;
        } else if !last_dash && !slug.is_empty() {
            slug.push('-');
            last_dash = true;
        }
    }

    let trimmed = slug.trim_matches('-').to_owned();
    if trimmed.is_empty() {
        "list".to_owned()
    } else {
        trimmed
    }
}
