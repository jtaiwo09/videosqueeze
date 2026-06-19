// Prevents an extra console window on Windows in release. No-op on macOS.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;
use tauri::{AppHandle, State};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

// ---------- Shared data shapes (camelCase across the IPC boundary) ----------

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct VideoInfo {
    duration_sec: f64,
    width: u32,
    height: u32,
    size_bytes: u64,
    video_codec: String,
    fps: f64,
    bitrate_kbps: u64,
}

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct CompressionSettings {
    codec: String, // "h264" | "h265"
    mode: String,  // "hardware" | "software"
    video_bitrate_kbps: u32,
    scale_height: Option<u32>,
    fps: Option<f64>,
    audio_kbps: u32,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CompressJob {
    input_path: String,
    output_path: String,
    settings: CompressionSettings,
    duration_sec: f64,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ProgressPayload {
    ratio: f64,
    fps: f64,
    speed: f64,
    out_bytes: u64,
    eta_sec: Option<f64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CompressResult {
    output_path: String,
    output_bytes: u64,
}

// ---------- App state (tracks the running encode for cancellation) ----------

#[derive(Default)]
struct AppState {
    child: Mutex<Option<CommandChild>>,
    cancelled: AtomicBool,
}

// ---------- Helpers ----------

/// Parse an ffmpeg `-progress` timecode ("00:00:05.000000") into seconds.
fn parse_timecode(s: &str) -> f64 {
    let parts: Vec<&str> = s.trim().split(':').collect();
    if parts.len() == 3 {
        let h: f64 = parts[0].parse().unwrap_or(0.0);
        let m: f64 = parts[1].parse().unwrap_or(0.0);
        let sec: f64 = parts[2].parse().unwrap_or(0.0);
        h * 3600.0 + m * 60.0 + sec
    } else {
        s.trim().parse().unwrap_or(0.0)
    }
}

/// Build the FFmpeg argument list from a job.
fn build_ffmpeg_args(job: &CompressJob) -> Vec<String> {
    let s = &job.settings;
    let mut args: Vec<String> = vec![
        "-y".into(),
        "-i".into(),
        job.input_path.clone(),
    ];

    // Video filters: optional downscale + fps cap.
    let mut filters: Vec<String> = Vec::new();
    if let Some(h) = s.scale_height {
        // -2 keeps aspect ratio and forces an even width (required by yuv420p).
        filters.push(format!("scale=-2:{}", h));
    }
    if let Some(fps) = s.fps {
        filters.push(format!("fps={}", fps));
    }
    if !filters.is_empty() {
        args.push("-vf".into());
        args.push(filters.join(","));
    }

    // Video codec + TARGET BITRATE. Bitrate targeting (not constant quality)
    // guarantees the output is smaller than the source and makes the size
    // estimate accurate.
    let vb = s.video_bitrate_kbps.max(50);
    let maxrate = ((vb as f64) * 1.45).round() as u32;
    let bufsize = vb * 2;
    let br = format!("{}k", vb);
    match (s.mode.as_str(), s.codec.as_str()) {
        ("software", "h265") => {
            args.extend([
                "-c:v".into(), "libx265".into(),
                "-b:v".into(), br.clone(),
                "-maxrate".into(), format!("{}k", maxrate),
                "-bufsize".into(), format!("{}k", bufsize),
                "-preset".into(), "medium".into(),
                "-tag:v".into(), "hvc1".into(),
                "-pix_fmt".into(), "yuv420p".into(),
            ]);
        }
        ("software", _) => {
            args.extend([
                "-c:v".into(), "libx264".into(),
                "-b:v".into(), br.clone(),
                "-maxrate".into(), format!("{}k", maxrate),
                "-bufsize".into(), format!("{}k", bufsize),
                "-preset".into(), "medium".into(),
                "-pix_fmt".into(), "yuv420p".into(),
            ]);
        }
        ("hardware", "h265") => {
            args.extend([
                "-c:v".into(), "hevc_videotoolbox".into(),
                "-b:v".into(), br.clone(),
                "-maxrate".into(), format!("{}k", maxrate),
                "-tag:v".into(), "hvc1".into(),
            ]);
        }
        _ => {
            // hardware h264 (default, fastest on Apple Silicon)
            args.extend([
                "-c:v".into(), "h264_videotoolbox".into(),
                "-b:v".into(), br.clone(),
                "-maxrate".into(), format!("{}k", maxrate),
            ]);
        }
    }

    // Audio.
    args.extend([
        "-c:a".into(), "aac".into(),
        "-b:a".into(), format!("{}k", s.audio_kbps),
    ]);

    // Fast-start for streaming/preview + machine-readable progress on stdout.
    args.extend([
        "-movflags".into(), "+faststart".into(),
        "-progress".into(), "pipe:1".into(),
        "-nostats".into(),
        job.output_path.clone(),
    ]);

    args
}

// ---------- Commands ----------

#[tauri::command]
async fn probe_video(app: AppHandle, path: String) -> Result<VideoInfo, String> {
    let output = app
        .shell()
        .sidecar("ffprobe")
        .map_err(|e| format!("ffprobe sidecar error: {e}"))?
        .args([
            "-v", "error",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            &path,
        ])
        .output()
        .await
        .map_err(|e| format!("ffprobe failed to run: {e}"))?;

    if !output.status.success() {
        return Err(format!(
            "ffprobe error: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let json: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("could not parse ffprobe output: {e}"))?;

    let format = &json["format"];
    let duration_sec: f64 = format["duration"]
        .as_str()
        .and_then(|s| s.parse().ok())
        .unwrap_or(0.0);
    let size_bytes: u64 = format["size"]
        .as_str()
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);
    let bitrate_kbps: u64 = format["bit_rate"]
        .as_str()
        .and_then(|s| s.parse::<u64>().ok())
        .map(|b| b / 1000)
        .unwrap_or(0);

    // First video stream.
    let mut width = 0u32;
    let mut height = 0u32;
    let mut video_codec = String::from("unknown");
    let mut fps = 0.0f64;

    if let Some(streams) = json["streams"].as_array() {
        for st in streams {
            if st["codec_type"].as_str() == Some("video") {
                width = st["width"].as_u64().unwrap_or(0) as u32;
                height = st["height"].as_u64().unwrap_or(0) as u32;
                video_codec = st["codec_name"]
                    .as_str()
                    .unwrap_or("unknown")
                    .to_string();
                // avg_frame_rate is like "30000/1001"
                if let Some(rate) = st["avg_frame_rate"].as_str() {
                    if let Some((n, d)) = rate.split_once('/') {
                        let n: f64 = n.parse().unwrap_or(0.0);
                        let d: f64 = d.parse().unwrap_or(1.0);
                        if d != 0.0 {
                            fps = n / d;
                        }
                    }
                }
                break;
            }
        }
    }

    Ok(VideoInfo {
        duration_sec,
        width,
        height,
        size_bytes,
        video_codec,
        fps,
        bitrate_kbps,
    })
}

#[tauri::command]
async fn compress_video(
    app: AppHandle,
    job: CompressJob,
    on_progress: Channel<ProgressPayload>,
    state: State<'_, AppState>,
) -> Result<CompressResult, String> {
    state.cancelled.store(false, Ordering::SeqCst);

    let args = build_ffmpeg_args(&job);
    let (mut rx, child) = app
        .shell()
        .sidecar("ffmpeg")
        .map_err(|e| format!("ffmpeg sidecar error: {e}"))?
        .args(args)
        .spawn()
        .map_err(|e| format!("ffmpeg failed to start: {e}"))?;

    *state.child.lock().unwrap() = Some(child);

    let mut buf = String::new();
    let mut cur_out_time = 0.0f64;
    let mut cur_speed = 0.0f64;
    let mut cur_fps = 0.0f64;
    let mut cur_size = 0u64;
    let mut stderr_tail: Vec<String> = Vec::new();
    let mut exit_code: Option<i32> = None;

    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(bytes) => {
                buf.push_str(&String::from_utf8_lossy(&bytes));
                while let Some(nl) = buf.find('\n') {
                    let line: String = buf.drain(..=nl).collect();
                    let line = line.trim();
                    if let Some((k, v)) = line.split_once('=') {
                        match k {
                            "out_time" => cur_out_time = parse_timecode(v),
                            "speed" => {
                                cur_speed = v.trim().trim_end_matches('x').trim().parse().unwrap_or(cur_speed);
                            }
                            "fps" => cur_fps = v.trim().parse().unwrap_or(cur_fps),
                            "total_size" => cur_size = v.trim().parse().unwrap_or(cur_size),
                            "progress" => {
                                let ratio = if job.duration_sec > 0.0 {
                                    (cur_out_time / job.duration_sec).clamp(0.0, 1.0)
                                } else {
                                    0.0
                                };
                                let eta_sec = if cur_speed > 0.0 && job.duration_sec > 0.0 {
                                    Some(((job.duration_sec - cur_out_time).max(0.0)) / cur_speed)
                                } else {
                                    None
                                };
                                let _ = on_progress.send(ProgressPayload {
                                    ratio,
                                    fps: cur_fps,
                                    speed: cur_speed,
                                    out_bytes: cur_size,
                                    eta_sec,
                                });
                            }
                            _ => {}
                        }
                    }
                }
            }
            CommandEvent::Stderr(bytes) => {
                let text = String::from_utf8_lossy(&bytes);
                for l in text.lines() {
                    stderr_tail.push(l.to_string());
                    if stderr_tail.len() > 30 {
                        stderr_tail.remove(0);
                    }
                }
            }
            CommandEvent::Terminated(payload) => {
                exit_code = payload.code;
                break;
            }
            CommandEvent::Error(e) => {
                *state.child.lock().unwrap() = None;
                return Err(format!("ffmpeg process error: {e}"));
            }
            _ => {}
        }
    }

    // Clear any stored child (it may already be gone after a cancel).
    *state.child.lock().unwrap() = None;

    if state.cancelled.load(Ordering::SeqCst) {
        // Best-effort cleanup of the partial output file.
        let _ = std::fs::remove_file(&job.output_path);
        return Err("Canceled".to_string());
    }

    if exit_code != Some(0) {
        let _ = std::fs::remove_file(&job.output_path);
        let tail = stderr_tail.join("\n");
        return Err(format!("Compression failed (exit {:?}).\n{}", exit_code, tail));
    }

    let output_bytes = std::fs::metadata(&job.output_path)
        .map(|m| m.len())
        .unwrap_or(0);

    Ok(CompressResult {
        output_path: job.output_path,
        output_bytes,
    })
}

#[tauri::command]
fn cancel_compression(state: State<'_, AppState>) -> Result<(), String> {
    state.cancelled.store(true, Ordering::SeqCst);
    if let Some(child) = state.child.lock().unwrap().take() {
        let _ = child.kill();
    }
    Ok(())
}

#[tauri::command]
fn delete_file(path: String) -> Result<(), String> {
    std::fs::remove_file(&path).map_err(|e| format!("could not delete file: {e}"))?;
    Ok(())
}

#[tauri::command]
fn copy_file(src: String, dest: String) -> Result<(), String> {
    std::fs::copy(&src, &dest).map_err(|e| format!("could not save file: {e}"))?;
    Ok(())
}

#[tauri::command]
fn reveal_in_finder(path: String) -> Result<(), String> {
    std::process::Command::new("open")
        .args(["-R", &path])
        .spawn()
        .map_err(|e| format!("could not reveal in Finder: {e}"))?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            probe_video,
            compress_video,
            cancel_compression,
            reveal_in_finder,
            delete_file,
            copy_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running VideoSqueeze");
}
