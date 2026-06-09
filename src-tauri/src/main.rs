// Prevents external URL access from frontend
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Deserialize;
use std::path::Path;
use lofty::file::AudioFile;

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

// ── 辅助函数：处理 GBK 编码和损坏标签 ──────────

/// 解析 ID3v2 syncsafe 整数
fn syncsafe_u32(b: &[u8]) -> u32 {
    ((b[0] as u32) << 21) | ((b[1] as u32) << 14) | ((b[2] as u32) << 7) | (b[3] as u32)
}

/// 从 MP3 数据中剥离 ID3v2（头部）和 ID3v1（尾部），返回纯音频帧
fn strip_id3_tags(data: &[u8]) -> Vec<u8> {
    let mut start = 0usize;
    let mut end = data.len();

    if data.len() >= 10 && &data[0..3] == b"ID3" {
        let major = data[3];
        let size = if major >= 4 {
            syncsafe_u32(&data[6..10])
        } else {
            u32::from_be_bytes([data[6], data[7], data[8], data[9]])
        };
        start = 10 + size as usize;
    }

    if end >= start + 128 && &data[end - 128..end - 125] == b"TAG" {
        end -= 128;
    }

    data[start..end].to_vec()
}

/// 当 lofty 无法读取损坏标签时，先剥离标签再让 lofty 读取纯音频
fn read_file_without_tags(path: &Path) -> Result<lofty::file::TaggedFile, String> {
    let data = std::fs::read(path).map_err(|e| format!("读取文件失败: {}", e))?;
    let clean = strip_id3_tags(&data);

    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("mp3");
    let temp_name = format!(
        "{}_tmp_notag.{}",
        path.file_stem().unwrap_or_default().to_string_lossy(),
        ext
    );
    let temp_path = path.with_file_name(&temp_name);
    std::fs::write(&temp_path, &clean)
        .map_err(|e| format!("写入临时文件失败: {}", e))?;

    let result = lofty::probe::Probe::open(&temp_path)
        .map_err(|e| format!("打开临时文件失败: {}", e))?
        .read()
        .map_err(|e| format!("解析临时文件失败: {}", e))?;

    let _ = std::fs::remove_file(&temp_path);
    Ok(result)
}

/// 自定义 ID3v2 文本帧解析，支持 GBK/GB18030 回退解码
fn read_id3v2_gbk(path: &Path) -> Result<serde_json::Map<String, serde_json::Value>, String> {
    use std::io::Read;

    let mut file = std::fs::File::open(path).map_err(|e| e.to_string())?;
    let mut header = [0u8; 10];
    if file.read_exact(&mut header).is_err() {
        return Ok(serde_json::Map::new());
    }

    if &header[0..3] != b"ID3" {
        return Ok(serde_json::Map::new());
    }

    let major = header[3];
    let flags = header[5];
    let size = syncsafe_u32(&header[6..10]);

    let mut tag_data = vec![0u8; size as usize];
    if file.read_exact(&mut tag_data).is_err() {
        return Ok(serde_json::Map::new());
    }

    let mut pos = 0usize;
    if flags & 0x40 != 0 {
        let ext_size = if major >= 4 {
            syncsafe_u32(&tag_data[0..4])
        } else {
            u32::from_be_bytes([tag_data[0], tag_data[1], tag_data[2], tag_data[3]])
        };
        pos = ext_size as usize;
    }

    let mut result = serde_json::Map::new();

    while pos + 10 <= tag_data.len() {
        let frame_id = match std::str::from_utf8(&tag_data[pos..pos + 4]) {
            Ok(s) => s,
            Err(_) => break,
        };

        if frame_id.bytes().next().unwrap_or(0) == 0 {
            break;
        }

        let frame_size = if major >= 4 {
            syncsafe_u32(&tag_data[pos + 4..pos + 8])
        } else {
            u32::from_be_bytes([
                tag_data[pos + 4],
                tag_data[pos + 5],
                tag_data[pos + 6],
                tag_data[pos + 7],
            ])
        };

        pos += 10;
        if frame_size == 0 || pos + frame_size as usize > tag_data.len() {
            break;
        }

        let frame_data = &tag_data[pos..pos + frame_size as usize];
        pos += frame_size as usize;

        if !frame_id.starts_with('T') || frame_id == "TXXX" || frame_data.is_empty() {
            continue;
        }

        let encoding = frame_data[0];
        let text_bytes = &frame_data[1..];
        let text = decode_id3_text(encoding, text_bytes);

        let key = match frame_id {
            "TIT2" => "title",
            "TPE1" => "artist",
            "TALB" => "album",
            "TYER" | "TDRC" => "year",
            "TCON" => "genre",
            "TRCK" => "track_number",
            "TPOS" => "disc_number",
            "TEXT" => "lyricist",
            "TCOM" => "composer",
            _ => continue,
        };

        if !text.trim().is_empty() && !text.contains('\u{FFFD}') {
            result.insert(key.to_string(), serde_json::Value::String(text));
        }
    }

    Ok(result)
}

/// 按 ID3v2 编码字节解码文本，GBK 回退
fn decode_id3_text(encoding: u8, bytes: &[u8]) -> String {
    let (text, _, _) = match encoding {
        0 => {
            // 编码字节标明 ISO-8859-1，但中国 MP3 里实际通常是 GBK
            let (gbk, _, gbk_err) = encoding_rs::GBK.decode(bytes);
            let gbk_str = gbk.trim_end_matches('\0');
            if !gbk_err && gbk_str.chars().any(|c| ('\u{4e00}'..='\u{9fff}').contains(&c)) {
                return gbk_str.to_string();
            }
            encoding_rs::WINDOWS_1252.decode(bytes)
        }
        1 => encoding_rs::UTF_16LE.decode(bytes),
        2 => encoding_rs::UTF_16BE.decode(bytes),
        3 => encoding_rs::UTF_8.decode(bytes),
        _ => encoding_rs::GBK.decode(bytes),
    };

    text.trim_end_matches('\0').to_string()
}

