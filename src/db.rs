use std::str::FromStr;

use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions};
use sqlx::{QueryBuilder, Row, Sqlite, SqlitePool};

use crate::models::{Insights, SmartCounts, Todo, TodoFilters, TodoList};

#[derive(Debug, Clone, Copy)]
pub struct DuplicateList;

pub async fn connect(database_url: &str) -> Result<SqlitePool, sqlx::Error> {
    let is_memory = database_url.contains(":memory:");
    let journal_mode = if is_memory {
        SqliteJournalMode::Memory
    } else {
        SqliteJournalMode::Wal
    };

    let options = SqliteConnectOptions::from_str(database_url)?
        .create_if_missing(true)
        .foreign_keys(true)
        .journal_mode(journal_mode);

    let max_connections = if is_memory { 1 } else { 5 };
    let pool = SqlitePoolOptions::new()
        .max_connections(max_connections)
        .connect_with(options)
        .await?;

    sqlx::migrate!("./migrations").run(&pool).await?;
    Ok(pool)
}

pub async fn seed_if_empty(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    let list_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM lists")
        .fetch_one(pool)
        .await?;
    let todo_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM todos")
        .fetch_one(pool)
        .await?;

    if list_count > 0 || todo_count > 0 {
        return Ok(());
    }

    let mut tx = pool.begin().await?;

    let lists = [
        ("Inbox", "inbox", "#6366f1", 1_i64),
        ("Work", "work", "#0ea5e9", 2_i64),
        ("Personal", "personal", "#10b981", 3_i64),
        ("Errands", "errands", "#f59e0b", 4_i64),
    ];

    for (name, slug, color, position) in lists {
        sqlx::query("INSERT INTO lists (name, slug, color, position) VALUES (?, ?, ?, ?)")
            .bind(name)
            .bind(slug)
            .bind(color)
            .bind(position)
            .execute(&mut *tx)
            .await?;
    }

    let inbox_id: i64 = sqlx::query_scalar("SELECT id FROM lists WHERE slug = 'inbox'")
        .fetch_one(&mut *tx)
        .await?;
    let work_id: i64 = sqlx::query_scalar("SELECT id FROM lists WHERE slug = 'work'")
        .fetch_one(&mut *tx)
        .await?;
    let personal_id: i64 = sqlx::query_scalar("SELECT id FROM lists WHERE slug = 'personal'")
        .fetch_one(&mut *tx)
        .await?;
    let errands_id: i64 = sqlx::query_scalar("SELECT id FROM lists WHERE slug = 'errands'")
        .fetch_one(&mut *tx)
        .await?;

    // Fresh starter todos relative to local today
    sqlx::query(
        r#"
        INSERT INTO todos (title, notes, completed, priority, due_date, list_id, completed_at)
        VALUES
            (
                'Ship Q4 release checklist',
                'Verify database migrations, run smoke tests, and tag the release branch.',
                0,
                'high',
                date('now', 'localtime'),
                ?,
                NULL
            ),
            (
                'Review design system typography tokens',
                'Check contrast ratios for secondary labels in dark mode.',
                0,
                'medium',
                date('now', 'localtime', '-1 day'),
                ?,
                NULL
            ),
            (
                'Prepare sprint retro talking points',
                'Highlight Inertia v3 migration speedups and test coverage wins.',
                0,
                'high',
                date('now', 'localtime', '+1 day'),
                ?,
                NULL
            ),
            (
                'Book dentist appointment',
                'Prefer an early morning slot next week.',
                0,
                'low',
                date('now', 'localtime', '+4 days'),
                ?,
                NULL
            ),
            (
                'Pick up espresso beans and oat milk',
                'Grab a bag of single-origin medium roast from the corner roaster.',
                0,
                'medium',
                date('now', 'localtime'),
                ?,
                NULL
            ),
            (
                'Clean up workspace inbox',
                'Archive finished RFC drafts and organize reference links.',
                1,
                'low',
                date('now', 'localtime'),
                ?,
                strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
            )
        "#,
    )
    .bind(work_id)
    .bind(work_id)
    .bind(inbox_id)
    .bind(personal_id)
    .bind(errands_id)
    .bind(inbox_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}

pub async fn today_local(pool: &SqlitePool) -> Result<String, sqlx::Error> {
    sqlx::query_scalar("SELECT date('now', 'localtime')")
        .fetch_one(pool)
        .await
}

pub async fn list_todos(pool: &SqlitePool, filters: &TodoFilters) -> Result<Vec<Todo>, sqlx::Error> {
    let mut qb = QueryBuilder::<Sqlite>::new(
        r#"
        SELECT
            t.id,
            t.title,
            t.notes,
            t.completed,
            t.priority,
            t.due_date,
            t.list_id,
            l.name AS list_name,
            l.color AS list_color,
            (t.completed = 0 AND t.due_date IS NOT NULL AND t.due_date < date('now', 'localtime')) AS is_overdue,
            (t.due_date IS NOT NULL AND t.due_date = date('now', 'localtime')) AS is_due_today,
            t.completed_at,
            t.created_at,
            t.updated_at
        FROM todos t
        LEFT JOIN lists l ON l.id = t.list_id
        WHERE 1=1
        "#,
    );

    if let Some(list_id) = filters.list {
        qb.push(" AND t.list_id = ").push_bind(list_id);
    } else {
        match filters.view.as_str() {
            "active" => {
                qb.push(" AND t.completed = 0");
            }
            "today" => {
                qb.push(
                    " AND t.completed = 0 AND t.due_date IS NOT NULL AND t.due_date <= date('now', 'localtime')",
                );
            }
            "upcoming" => {
                qb.push(
                    " AND t.completed = 0 AND t.due_date IS NOT NULL AND t.due_date > date('now', 'localtime')",
                );
            }
            "high" => {
                qb.push(" AND t.completed = 0 AND t.priority = 'high'");
            }
            "completed" => {
                qb.push(" AND t.completed = 1");
            }
            _ => {}
        }
    }

    if !filters.search.is_empty() {
        let escaped = escape_like(&filters.search);
        let pattern = format!("%{escaped}%");
        qb.push(" AND (LOWER(t.title) LIKE LOWER(")
            .push_bind(pattern.clone())
            .push(") ESCAPE '\\' OR LOWER(t.notes) LIKE LOWER(")
            .push_bind(pattern)
            .push(") ESCAPE '\\')");
    }

    match filters.sort.as_str() {
        "due_date" => {
            qb.push(
                r#"
                ORDER BY
                    t.completed ASC,
                    CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END ASC,
                    t.due_date ASC,
                    CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END ASC,
                    t.id DESC
                "#,
            );
        }
        "priority" => {
            qb.push(
                r#"
                ORDER BY
                    t.completed ASC,
                    CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END ASC,
                    CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END ASC,
                    t.due_date ASC,
                    t.id DESC
                "#,
            );
        }
        "newest" => {
            qb.push(" ORDER BY t.completed ASC, t.id DESC");
        }
        _ => {
            qb.push(
                r#"
                ORDER BY
                    t.completed ASC,
                    CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END ASC,
                    CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END ASC,
                    t.due_date ASC,
                    t.id DESC
                "#,
            );
        }
    }

    let rows = qb.build().fetch_all(pool).await?;
    Ok(rows
        .into_iter()
        .map(|row| Todo {
            id: row.get("id"),
            title: row.get("title"),
            notes: row.get("notes"),
            completed: row.get::<i64, _>("completed") != 0,
            priority: row.get("priority"),
            due_date: row.get("due_date"),
            list_id: row.get("list_id"),
            list_name: row.get("list_name"),
            list_color: row.get("list_color"),
            is_overdue: row.get::<i64, _>("is_overdue") != 0,
            is_due_today: row.get::<i64, _>("is_due_today") != 0,
            completed_at: row.get("completed_at"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
        .collect())
}

pub async fn list_lists(pool: &SqlitePool) -> Result<Vec<TodoList>, sqlx::Error> {
    let rows = sqlx::query(
        r#"
        SELECT
            l.id,
            l.name,
            l.slug,
            l.color,
            COALESCE(SUM(CASE WHEN t.id IS NOT NULL AND t.completed = 0 THEN 1 ELSE 0 END), 0) AS active_count,
            COUNT(t.id) AS total_count
        FROM lists l
        LEFT JOIN todos t ON t.list_id = l.id
        GROUP BY l.id
        ORDER BY l.position ASC, l.id ASC
        "#,
    )
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| TodoList {
            id: row.get("id"),
            name: row.get("name"),
            slug: row.get("slug"),
            color: row.get("color"),
            active_count: row.get("active_count"),
            total_count: row.get("total_count"),
        })
        .collect())
}

pub async fn get_counts(pool: &SqlitePool) -> Result<SmartCounts, sqlx::Error> {
    let row = sqlx::query(
        r#"
        SELECT
            COUNT(*) AS all_count,
            COALESCE(SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END), 0) AS active_count,
            COALESCE(SUM(CASE WHEN completed = 0 AND due_date IS NOT NULL AND due_date <= date('now', 'localtime') THEN 1 ELSE 0 END), 0) AS today_count,
            COALESCE(SUM(CASE WHEN completed = 0 AND due_date IS NOT NULL AND due_date > date('now', 'localtime') THEN 1 ELSE 0 END), 0) AS upcoming_count,
            COALESCE(SUM(CASE WHEN completed = 0 AND priority = 'high' THEN 1 ELSE 0 END), 0) AS high_count,
            COALESCE(SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END), 0) AS completed_count
        FROM todos
        "#,
    )
    .fetch_one(pool)
    .await?;

    Ok(SmartCounts {
        all: row.get("all_count"),
        active: row.get("active_count"),
        today: row.get("today_count"),
        upcoming: row.get("upcoming_count"),
        high: row.get("high_count"),
        completed: row.get("completed_count"),
    })
}

