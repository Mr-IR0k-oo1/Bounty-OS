use axum::extract::Path;
use axum::response::IntoResponse;
use axum::http::StatusCode;

pub async fn serve_evidence(
    Path(_path): Path<String>,
) -> impl IntoResponse {
    (StatusCode::NOT_FOUND, "Not found").into_response()
}
