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
    use lofty::tag::{ItemKey, Tag};

    let path = Path::new(&payload.file_path);
    if !path.exists() {
        return Err("文件不存在".to_string());
    }

    // 读取并解析音频文件
    let mut tagged_file = lofty::read_from_path(path).map_err(|e| format!("解析文件失败: {}", e))?;

    // 获取或创建主标签（避免同时 mutable borrow）
    let primary = tagged_file.primary_tag_mut();
    let tag = if let Some(t) = primary {
        Some(t)
    } else {
        tagged_file.first_tag_mut()
    };
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

/// 调用内嵌的 ffmpeg.exe 执行音频格式转换
/// 接收输入文件路径，返回输出文件的二进制内容（Vec<u8>）
/// Tauri v2 会自动将 Vec<u8> 序列化为前端可用的 Uint8Array
#[tauri::command]
fn convert_audio(
    input_path: String,
    output_ext: String,
) -> Result<Vec<u8>, String> {
    use std::process::{Command, Stdio};
    use std::path::PathBuf;

    // 1. 校验输入文件存在
    let input_path = std::path::Path::new(&input_path);
    if !input_path.exists() {
        return Err(format!("输入文件不存在: {}", input_path.display()));
    }

    // 2. 查找 ffmpeg.exe：优先用应用同级目录，其次系统 PATH
    let ffmpeg_exe = {
        let from_app_dir = std::env::current_exe()
            .map(|mut p| {
                p.pop();
                p.push("ffmpeg.exe");
                if p.exists() { Some(p) } else { None }
            })
            .unwrap_or(None);
        from_app_dir.or_else(|| which::which("ffmpeg.exe").ok())
    };

    let ffmpeg_exe = match ffmpeg_exe {
        Some(p) => p,
        None => {
            return Err(
                "ffmpeg.exe 未找到。请将 ffmpeg.exe 放置于 music-tool-v2.exe 同级目录，或安装 ffmpeg 到系统 PATH 中。"
                    .into(),
            );
        }
    };

    // 3. 构造输出路径（与输入文件同目录，加 .converted 后缀避免覆盖原文件）
    let output_tmp: PathBuf = {
        let mut p = input_path.to_path_buf();
        let stem = p.file_stem().unwrap_or_default().to_string_lossy().to_string();
        p.set_file_name(format!("{}.converted.{}", stem, output_ext));
        p
    };

    // 清理可能存在的旧输出文件
    let _ = std::fs::remove_file(&output_tmp);

    // 4. 构造 ffmpeg 参数（不指定 codec，让 ffmpeg 自动选择）
    let mut args = vec![
        "-i".to_string(),
        input_path.to_string_lossy().to_string(),
        "-vn".to_string(),
    ];
    match output_ext.as_str() {
        "mp3" => {
            args.push("-q:a".into());
            args.push("2".into());
        }
        "ogg" => {
            args.push("-codec:a".into());
            args.push("libvorbis".into());
            args.push("-q:a".into());
            args.push("5".into());
        }
        "wav" => {
            args.push("-codec:a".into());
            args.push("pcm_s16le".into());
        }
        _ => {}
    }
    args.push("-y".into());
    args.push(output_tmp.to_string_lossy().into());

    // 写日志
    let _ = std::fs::write(
        std::env::temp_dir().join("music-tool-convert.log"),
        format!(
            "ffmpeg={}\ninput={}\noutput={}\nargs={:?}\n",
            ffmpeg_exe.display(),
            input_path.display(),
            output_tmp.display(),
            args,
        ),
    );

    // 5. 执行 ffmpeg
    let cmd_output = Command::new(&ffmpeg_exe)
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|e| format!("启动 ffmpeg 失败: {}（路径：{}）", e, ffmpeg_exe.display()))?;

    if !cmd_output.status.success() {
        let stderr = String::from_utf8_lossy(&cmd_output.stderr);
        let _ = std::fs::write(
            std::env::temp_dir().join("music-tool-convert.log"),
            format!(
                "FFMPEG FAILED (exit={})\nSTDERR:\n{}\nSTDOUT:\n{}",
                cmd_output.status,
                stderr,
                String::from_utf8_lossy(&cmd_output.stdout),
            ),
        );
        let last_lines: Vec<&str> = stderr.lines().rev().take(8).collect();
        return Err(format!(
            "ffmpeg 执行失败（退出码 {}）\n{}",
            cmd_output.status,
            last_lines.into_iter().rev().collect::<Vec<_>>().join("\n")
        ));
    }

    if !output_tmp.exists() {
        return Err("输出文件未生成".into());
    }

    // 6. 读取输出文件内容，直接返回二进制（Tauri v2 自动转为 Uint8Array）
    let output_bytes = std::fs::read(&output_tmp)
        .map_err(|e| format!("读取输出文件失败: {}", e))?;

    // 7. 清理临时输出文件
    let _ = std::fs::remove_file(&output_tmp);

    Ok(output_bytes)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            ping,
            write_file,
            write_metadata,
            convert_audio,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