pub async fn get_insights(pool: &SqlitePool) -> Result<Insights, sqlx::Error> {
    let row = sqlx::query(
        r#"
        SELECT
            COUNT(*) AS total,
            COALESCE(SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END), 0) AS completed,
            COALESCE(SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END), 0) AS active,
            COALESCE(SUM(CASE WHEN completed = 0 AND due_date IS NOT NULL AND due_date < date('now', 'localtime') THEN 1 ELSE 0 END), 0) AS overdue,
            COALESCE(SUM(CASE WHEN completed = 1 AND completed_at IS NOT NULL AND date(completed_at, 'localtime') = date('now', 'localtime') THEN 1 ELSE 0 END), 0) AS completed_today,
            COALESCE(SUM(CASE WHEN completed = 0 AND priority = 'high' THEN 1 ELSE 0 END), 0) AS high_active,
            COALESCE(SUM(CASE WHEN completed = 0 AND priority = 'medium' THEN 1 ELSE 0 END), 0) AS medium_active,
            COALESCE(SUM(CASE WHEN completed = 0 AND priority = 'low' THEN 1 ELSE 0 END), 0) AS low_active
        FROM todos
        "#,
    )
    .fetch_one(pool)
    .await?;

    let total: i64 = row.get("total");
    let completed: i64 = row.get("completed");
    let completion_rate = if total == 0 {
        0
    } else {
        (completed * 100 + total / 2) / total
    };

    Ok(Insights {
        total,
        completed,
        active: row.get("active"),
        overdue: row.get("overdue"),
        completed_today: row.get("completed_today"),
        completion_rate,
        high_active: row.get("high_active"),
        medium_active: row.get("medium_active"),
        low_active: row.get("low_active"),
    })
}