// ── write_metadata（支持清除损坏标签后写入）────
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

    // 先用宽松模式读取；如果仍然失败（GBK 标签导致 lofty 崩溃），则清除标签后重试
    let mut tagged_file = match lofty::probe::Probe::open(path)
        .map_err(|e| format!("打开文件失败: {}", e))?
        .options(lofty::config::ParseOptions::new().parsing_mode(lofty::config::ParsingMode::Relaxed))
        .read() {
        Ok(f) => f,
        Err(e) => {
            println!("[write_metadata] 读取失败，尝试剥离损坏标签: {}", e);
            read_file_without_tags(path)?
        }
    };

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

/// 读取音频文件元数据（支持 GBK 编码）
#[tauri::command]
fn read_metadata(file_path: String) -> Result<serde_json::Value, String> {
    use lofty::config::ParseOptions;
    use lofty::file::TaggedFileExt;
    use lofty::tag::ItemKey;

    let path = Path::new(&file_path);
    if !path.exists() {
        return Err("文件不存在".to_string());
    }

    let mut result = serde_json::Map::new();
    let mut lofty_ok = false;
    let mut has_garbage = false;

    // 1. 先用 lofty 读取（宽松模式）
    match lofty::probe::Probe::open(path)
        .and_then(|p| Ok(p.options(ParseOptions::new().parsing_mode(lofty::config::ParsingMode::Relaxed))))
        .and_then(|p| p.read()) {
        Ok(tagged_file) => {
            if let Some(t) = tagged_file.primary_tag().or_else(|| tagged_file.first_tag()) {
                let title = t.get_string(&ItemKey::TrackTitle).map(|s| s.to_string());
                let artist = t.get_string(&ItemKey::TrackArtist).map(|s| s.to_string());
                let album = t.get_string(&ItemKey::AlbumTitle).map(|s| s.to_string());
                let lyricist = t.get_string(&ItemKey::Lyricist).map(|s| s.to_string());
                let composer = t.get_string(&ItemKey::Composer).map(|s| s.to_string());
                let year = t.get_string(&ItemKey::Year).map(|s| s.to_string());
                let genre = t.get_string(&ItemKey::Genre).map(|s| s.to_string());
                let track = t.get_string(&ItemKey::TrackNumber).map(|s| s.to_string());
                let disc = t.get_string(&ItemKey::DiscNumber).map(|s| s.to_string());

                fn clean_gbk_garbage(s: Option<String>) -> Option<String> {
                    s.filter(|v| {
                        let replacement_ratio = v.matches('\u{FFFD}').count() as f32 / v.len().max(1) as f32;
                        replacement_ratio < 0.5 && !v.trim().is_empty()
                    })
                }

                if let Some(v) = clean_gbk_garbage(title) {
                    if v.contains('\u{FFFD}') { has_garbage = true; }
                    result.insert("title".to_string(), v.into());
                }
                if let Some(v) = clean_gbk_garbage(artist) {
                    if v.contains('\u{FFFD}') { has_garbage = true; }
                    result.insert("artist".to_string(), v.into());
                }
                if let Some(v) = clean_gbk_garbage(album) {
                    if v.contains('\u{FFFD}') { has_garbage = true; }
                    result.insert("album".to_string(), v.into());
                }
                if let Some(v) = clean_gbk_garbage(lyricist) { result.insert("lyricist".to_string(), v.into()); }
                if let Some(v) = clean_gbk_garbage(composer) { result.insert("composer".to_string(), v.into()); }
                if let Some(v) = clean_gbk_garbage(year) { result.insert("year".to_string(), v.into()); }
                if let Some(v) = clean_gbk_garbage(genre) { result.insert("genre".to_string(), v.into()); }
                if let Some(v) = clean_gbk_garbage(track) { result.insert("track_number".to_string(), v.into()); }
                if let Some(v) = clean_gbk_garbage(disc) { result.insert("disc_number".to_string(), v.into()); }
            }

            let props = tagged_file.properties();
            result.insert("duration".to_string(), props.duration().as_secs_f64().into());
            lofty_ok = true;
        }
        Err(e) => {
            println!("[read_metadata] lofty 解析失败: {}", e);
        }
    }

    // 2. 对 MP3 文件，如果 lofty 失败或结果含乱码，使用自定义 ID3v2 解析器（GBK 回退）
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
    if ext == "mp3" && (!lofty_ok || has_garbage || result.get("title").is_none()) {
        match read_id3v2_gbk(path) {
            Ok(id3_meta) => {
                for (k, v) in id3_meta.iter() {
                    if let serde_json::Value::String(s) = v {
                        if !s.trim().is_empty() && !s.contains('\u{FFFD}') {
                            result.insert(k.clone(), serde_json::Value::String(s.clone()));
                        }
                    }
                }
            }
            Err(e) => println!("[read_metadata] 自定义 ID3 解析失败: {}", e),
        }
    }

    Ok(serde_json::Value::Object(result))
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

#[tauri::command]
fn save_lyrics_file(file_path: String, file_name: String, content: String) -> Result<(), String> {
    use std::path::Path;
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err("原文件不存在".to_string());
    }
    let dir = path.parent().ok_or("无法获取目录")?;
    let lrc_path = dir.join(&file_name);
    std::fs::write(&lrc_path, content.as_bytes()).map_err(|e| format!("保存歌词文件失败: {}", e))?;
    Ok(())
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
            read_metadata,
            convert_audio,
            http_request,
            save_lyrics_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
