// Prevents external URL access from frontend
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde_json::Value;
use std::fs;

#[tauri::command]
fn ping() -> &'static str {
    "pong"
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_metadata(song: Value, meta: Value, lyrics: Option<String>) -> Result<(), String> {
    let name = song["name"].as_str().unwrap_or("unknown");
    let artist = song["artists"].as_array()
        .and_then(|a| a.get(0))
        .and_then(|a| a.as_str())
        .unwrap_or("unknown");
    let filename = format!("{} - {}.lrc", name, artist);
    let content = lyrics.unwrap_or_default();
    fs::write(&filename, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_metadata(_file_path: String, _metadata: Value) -> Result<(), String> {
    // TODO: 使用 lofty 库实现音频元数据写入
    Err("音频元数据写入功能正在开发中".to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            ping,
            write_file,
            save_metadata,
            write_metadata,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
