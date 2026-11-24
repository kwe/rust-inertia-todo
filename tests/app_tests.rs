use axum::Router;
use axum::body::Body;
use http::{HeaderMap, StatusCode, header};
use http_body_util::BodyExt;
use inertia::testing::AssertablePage;
use serde_json::json;
use todo::vite::ViteAssets;
use todo::{AppState, build_router, db};
use tower::ServiceExt;

struct TestResponse {
    status: StatusCode,
    headers: HeaderMap,
    body: String,
}

impl TestResponse {
    fn header(&self, name: &str) -> Option<&str> {
        self.headers.get(name).and_then(|v| v.to_str().ok())
    }

    fn page(&self) -> AssertablePage {
        AssertablePage::from_body(&self.body).pages_in("resources/js/pages")
    }

    fn session_cookie(&self) -> String {
        self.header("set-cookie")
            .and_then(|cookie| cookie.split(';').next())
            .expect("expected a set-cookie session header")
            .to_owned()
    }
}

async fn setup_app() -> Router {
    let pool = db::connect("sqlite::memory:")
        .await
        .expect("in-memory SQLite should connect and migrate");
    let vite = ViteAssets::with_paths(
        "target/test-no-hot",
        "target/test-no-manifest.json",
        "resources/js/app.tsx",
    );
    build_router(AppState { db: pool }, vite)
}

async fn send(app: &Router, request: http::Request<Body>) -> TestResponse {
    let response = app.clone().oneshot(request).await.unwrap();
    let (parts, body) = response.into_parts();
    let bytes = body.collect().await.unwrap().to_bytes();

    TestResponse {
        status: parts.status,
        headers: parts.headers,
        body: String::from_utf8(bytes.to_vec()).unwrap(),
    }
}

fn plain_get(uri: &str) -> http::Request<Body> {
    http::Request::get(uri)
        .header("host", "localhost")
        .body(Body::empty())
        .unwrap()
}

fn inertia_request(method: &str, uri: &str) -> http::request::Builder {
    http::Request::builder()
        .method(method)
        .uri(uri)
        .header("host", "localhost")
        .header("x-inertia", "true")
        .header("x-inertia-version", "1")
}

fn json_visit(
    method: &str,
    uri: &str,
    cookie: Option<&str>,
    referer: Option<&str>,
    payload: serde_json::Value,
) -> http::Request<Body> {
    let mut builder = inertia_request(method, uri)
        .header(header::CONTENT_TYPE, "application/json");
    if let Some(cookie) = cookie {
        builder = builder.header(header::COOKIE, cookie);
    }
    if let Some(referer) = referer {
        builder = builder.header(header::REFERER, referer);
    }
    builder.body(Body::from(payload.to_string())).unwrap()
}

fn reloadable(app: &Router, response: &TestResponse) -> AssertablePage {
    let app = app.clone();
    response.page().reloads_with(move |reload| {
        let mut request = plain_get(reload.url());
        request.headers_mut().extend(reload.headers().clone());
        let app = app.clone();
        async move { send(&app, request).await.page() }
    })
}

#[tokio::test]
async fn first_visit_renders_html_and_defers_insights() {
    let app = setup_app().await;
    let response = send(&app, plain_get("/")).await;

    assert_eq!(response.status, StatusCode::OK);
    assert_eq!(response.header("content-type"), Some("text/html; charset=utf-8"));
    assert_eq!(response.header("vary"), Some("X-Inertia"));

    let page = reloadable(&app, &response);
    page.component("Todos/Index")
        .equals("appName", "Taskflow")
        .has_count("todos", 0)
        .has_count("lists", 0)
        .equals("counts.all", 0)
        .missing("insights")
        .deferred("default", &["insights"]);

    page.load_deferred_props()
        .await
        .has("insights")
        .equals("insights.total", 0)
        .equals("insights.completionRate", 0);
}

