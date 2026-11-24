use axum::Json;
use axum::extract::{Path, Query, State};
use axum::response::{IntoResponse, Response};
use inertia::{Inertia, ValidationErrors, props};

use crate::AppState;
use crate::db;
use crate::handlers::AppError;
use crate::models::{
    ClearCompletedQuery, CreateTodoPayload, IndexQuery, Toast, TodoFilters, UpdateTodoPayload,
};

pub async fn index(
    inertia: Inertia,
    State(state): State<AppState>,
    Query(query): Query<IndexQuery>,
) -> Result<Response, AppError> {
    let list = match query.list {
        Some(id) if id > 0 && db::list_exists(&state.db, id).await? => Some(id),
        _ => None,
    };

    let view = if list.is_some() {
        "all".to_owned()
    } else {
        normalize_view(query.view.as_deref()).to_owned()
    };

    let sort = normalize_sort(query.sort.as_deref()).to_owned();
    let search = query.search.unwrap_or_default().trim().to_owned();

    let filters = TodoFilters {
        view,
        list,
        search,
        sort,
    };

    let (todos, lists, counts, today) = tokio::try_join!(
        db::list_todos(&state.db, &filters),
        db::list_lists(&state.db),
        db::get_counts(&state.db),
        db::today_local(&state.db),
    )?;

    let pool = state.db.clone();
    let insights = inertia::defer(move || async move { db::get_insights(&pool).await });

    Ok(inertia
        .render(
            "Todos/Index",
            props! {
                todos,
                lists,
                counts,
                filters,
                today,
                insights => insights,
            },
        )
        .into_response())
}

pub async fn store(
    inertia: Inertia,
    State(state): State<AppState>,
    Json(payload): Json<CreateTodoPayload>,
) -> Result<Response, AppError> {
    let validated = match validate_todo_input(
        &state.db,
        &payload.title,
        &payload.notes,
        payload.priority.as_deref(),
        payload.due_date.as_deref(),
        payload.list_id,
    )
    .await?
    {
        Ok(valid) => valid,
        Err(errors) => return Ok(inertia.back_with_errors(errors).into_response()),
    };

    db::create_todo(
        &state.db,
        db::TodoInput {
            title: &validated.title,
            notes: &validated.notes,
            priority: validated.priority,
            due_date: validated.due_date.as_deref(),
            list_id: validated.list_id,
        },
    )
    .await?;

    inertia.flash("toast", Toast::success("Task added"));
    Ok(inertia.back().into_response())
}

pub async fn update(
    inertia: Inertia,
    State(state): State<AppState>,
    Path(id): Path<i64>,
    Json(payload): Json<UpdateTodoPayload>,
) -> Result<Response, AppError> {
    let validated = match validate_todo_input(
        &state.db,
        &payload.title,
        &payload.notes,
        payload.priority.as_deref(),
        payload.due_date.as_deref(),
        payload.list_id,
    )
    .await?
    {
        Ok(valid) => valid,
        Err(errors) => return Ok(inertia.back_with_errors(errors).into_response()),
    };

    let updated = db::update_todo(
        &state.db,
        id,
        db::TodoInput {
            title: &validated.title,
            notes: &validated.notes,
            priority: validated.priority,
            due_date: validated.due_date.as_deref(),
            list_id: validated.list_id,
        },
        payload.completed,
    )
    .await?;

    if updated {
        inertia.flash("toast", Toast::success("Task updated"));
    } else {
        inertia.flash("toast", Toast::info("Task not found"));
    }

    Ok(inertia.back().into_response())
}