pub async fn list_exists(pool: &SqlitePool, id: i64) -> Result<bool, sqlx::Error> {
    let exists: i64 = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM lists WHERE id = ?)")
        .bind(id)
        .fetch_one(pool)
        .await?;
    Ok(exists != 0)
}

pub struct TodoInput<'a> {
    pub title: &'a str,
    pub notes: &'a str,
    pub priority: &'a str,
    pub due_date: Option<&'a str>,
    pub list_id: Option<i64>,
}

pub async fn create_todo(pool: &SqlitePool, input: TodoInput<'_>) -> Result<i64, sqlx::Error> {
    let result = sqlx::query(
        r#"
        INSERT INTO todos (title, notes, priority, due_date, list_id)
        VALUES (?, ?, ?, ?, ?)
        "#,
    )
    .bind(input.title)
    .bind(input.notes)
    .bind(input.priority)
    .bind(input.due_date)
    .bind(input.list_id)
    .execute(pool)
    .await?;

    Ok(result.last_insert_rowid())
}

pub async fn update_todo(
    pool: &SqlitePool,
    id: i64,
    input: TodoInput<'_>,
    completed: Option<bool>,
) -> Result<bool, sqlx::Error> {
    let result = match completed {
        Some(done) => {
            let completed_int: i64 = i64::from(done);
            sqlx::query(
                r#"
                UPDATE todos
                SET
                    title = ?,
                    notes = ?,
                    priority = ?,
                    due_date = ?,
                    list_id = ?,
                    completed = ?,
                    completed_at = CASE
                        WHEN ? = 1 AND completed = 0 THEN strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
                        WHEN ? = 0 THEN NULL
                        ELSE completed_at
                    END,
                    updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
                WHERE id = ?
                "#,
            )
            .bind(input.title)
            .bind(input.notes)
            .bind(input.priority)
            .bind(input.due_date)
            .bind(input.list_id)
            .bind(completed_int)
            .bind(completed_int)
            .bind(completed_int)
            .bind(id)
            .execute(pool)
            .await?
        }
        None => {
            sqlx::query(
                r#"
                UPDATE todos
                SET
                    title = ?,
                    notes = ?,
                    priority = ?,
                    due_date = ?,
                    list_id = ?,
                    updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
                WHERE id = ?
                "#,
            )
            .bind(input.title)
            .bind(input.notes)
            .bind(input.priority)
            .bind(input.due_date)
            .bind(input.list_id)
            .bind(id)
            .execute(pool)
            .await?
        }
    };

    Ok(result.rows_affected() > 0)
}