#[tokio::test]
async fn inertia_visit_returns_json_with_matching_version() {
    let app = setup_app().await;
    let response = send(&app, inertia_request("GET", "/").body(Body::empty()).unwrap()).await;

    assert_eq!(response.status, StatusCode::OK);
    assert_eq!(response.header("x-inertia"), Some("true"));
    assert_eq!(response.header("content-type"), Some("application/json"));

    response
        .page()
        .component("Todos/Index")
        .url("/")
        .version("1");
}

#[tokio::test]
async fn outdated_asset_version_returns_conflict_with_location() {
    let app = setup_app().await;
    let request = http::Request::get("/?view=today")
        .header("host", "localhost")
        .header("x-inertia", "true")
        .header("x-inertia-version", "stale-version")
        .body(Body::empty())
        .unwrap();

    let response = send(&app, request).await;
    assert_eq!(response.status, StatusCode::CONFLICT);
    assert_eq!(
        response.header("x-inertia-location"),
        Some("http://localhost/?view=today")
    );
}

#[tokio::test]
async fn empty_todo_title_redirects_back_with_validation_error() {
    let app = setup_app().await;

    let response = send(
        &app,
        json_visit(
            "POST",
            "/todos",
            None,
            Some("/"),
            json!({ "title": "   ", "priority": "medium" }),
        ),
    )
    .await;

    assert_eq!(response.status, StatusCode::FOUND);
    assert_eq!(response.header("location"), Some("/"));
    let cookie = response.session_cookie();

    let follow = send(
        &app,
        inertia_request("GET", "/")
            .header(header::COOKIE, &cookie)
            .body(Body::empty())
            .unwrap(),
    )
    .await;

    follow
        .page()
        .equals("errors.title", "Please enter a task title.")
        .has_count("todos", 0);
}

#[tokio::test]
async fn creating_toggling_updating_and_clearing_todos_works() {
    let app = setup_app().await;

    // 1. Create a task
    let create_res = send(
        &app,
        json_visit(
            "POST",
            "/todos",
            None,
            Some("/"),
            json!({
                "title": "Write Inertia tests",
                "notes": "Cover toggle and validation",
                "priority": "high",
                "dueDate": "2026-12-01"
            }),
        ),
    )
    .await;
    assert_eq!(create_res.status, StatusCode::FOUND);
    let cookie = create_res.session_cookie();

    // 2. Follow redirect and check flash toast + todo props
    let list_res = send(
        &app,
        inertia_request("GET", "/")
            .header(header::COOKIE, &cookie)
            .body(Body::empty())
            .unwrap(),
    )
    .await;
    let page = list_res.page();
    page.has_count("todos", 1)
        .equals("todos.0.title", "Write Inertia tests")
        .equals("todos.0.priority", "high")
        .equals("todos.0.completed", false)
        .flash("toast.message", "Task added");

    let todo_id = page.prop("todos.0.id").unwrap().as_i64().unwrap();

    // 3. Toggle completion (Inertia PATCH -> 303 See Other)
    let toggle_res = send(
        &app,
        inertia_request("PATCH", &format!("/todos/{todo_id}/toggle"))
            .header(header::COOKIE, &cookie)
            .header(header::REFERER, "/")
            .body(Body::empty())
            .unwrap(),
    )
    .await;
    assert_eq!(toggle_res.status, StatusCode::SEE_OTHER);

    let after_toggle = send(
        &app,
        inertia_request("GET", "/")
            .header(header::COOKIE, &cookie)
            .body(Body::empty())
            .unwrap(),
    )
    .await;
    after_toggle
        .page()
        .equals("todos.0.completed", true)
        .satisfies("todos.0.completedAt", |val: Option<String>| val.is_some())
        .flash("toast.message", "Task completed");

    // 4. Update fields
    let update_res = send(
        &app,
        json_visit(
            "PATCH",
            &format!("/todos/{todo_id}"),
            Some(&cookie),
            Some("/"),
            json!({
                "title": "Updated task title",
                "notes": "Revised notes",
                "priority": "low",
                "dueDate": "",
                "completed": true
            }),
        ),
    )
    .await;
    assert_eq!(update_res.status, StatusCode::SEE_OTHER);

    // 5. Add a second active task so we can verify clear_completed only deletes completed ones
    let second_res = send(
        &app,
        json_visit(
            "POST",
            "/todos",
            Some(&cookie),
            Some("/"),
            json!({ "title": "Keep active task", "priority": "medium" }),
        ),
    )
    .await;
    assert_eq!(second_res.status, StatusCode::FOUND);

    let clear_res = send(
        &app,
        inertia_request("DELETE", "/todos/completed")
            .header(header::COOKIE, &cookie)
            .header(header::REFERER, "/")
            .body(Body::empty())
            .unwrap(),
    )
    .await;
    assert_eq!(clear_res.status, StatusCode::SEE_OTHER);

    let after_clear = send(
        &app,
        inertia_request("GET", "/")
            .header(header::COOKIE, &cookie)
            .body(Body::empty())
            .unwrap(),
    )
    .await;
    let after_clear_page = after_clear.page();
    after_clear_page
        .has_count("todos", 1)
        .equals("todos.0.title", "Keep active task");

    let remaining_id = after_clear_page.prop("todos.0.id").unwrap().as_i64().unwrap();

    // 6. Delete individual todo
    let del_res = send(
        &app,
        inertia_request("DELETE", &format!("/todos/{remaining_id}"))
            .header(header::COOKIE, &cookie)
            .header(header::REFERER, "/")
            .body(Body::empty())
            .unwrap(),
    )
    .await;
    assert_eq!(del_res.status, StatusCode::SEE_OTHER);

    let after_del = send(
        &app,
        inertia_request("GET", "/")
            .header(header::COOKIE, &cookie)
            .body(Body::empty())
            .unwrap(),
    )
    .await;
    after_del.page().has_count("todos", 0);
}

