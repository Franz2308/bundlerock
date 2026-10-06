use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::sync::Arc;
use tauri::{Emitter, Manager};
use tower_http::cors::CorsLayer;

#[derive(Clone)]
pub struct ServerState {
    pub app_handle: tauri::AppHandle,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct DownloadRequest {
    pub url: String,
    pub page_url: Option<String>,
}

#[derive(Serialize)]
pub struct StatusResponse {
    pub status: String,
    pub version: String,
}

#[derive(Serialize)]
pub struct DownloadResponse {
    pub success: bool,
    pub message: String,
}

async fn handle_status() -> impl IntoResponse {
    Json(StatusResponse {
        status: "ok".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

pub fn focus_main_window(app_handle: &tauri::AppHandle) {
    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();

        #[cfg(target_os = "windows")]
        {
            extern "system" {
                fn SetForegroundWindow(hWnd: *mut std::ffi::c_void) -> i32;
                fn ShowWindow(hWnd: *mut std::ffi::c_void, nCmdShow: i32) -> i32;
            }
            const SW_RESTORE: i32 = 9;
            const SW_SHOW: i32 = 5;
            if let Ok(hwnd) = window.hwnd() {
                unsafe {
                    ShowWindow(hwnd.0 as _, SW_RESTORE);
                    ShowWindow(hwnd.0 as _, SW_SHOW);
                    SetForegroundWindow(hwnd.0 as _);
                }
            }
        }
    }
}

async fn handle_download(
    State(state): State<Arc<ServerState>>,
    Json(payload): Json<DownloadRequest>,
) -> Result<Json<DownloadResponse>, (StatusCode, String)> {
    if payload.url.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "URL cannot be empty".to_string()));
    }

    // Bring main window to front
    focus_main_window(&state.app_handle);

    // Emit event to React frontend
    if let Err(e) = state.app_handle.emit("external-download-request", &payload) {
        eprintln!("[server] Failed to emit external-download-request: {}", e);
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to notify application: {}", e),
        ));
    }

    Ok(Json(DownloadResponse {
        success: true,
        message: "Download request dispatched to BundleRock".to_string(),
    }))
}

async fn handle_focus(State(state): State<Arc<ServerState>>) -> impl IntoResponse {
    focus_main_window(&state.app_handle);
    StatusCode::OK
}

pub async fn start_server(app_handle: tauri::AppHandle, port: u16) {
    let state = Arc::new(ServerState { app_handle });

    let cors = CorsLayer::permissive();

    let app = Router::new()
        .route("/api/status", get(handle_status))
        .route("/api/download", post(handle_download))
        .route("/api/focus", post(handle_focus))
        .layer(cors)
        .with_state(state);

    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    println!("[server] BundleRock local server starting on http://{}", addr);

    match tokio::net::TcpListener::bind(addr).await {
        Ok(listener) => {
            if let Err(e) = axum::serve(listener, app).await {
                eprintln!("[server] Local server error: {}", e);
            }
        }
        Err(e) => {
            eprintln!("[server] Failed to bind local server on {}: {}", addr, e);
        }
    }
}