pub async fn toggle(
    inertia: Inertia,
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Result<Response, AppError> {
    match db::toggle_todo(&state.db, id).await? {
        Some(true) => {
            inertia.flash("toast", Toast::success("Task completed"));
        }
        Some(false) => {
            inertia.flash("toast", Toast::info("Moved back to active"));
        }
        None => {
            inertia.flash("toast", Toast::info("Task not found"));
        }
    }

    Ok(inertia.back().into_response())
}

pub async fn destroy(
    inertia: Inertia,
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Result<Response, AppError> {
    if db::delete_todo(&state.db, id).await? {
        inertia.flash("toast", Toast::info("Task deleted"));
    } else {
        inertia.flash("toast", Toast::info("Task not found"));
    }

    Ok(inertia.back().into_response())
}

pub async fn clear_completed(
    inertia: Inertia,
    State(state): State<AppState>,
    Query(query): Query<ClearCompletedQuery>,
) -> Result<Response, AppError> {
    let cleared = db::clear_completed(&state.db, query.list).await?;
    if cleared == 0 {
        inertia.flash("toast", Toast::info("No completed tasks to clear"));
    } else {
        let noun = if cleared == 1 { "task" } else { "tasks" };
        inertia.flash(
            "toast",
            Toast::success(format!("Cleared {cleared} completed {noun}")),
        );
    }

    Ok(inertia.back().into_response())
}

struct ValidatedTodo {
    title: String,
    notes: String,
    priority: &'static str,
    due_date: Option<String>,
    list_id: Option<i64>,
}

async fn validate_todo_input(
    pool: &sqlx::SqlitePool,
    raw_title: &str,
    raw_notes: &str,
    raw_priority: Option<&str>,
    raw_due_date: Option<&str>,
    list_id: Option<i64>,
) -> Result<Result<ValidatedTodo, ValidationErrors>, sqlx::Error> {
    let mut errors = ValidationErrors::new();

    let title = raw_title.trim().to_owned();
    if title.is_empty() {
        errors.add("title", "Please enter a task title.");
    } else if title.chars().count() > 200 {
        errors.add("title", "Task title must be 200 characters or fewer.");
    }

    let notes = raw_notes.trim().to_owned();
    if notes.chars().count() > 2000 {
        errors.add("notes", "Notes must be 2000 characters or fewer.");
    }

    let priority = match raw_priority.map(str::trim).filter(|s| !s.is_empty()) {
        None | Some("medium") => "medium",
        Some("low") => "low",
        Some("high") => "high",
        Some(_) => {
            errors.add("priority", "Priority must be low, medium, or high.");
            "medium"
        }
    };

    let due_date = match raw_due_date.map(str::trim).filter(|s| !s.is_empty()) {
        None => None,
        Some(date) => {
            if is_valid_iso_date(date) {
                Some(date.to_owned())
            } else {
                errors.add("dueDate", "Due date must be a valid YYYY-MM-DD date.");
                None
            }
        }
    };

    let clean_list_id = match list_id {
        Some(id) if id <= 0 => {
            errors.add("listId", "Selected list does not exist.");
            None
        }
        Some(id) => {
            if !db::list_exists(pool, id).await? {
                errors.add("listId", "Selected list does not exist.");
            }
            Some(id)
        }
        None => None,
    };

    if errors.is_empty() {
        Ok(Ok(ValidatedTodo {
            title,
            notes,
            priority,
            due_date,
            list_id: clean_list_id,
        }))
    } else {
        Ok(Err(errors))
    }
}

fn normalize_view(view: Option<&str>) -> &'static str {
    match view.map(str::trim) {
        Some("today") => "today",
        Some("upcoming") => "upcoming",
        Some("high") => "high",
        Some("completed") => "completed",
        Some("active") => "active",
        _ => "all",
    }
}

fn normalize_sort(sort: Option<&str>) -> &'static str {
    match sort.map(str::trim) {
        Some("due_date") => "due_date",
        Some("priority") => "priority",
        Some("newest") => "newest",
        _ => "smart",
    }
}

fn is_valid_iso_date(s: &str) -> bool {
    let bytes = s.as_bytes();
    if bytes.len() != 10 || bytes[4] != b'-' || bytes[7] != b'-' {
        return false;
    }

    let Ok(year) = s[0..4].parse::<i32>() else {
        return false;
    };
    let Ok(month) = s[5..7].parse::<u32>() else {
        return false;
    };
    let Ok(day) = s[8..10].parse::<u32>() else {
        return false;
    };

    if !(1..=12).contains(&month) || !(1000..=9999).contains(&year) {
        return false;
    }

    let is_leap = (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0);
    let max_day = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if is_leap => 29,
        2 => 28,
        _ => return false,
    };

    (1..=max_day).contains(&day)
}
