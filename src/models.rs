use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Todo {
    pub id: i64,
    pub title: String,
    pub notes: String,
    pub completed: bool,
    pub priority: String,
    pub due_date: Option<String>,
    pub list_id: Option<i64>,
    pub list_name: Option<String>,
    pub list_color: Option<String>,
    pub is_overdue: bool,
    pub is_due_today: bool,
    pub completed_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TodoList {
    pub id: i64,
    pub name: String,
    pub slug: String,
    pub color: String,
    pub active_count: i64,
    pub total_count: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SmartCounts {
    pub all: i64,
    pub active: i64,
    pub today: i64,
    pub upcoming: i64,
    pub high: i64,
    pub completed: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Insights {
    pub total: i64,
    pub completed: i64,
    pub active: i64,
    pub overdue: i64,
    pub completed_today: i64,
    pub completion_rate: i64,
    pub high_active: i64,
    pub medium_active: i64,
    pub low_active: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TodoFilters {
    pub view: String,
    pub list: Option<i64>,
    pub search: String,
    pub sort: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Toast {
    pub kind: String,
    pub message: String,
}

impl Toast {
    pub fn success(message: impl Into<String>) -> Self {
        Self {
            kind: "success".to_owned(),
            message: message.into(),
        }
    }

    pub fn info(message: impl Into<String>) -> Self {
        Self {
            kind: "info".to_owned(),
            message: message.into(),
        }
    }
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct IndexQuery {
    pub view: Option<String>,
    pub list: Option<i64>,
    pub search: Option<String>,
    pub sort: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct CreateTodoPayload {
    pub title: String,
    pub notes: String,
    pub priority: Option<String>,
    pub due_date: Option<String>,
    pub list_id: Option<i64>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct UpdateTodoPayload {
    pub title: String,
    pub notes: String,
    pub priority: Option<String>,
    pub due_date: Option<String>,
    pub list_id: Option<i64>,
    pub completed: Option<bool>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct CreateListPayload {
    pub name: String,
    pub color: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct ClearCompletedQuery {
    pub list: Option<i64>,
}