#[tokio::test]
async fn lists_reject_duplicates_and_preserve_todos_on_delete() {
    let app = setup_app().await;

    // Create list
    let create_list = send(
        &app,
        json_visit(
            "POST",
            "/lists",
            None,
            Some("/"),
            json!({ "name": "Work", "color": "#0ea5e9" }),
        ),
    )
    .await;
    assert_eq!(create_list.status, StatusCode::FOUND);
    let redirect_location = create_list.header("location").unwrap().to_owned();
    assert!(redirect_location.starts_with("/?list="));
    let cookie = create_list.session_cookie();

    let list_id: i64 = redirect_location
        .trim_start_matches("/?list=")
        .parse()
        .unwrap();

    // Reject duplicate list name
    let dup_list = send(
        &app,
        json_visit(
            "POST",
            "/lists",
            Some(&cookie),
            Some("/"),
            json!({ "name": "work", "color": "#6366f1" }),
        ),
    )
    .await;
    assert_eq!(dup_list.status, StatusCode::FOUND);

    let after_dup = send(
        &app,
        inertia_request("GET", "/")
            .header(header::COOKIE, &cookie)
            .body(Body::empty())
            .unwrap(),
    )
    .await;
    after_dup
        .page()
        .equals("errors.name", "A list with this name already exists.")
        .has_count("lists", 1);

    // Add a todo inside the list
    send(
        &app,
        json_visit(
            "POST",
            "/todos",
            Some(&cookie),
            Some(&redirect_location),
            json!({ "title": "Quarterly planning", "listId": list_id }),
        ),
    )
    .await;

    // Delete list; todo must remain with listId: null
    let del_list = send(
        &app,
        inertia_request("DELETE", &format!("/lists/{list_id}"))
            .header(header::COOKIE, &cookie)
            .header(header::REFERER, &redirect_location)
            .body(Body::empty())
            .unwrap(),
    )
    .await;
    assert_eq!(del_list.status, StatusCode::SEE_OTHER);
    assert_eq!(del_list.header("location"), Some("/"));

    let home = send(
        &app,
        inertia_request("GET", "/")
            .header(header::COOKIE, &cookie)
            .body(Body::empty())
            .unwrap(),
    )
    .await;
    home.page()
        .has_count("lists", 0)
        .has_count("todos", 1)
        .equals("todos.0.title", "Quarterly planning")
        .equals("todos.0.listId", serde_json::Value::Null);
}

