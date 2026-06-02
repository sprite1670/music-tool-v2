#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Deserialize;
use std::path::Path;

#[tauri::command]
fn ping() -> &'static str {
    "pong"
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

#[derive(Deserialize)]
struct MetadataPayload {
    file_path: String,
    metadata: MetadataFields,
}

#[derive(Deserialize)]
struct MetadataFields {
    title: Option<String>,
    artist: Option<String>,
    album: Option<String>,
    year: Option<u64>,
    genre: Option<String>,
    track_number: Option<u64>,
    disc_number: Option<u64>,
}

#[tauri::command]
fn write_metadata(payload: MetadataPayload) -> Result<(), String> {
    use lofty::config::WriteOptions;
    use lofty::file::{AudioFile, TaggedFileExt};
    use lofty::tag::{ItemKey, Tag, TagExt};

    let path = Path::new(&payload.file_path);
    if !path.exists() {
        return Err("文件不存在".to_string());
    }

    // 读取并解析音频文件
    let mut tagged_file = lofty::read_from_path(path).map_err(|e| format!("解析文件失败: {}", e))?;

    // 获取或创建主标签
    let tag = tagged_file.primary_tag_mut().or_else(|| tagged_file.first_tag_mut());
    let tag = match tag {
        Some(t) => t,
        None => {
            // 没有标签时创建一个新标签（根据文件类型选择标签格式）
            let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
            let tag_type = match ext.as_str() {
                "mp3" => lofty::tag::TagType::Id3v2,
                "flac" | "ogg" => lofty::tag::TagType::VorbisComments,
                "m4a" | "mp4" | "aac" => lofty::tag::TagType::Mp4Ilst,
                "wav" => lofty::tag::TagType::RiffInfo,
                _ => lofty::tag::TagType::Id3v2,
            };
            tagged_file.insert_tag(Tag::new(tag_type));
            tagged_file.primary_tag_mut().unwrap()
        }
    };

    let m = &payload.metadata;

    if let Some(ref title) = m.title {
        tag.insert_text(ItemKey::TrackTitle, title.clone());
    }
    if let Some(ref artist) = m.artist {
        tag.insert_text(ItemKey::TrackArtist, artist.clone());
    }
    if let Some(ref album) = m.album {
        tag.insert_text(ItemKey::AlbumTitle, album.clone());
    }
    if let Some(year) = m.year {
        tag.insert_text(ItemKey::Year, year.to_string());
    }
    if let Some(ref genre) = m.genre {
        tag.insert_text(ItemKey::Genre, genre.clone());
    }
    if let Some(track) = m.track_number {
        tag.insert_text(ItemKey::TrackNumber, track.to_string());
    }
    if let Some(disc) = m.disc_number {
        tag.insert_text(ItemKey::DiscNumber, disc.to_string());
    }

    // 保存回原文件
    tagged_file
        .save_to_path(path, WriteOptions::default())
        .map_err(|e| format!("保存失败: {}", e))?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            ping,
            write_file,
            write_metadata,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
