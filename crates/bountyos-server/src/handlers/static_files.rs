use axum::body::Body;
use axum::extract::{Path, State};
use axum::http::{Request, StatusCode};
use axum::response::{IntoResponse, Response};
use std::path::PathBuf;
use tower::ServiceExt;
use tower_http::services::ServeFile;

use crate::AppState;

pub async fn serve_evidence(
    State(state): State<AppState>,
    Path(file_path): Path<String>,
    req: Request<Body>,
) -> Response {
    let safe_path = PathBuf::from(&file_path);
    for component in safe_path.components() {
        if let std::path::Component::ParentDir = component {
            return (StatusCode::FORBIDDEN, "Forbidden").into_response();
        }
    }

    let full_path = state.evidence_base().join(&safe_path);
    if !full_path.exists() || !full_path.is_file() {
        return (StatusCode::NOT_FOUND, "Evidence not found").into_response();
    }

    match ServeFile::new(full_path).oneshot(req).await {
        Ok(res) => res.into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error").into_response(),
    }
}
