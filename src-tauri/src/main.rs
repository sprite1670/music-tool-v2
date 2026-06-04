// Prevents external URL access from frontend
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
fn write_metadata(
    file_path: String,
    metadata: MetadataFields,
) -> Result<(), String> {
    use lofty::config::WriteOptions;
    use lofty::file::{AudioFile, TaggedFileExt};
    use lofty::tag::{ItemKey, Tag};

    let path = Path::new(&file_path);
    if !path.exists() {
        return Err("文件不存在".to_string());
    }

    let mut tagged_file = lofty::read_from_path(path).map_err(|e| format!("解析文件失败: {}", e))?;

    let primary = tagged_file.primary_tag_mut();
    let tag = if let Some(t) = primary {
        Some(t)
    } else {
        tagged_file.first_tag_mut()
    };
    let tag = match tag {
        Some(t) => t,
        None => {
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

    let m = &metadata;

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
    if let Some(ref g) = m.genre {
        tag.insert_text(ItemKey::Genre, g.clone());
    }
    if let Some(track) = m.track_number {
        tag.insert_text(ItemKey::TrackNumber, track.to_string());
    }
    if let Some(disc) = m.disc_number {
        tag.insert_text(ItemKey::DiscNumber, disc.to_string());
    }

    tagged_file
        .save_to_path(path, WriteOptions::default())
        .map_err(|e| format!("保存失败: {}", e))?;

    Ok(())
}

/// 在 Windows 上隐藏窗口运行命令，返回 (success, stdout, stderr)
#[cfg(target_os = "windows")]
fn run_hidden(cmd: &str, args: &[String]) -> Result<(bool, Vec<u8>, Vec<u8>), String> {
    use std::os::windows::process::CommandExt;
    use std::process::Stdio;

    let child = std::process::Command::new(cmd)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .spawn()
        .map_err(|e| format!("启动失败: {} ({})", e, cmd))?;

    let output = child
        .wait_with_output()
        .map_err(|e| format!("等待进程失败: {}", e))?;

    Ok((output.status.success(), output.stdout, output.stderr))
}

#[cfg(not(target_os = "windows"))]
fn run_hidden(cmd: &str, args: &[String]) -> Result<(bool, Vec<u8>, Vec<u8>), String> {
    use std::process::Stdio;
    let output = std::process::Command::new(cmd)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|e| format!("启动失败: {} ({})", e, cmd))?;
    Ok((output.status.success(), output.stdout, output.stderr))
}

/// 调用内嵌的 ffmpeg.exe 执行音频格式转换
/// 接收输入文件路径，返回输出文件的二进制内容（Vec<u8>）
#[tauri::command]
fn convert_audio(
    input_path: String,
    output_ext: String,
) -> Result<Vec<u8>, String> {
    use std::path::PathBuf;

    let input_path = std::path::Path::new(&input_path);
    if !input_path.exists() {
        return Err(format!("输入文件不存在: {}", input_path.display()));
    }

    // 查找 ffmpeg.exe：优先用应用同级目录，其次系统 PATH
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

    // 构造输出路径（与输入文件同目录，加 .converted 后缀避免覆盖原文件）
    let output_tmp: PathBuf = {
        let mut p = input_path.to_path_buf();
        let stem = p.file_stem().unwrap_or_default().to_string_lossy().to_string();
        p.set_file_name(format!("{}.converted.{}", stem, output_ext));
        p
    };

    let _ = std::fs::remove_file(&output_tmp);

    // 构造 ffmpeg 参数
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

    // 执行 ffmpeg（Windows 上隐藏窗口）
    let (success, _stdout, stderr) = run_hidden(
        ffmpeg_exe.to_str().unwrap(),
        &args.iter().map(|s| s.clone()).collect::<Vec<_>>(),
    )?;

    if !success {
        let stderr_str = String::from_utf8_lossy(&stderr);
        let last_lines: Vec<&str> = stderr_str.lines().rev().take(8).collect();
        return Err(format!(
            "ffmpeg 执行失败\n{}",
            last_lines.into_iter().rev().collect::<Vec<_>>().join("\n")
        ));
    }

    if !output_tmp.exists() {
        return Err("输出文件未生成".into());
    }

    // 读取输出文件内容，直接返回二进制（Tauri v2 自动转为 Uint8Array）
    let output_bytes = std::fs::read(&output_tmp)
        .map_err(|e| format!("读取输出文件失败: {}", e))?;
    let _ = std::fs::remove_file(&output_tmp);

    Ok(output_bytes)
}

// ── HTTP 代理（绕过 CORS）────────────────
use serde::Serialize;
use std::collections::HashMap;

#[derive(Serialize)]
struct HttpResponse {
    status: u16,
    headers: HashMap<String, String>,
    body: String,
}

#[tauri::command]
fn http_request(
    url: String,
    method: Option<String>,
    headers: Option<HashMap<String, String>>,
    body: Option<String>,
) -> Result<HttpResponse, String> {
    let method = method.unwrap_or_else(|| "GET".to_string());

    let mut req = match method.as_str() {
        "GET" => ureq::get(&url),
        "POST" => ureq::post(&url),
        "PUT" => ureq::put(&url),
        "DELETE" => ureq::delete(&url),
        "HEAD" => ureq::head(&url),
        _ => ureq::get(&url),
    };

    // 设置默认 User-Agent
    req = req.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");

    // 设置自定义请求头
    if let Some(hdrs) = headers {
        for (k, v) in hdrs {
            if k.to_lowercase() != "user-agent" {
                req = req.set(&k, &v);
            }
        }
    }

    let resp = if let Some(b) = body {
        req.send_string(&b).map_err(|e| format!("HTTP 请求失败: {}", e))?
    } else {
        req.call().map_err(|e| format!("HTTP 请求失败: {}", e))?
    };

    let status = resp.status();

    let mut resp_headers = HashMap::new();
    let header_names: Vec<String> = resp.headers_names().into_iter().map(|s| s.to_string()).collect();
    for name in header_names {
        if let Some(v) = resp.header(&name) {
            resp_headers.insert(name, v.to_string());
        }
    }

    let body_text = resp.into_string().map_err(|e| format!("读取响应体失败: {}", e))?;

    Ok(HttpResponse {
        status,
        headers: resp_headers,
        body: body_text,
    })
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            ping,
            write_file,
            write_metadata,
            convert_audio,
            http_request,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