#[tokio::test]
async fn filtering_and_partial_reloads_return_expected_subsets() {
    let app = setup_app().await;

    let list_res = send(
        &app,
        json_visit(
            "POST",
            "/lists",
            None,
            Some("/"),
            json!({ "name": "Engineering", "color": "#6366f1" }),
        ),
    )
    .await;
    let cookie = list_res.session_cookie();
    let list_id: i64 = list_res
        .header("location")
        .unwrap()
        .trim_start_matches("/?list=")
        .parse()
        .unwrap();

    // Seed three todos across priorities, lists, and completion states
    send(
        &app,
        json_visit(
            "POST",
            "/todos",
            Some(&cookie),
            Some("/"),
            json!({ "title": "Fix prod latency", "priority": "high", "listId": list_id }),
        ),
    )
    .await;
    send(
        &app,
        json_visit(
            "POST",
            "/todos",
            Some(&cookie),
            Some("/"),
            json!({ "title": "Buy coffee filters", "priority": "low" }),
        ),
    )
    .await;
    send(
        &app,
        json_visit(
            "POST",
            "/todos",
            Some(&cookie),
            Some("/"),
            json!({ "title": "Archive old docs", "priority": "medium" }),
        ),
    )
    .await;

    // Complete "Archive old docs"
    let all_page = send(
        &app,
        inertia_request("GET", "/")
            .header(header::COOKIE, &cookie)
            .body(Body::empty())
            .unwrap(),
    )
    .await;
    let archive_id = all_page
        .page()
        .page()
        .props
        .get("todos")
        .and_then(|v| v.as_array())
        .unwrap()
        .iter()
        .find(|t| t["title"] == "Archive old docs")
        .unwrap()["id"]
        .as_i64()
        .unwrap();

    send(
        &app,
        inertia_request("PATCH", &format!("/todos/{archive_id}/toggle"))
            .header(header::COOKIE, &cookie)
            .header(header::REFERER, "/")
            .body(Body::empty())
            .unwrap(),
    )
    .await;

    // View: high priority
    send(
        &app,
        inertia_request("GET", "/?view=high")
            .header(header::COOKIE, &cookie)
            .body(Body::empty())
            .unwrap(),
    )
    .await
    .page()
    .has_count("todos", 1)
    .equals("todos.0.title", "Fix prod latency");

    // View: completed
    send(
        &app,
        inertia_request("GET", "/?view=completed")
            .header(header::COOKIE, &cookie)
            .body(Body::empty())
            .unwrap(),
    )
    .await
    .page()
    .has_count("todos", 1)
    .equals("todos.0.title", "Archive old docs");

    // Filter by list
    send(
        &app,
        inertia_request("GET", &format!("/?list={list_id}"))
            .header(header::COOKIE, &cookie)
            .body(Body::empty())
            .unwrap(),
    )
    .await
    .page()
    .has_count("todos", 1)
    .equals("todos.0.title", "Fix prod latency");

    // Partial reload with search
    let search_res = send(&app, plain_get("/?search=coffee")).await;
    let search_page = reloadable(&app, &search_res);
    search_page
        .has_count("todos", 1)
        .equals("todos.0.title", "Buy coffee filters");

    search_page
        .reload_only(&["todos", "filters"])
        .await
        .has_count("todos", 1)
        .equals("filters.search", "coffee")
        .missing("lists")
        .missing("counts");
}

#[test]
fn vite_assets_loads_built_manifest_tags() {
    let vite = ViteAssets::new();
    let tags = vite.tags();
    assert!(tags.contains("/build/assets/"));
    assert!(tags.contains(r#"<script type="module""#));
    assert!(tags.contains(r#"<link rel="stylesheet""#));
    assert_ne!(vite.version(), "1");
}
