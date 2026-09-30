pub mod commands;
pub mod engine;
pub mod manager;
pub mod media_extractor;
pub mod models;
pub mod probe;
pub mod protocol;
pub mod server;
pub mod storage;

use commands::*;
use manager::DownloadManager;
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager};

#[derive(Clone, Default)]
pub struct PendingProtocolUrl(pub Arc<Mutex<Option<String>>>);

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            app.manage(DownloadManager::new(app.handle().clone()));

            // Register Windows bundlerock:// protocol in HKCU
            protocol::register_windows_protocol();

            // Manage pending protocol URL from startup arguments
            let startup_url = protocol::get_startup_protocol_url();
            app.manage(PendingProtocolUrl(Arc::new(Mutex::new(startup_url.clone()))));

            if let Some(url) = startup_url {
                let app_handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(std::time::Duration::from_millis(600)).await;
                    let _ = app_handle.emit(
                        "external-download-request",
                        serde_json::json!({ "url": url }),
                    );
                });
            }

            // Setup Tray Icon
            let show_i = tauri::menu::MenuItem::with_id(app, "show", "Mostrar BundleRock", true, None::<&str>)?;
            let quit_i = tauri::menu::MenuItem::with_id(app, "quit", "Salir de BundleRock", true, None::<&str>)?;
            let menu = tauri::menu::Menu::with_items(app, &[&show_i, &quit_i])?;

            if let Some(icon) = app.default_window_icon() {
                let _tray = tauri::tray::TrayIconBuilder::new()
                    .icon(icon.clone())
                    .menu(&menu)
                    .show_menu_on_left_click(false)
                    .tooltip("BundleRock - Download Manager")
                    .on_menu_event(|app, event| match event.id.as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => {
                            std::process::exit(0);
                        }
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let tauri::tray::TrayIconEvent::Click {
                            button: tauri::tray::MouseButton::Left,
                            button_state: tauri::tray::MouseButtonState::Up,
                            ..
                        } = event
                        {
                            let app = tray.app_handle();
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        }
                    })
                    .build(app)?;
            }

            // Start Local HTTP Server on 127.0.0.1:18200
            let server_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                server::start_server(server_handle, 18200).await;
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            probe_url,
            start_download,
            pause_download,
            resume_download,
            cancel_download,
            remove_task,
            clear_all_tasks,
            get_download,
            get_task,
            list_downloads,
            list_tasks,
            get_default_directory,
            check_extractor_status,
            install_extractor,
            minimize_window,
            toggle_maximize_window,
            is_window_maximized,
            close_window,
            exit_app,
            get_clipboard_text,
            select_folder,
            get_pending_protocol_url
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