pub async fn toggle_todo(pool: &SqlitePool, id: i64) -> Result<Option<bool>, sqlx::Error> {
    let row = sqlx::query(
        r#"
        UPDATE todos
        SET
            completed = CASE WHEN completed = 0 THEN 1 ELSE 0 END,
            completed_at = CASE WHEN completed = 0 THEN strftime('%Y-%m-%dT%H:%M:%SZ', 'now') ELSE NULL END,
            updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE id = ?
        RETURNING completed
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|r| r.get::<i64, _>("completed") != 0))
}

pub async fn delete_todo(pool: &SqlitePool, id: i64) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM todos WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;

    Ok(result.rows_affected() > 0)
}

pub async fn clear_completed(pool: &SqlitePool, list_id: Option<i64>) -> Result<u64, sqlx::Error> {
    let result = match list_id {
        Some(id) => {
            sqlx::query("DELETE FROM todos WHERE completed = 1 AND list_id = ?")
                .bind(id)
                .execute(pool)
                .await?
        }
        None => {
            sqlx::query("DELETE FROM todos WHERE completed = 1")
                .execute(pool)
                .await?
        }
    };

    Ok(result.rows_affected())
}

pub async fn create_list(
    pool: &SqlitePool,
    name: &str,
    slug: &str,
    color: &str,
) -> Result<Result<i64, DuplicateList>, sqlx::Error> {
    let duplicate: i64 = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM lists WHERE LOWER(name) = LOWER(?) OR slug = ?)",
    )
    .bind(name)
    .bind(slug)
    .fetch_one(pool)
    .await?;

    if duplicate != 0 {
        return Ok(Err(DuplicateList));
    }

    let next_pos: i64 = sqlx::query_scalar("SELECT COALESCE(MAX(position), 0) + 1 FROM lists")
        .fetch_one(pool)
        .await?;

    let inserted = sqlx::query("INSERT INTO lists (name, slug, color, position) VALUES (?, ?, ?, ?)")
        .bind(name)
        .bind(slug)
        .bind(color)
        .bind(next_pos)
        .execute(pool)
        .await;

    match inserted {
        Ok(res) => Ok(Ok(res.last_insert_rowid())),
        Err(sqlx::Error::Database(db_err)) if db_err.is_unique_violation() => Ok(Err(DuplicateList)),
        Err(err) => Err(err),
    }
}

pub async fn delete_list(pool: &SqlitePool, id: i64) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM lists WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;

    Ok(result.rows_affected() > 0)
}

fn escape_like(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for ch in input.chars() {
        if matches!(ch, '\\' | '%' | '_') {
            out.push('\\');
        }
        out.push(ch);
    }
    out
}
