use base64::Engine;
use std::io::Read;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};

const IMAGE_EXTS: &[&str] = &["png", "jpg", "jpeg", "webp", "bmp", "gif"];

fn is_image_ext(p: &Path) -> bool {
    p.extension()
        .and_then(|e| e.to_str())
        .map(|e| IMAGE_EXTS.contains(&e.to_lowercase().as_str()))
        .unwrap_or(false)
}

fn collect_files_sorted(dir: &Path) -> Vec<String> {
    let Ok(rd) = std::fs::read_dir(dir) else { return vec![] };
    let mut names: Vec<String> = rd
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.is_file() && is_image_ext(p))
        .filter_map(|p| p.file_name().and_then(|n| n.to_str()).map(|s| s.to_string()))
        .collect();
    names.sort_by(|a, b| a.to_lowercase().cmp(&b.to_lowercase()));
    names
}


fn get_base_dir() -> Result<PathBuf, String> {
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            return Ok(dir.to_path_buf());
        }
    }
    std::env::current_dir().map_err(|e| format!("获取目录失败: {}", e))
}


#[tauri::command]
fn get_base_dir_str() -> Result<String, String> {
    let base = get_base_dir()?;
    Ok(base.to_string_lossy().to_string())
}

#[tauri::command]
fn get_metadata() -> Result<String, String> {
    let base = get_base_dir()?;
    let path = base.join("metadata.json");
    std::fs::read_to_string(&path)
        .map_err(|e| format!("读取 metadata.json 失败: {}", e))
}

#[tauri::command]
fn get_metadata_from_path(base_path: String) -> Result<String, String> {
    let path = PathBuf::from(base_path).join("metadata.json");
    std::fs::read_to_string(&path)
        .map_err(|e| format!("读取 metadata.json 失败: {}", e))
}

#[tauri::command]
fn read_image_base64(brand: String, model: String, file: String) -> Result<String, String> {
    let base = get_base_dir()?;
    let path = base.join(&brand).join(&model).join(&file);

    if !path.exists() {
        return Err(format!("文件不存在: {}", path.display()));
    }

    let bytes = std::fs::read(&path).map_err(|e| format!("读取失败: {}", e))?;
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_else(|| "jpg".to_string());

    let mime = match ext.as_str() {
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        "svg" => "image/svg+xml",
        _ => "image/jpeg",
    };

    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{};base64,{}", mime, b64))
}

#[tauri::command]
fn read_image_base64_from_path(base_path: String, brand: String, model: String, file: String) -> Result<String, String> {
    let path = PathBuf::from(base_path).join(&brand).join(&model).join(&file);

    if !path.exists() {
        return Err(format!("文件不存在: {}", path.display()));
    }

    let bytes = std::fs::read(&path).map_err(|e| format!("读取失败: {}", e))?;
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_else(|| "jpg".to_string());

    let mime = match ext.as_str() {
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        "svg" => "image/svg+xml",
        _ => "image/jpeg",
    };

    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{};base64,{}", mime, b64))
}

// Helper to get local annotation path
fn get_annotation_path(brand: &str, model: &str, file: &str) -> Result<PathBuf, String> {
    let base = get_base_dir()?;
    let annot_dir = base.join("_annotations");
    if !annot_dir.exists() {
        std::fs::create_dir_all(&annot_dir).map_err(|e| format!("创建标注目录失败: {}", e))?;
    }
    
    // Sanitize string to prevent path traversal and invalid characters
    let safe_brand: String = brand.chars().map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' }).collect();
    let safe_model: String = model.chars().map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' }).collect();
    let safe_file: String = file.chars().map(|c| if c.is_alphanumeric() || c == '-' || c == '_' || c == '.' { c } else { '_' }).collect();
    
    let filename = format!("{}_{}_{}.json", safe_brand, safe_model, safe_file);
    Ok(annot_dir.join(filename))
}

#[tauri::command]
fn save_annotation(brand: String, model: String, file: String, content: String) -> Result<(), String> {
    let path = get_annotation_path(&brand, &model, &file)?;
    std::fs::write(&path, content).map_err(|e| format!("保存标注失败: {}", e))
}

#[tauri::command]
fn load_annotation(brand: String, model: String, file: String) -> Result<String, String> {
    let path = get_annotation_path(&brand, &model, &file)?;
    if !path.exists() {
        return Ok("[]".to_string());
    }
    std::fs::read_to_string(&path).map_err(|e| format!("读取标注失败: {}", e))
}

#[tauri::command]
fn baidu_get_auth_url(client_id: String) -> String {
    format!(
        "https://openapi.baidu.com/oauth/2.0/authorize?response_type=code&client_id={}&redirect_uri=oob&scope=basic,netdisk",
        client_id
    )
}

#[tauri::command]
fn open_baidu_login_window(client_id: String) -> Result<(), String> {
    let url_str = format!(
        "https://openapi.baidu.com/oauth/2.0/authorize?response_type=code&client_id={}&redirect_uri=oob&scope=basic,netdisk",
        client_id
    );
    
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &url_str.replace("&", "^&")])
            .spawn()
            .map_err(|e| format!("打开浏览器失败: {}", e))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url_str)
            .spawn()
            .map_err(|e| format!("打开浏览器失败: {}", e))?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&url_str)
            .spawn()
            .map_err(|e| format!("打开浏览器失败: {}", e))?;
    }
    Ok(())
}


#[tauri::command]
fn baidu_exchange_token(client_id: String, client_secret: String, code: String) -> Result<String, String> {
    let url = format!(
        "https://openapi.baidu.com/oauth/2.0/token?grant_type=authorization_code&code={}&client_id={}&client_secret={}&redirect_uri=oob",
        code, client_id, client_secret
    );
    let resp = ureq::get(&url).call().map_err(|e| format!("网盘登录请求失败: {}", e))?;
    resp.into_string().map_err(|e| format!("解析网盘响应失败: {}", e))
}

#[tauri::command]
fn baidu_list_files(access_token: String, path: String) -> Result<String, String> {
    let url = format!(
        "https://pan.baidu.com/rest/2.0/xpan/file?method=list&access_token={}&dir={}&start=0&limit=1000",
        access_token, urlencoding::encode(&path)
    );
    let resp = ureq::get(&url).call().map_err(|e| format!("获取网盘文件列表失败: {}", e))?;
    resp.into_string().map_err(|e| format!("解析网盘文件列表失败: {}", e))
}

#[tauri::command]
fn baidu_get_text_file(access_token: String, fs_id: String) -> Result<String, String> {
    let url = format!(
        "https://pan.baidu.com/rest/2.0/xpan/multimedia?method=filemetas&access_token={}&fsids=[{}]&dlink=1",
        access_token, fs_id
    );
    let resp = ureq::get(&url).call().map_err(|e| format!("获取网盘链接失败: {}", e))?;
    let text = resp.into_string().map_err(|e| format!("解析网盘数据失败: {}", e))?;
    
    let val: serde_json::Value = serde_json::from_str(&text).map_err(|e| format!("解析 JSON 失败: {}", e))?;
    let dlink = val["list"][0]["dlink"].as_str().ok_or_else(|| "网盘未返回下载链接".to_string())?;
    
    let dlink_with_token = format!("{}&access_token={}", dlink, access_token);
    let file_resp = ureq::get(&dlink_with_token)
        .set("User-Agent", "pan.baidu.com")
        .call()
        .map_err(|e| format!("下载文件失败: {}", e))?;
        
    let mut content = String::new();
    file_resp.into_reader().read_to_string(&mut content).map_err(|e| format!("读取文件内容失败: {}", e))?;
    Ok(content)
}

#[tauri::command]
fn baidu_get_image(access_token: String, fs_id: String) -> Result<String, String> {

    // 1. Get download link (dlink) from filemetas
    let url = format!(
        "https://pan.baidu.com/rest/2.0/xpan/multimedia?method=filemetas&access_token={}&fsids=[{}]&dlink=1",
        access_token, fs_id
    );
    let resp = ureq::get(&url).call().map_err(|e| format!("获取网盘下载链接失败: {}", e))?;
    let text = resp.into_string().map_err(|e| format!("解析下载链接数据失败: {}", e))?;
    
    let val: serde_json::Value = serde_json::from_str(&text).map_err(|e| format!("解析 JSON 失败: {}", e))?;
    let dlink = val["list"][0]["dlink"].as_str().ok_or_else(|| "网盘未返回下载链接".to_string())?;
    let filename = val["list"][0]["server_filename"].as_str().unwrap_or("image.jpg");
    
    // 2. Fetch the image bytes with User-Agent set to pan.baidu.com (Required by Baidu)
    let dlink_with_token = format!("{}&access_token={}", dlink, access_token);
    let img_resp = ureq::get(&dlink_with_token)
        .set("User-Agent", "pan.baidu.com")
        .call()
        .map_err(|e| format!("从网盘下载图片失败: {}", e))?;
        
    let mut bytes = Vec::new();
    img_resp.into_reader().read_to_end(&mut bytes).map_err(|e| format!("读取图片数据失败: {}", e))?;
    
    // 3. Convert to base64 data URI
    let ext = filename.split('.').last().unwrap_or("jpg").to_lowercase();
    let mime = match ext.as_str() {
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        "svg" => "image/svg+xml",
        _ => "image/jpeg",
    };
    
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{};base64,{}", mime, b64))
}

#[tauri::command]
fn fetch_remote_image(url: String) -> Result<String, String> {
    let resp = ureq::get(&url)
        .set("User-Agent", "Mozilla/5.0")
        .call()
        .map_err(|e| format!("下载远程图片失败: {}", e))?;

    let content_type = resp.content_type().to_string();
    let mut bytes = Vec::new();
    resp.into_reader().read_to_end(&mut bytes).map_err(|e| format!("读取图片数据失败: {}", e))?;

    let mime = if content_type.contains("png") {
        "image/png"
    } else if content_type.contains("gif") {
        "image/gif"
    } else if content_type.contains("webp") {
        "image/webp"
    } else if content_type.contains("bmp") {
        "image/bmp"
    } else {
        "image/jpeg"
    };

    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{};base64,{}", mime, b64))
}

#[derive(serde::Serialize, Clone)]
struct UploadProgress {
    current: usize,
    total: usize,
    current_file: String,
}

#[tauri::command]
fn upload_local_images(app: AppHandle, base_path: Option<String>, brand: String, model: String) -> Result<(), String> {
    use tauri_plugin_dialog::DialogExt;
    app.dialog().file().add_filter("Images", &["png", "jpg", "jpeg", "webp"]).pick_files(move |files| {
        if let Some(paths) = files {
            let base = match base_path.as_deref() {
                Some(p) if !p.is_empty() => PathBuf::from(p),
                _ => get_base_dir().unwrap_or_default(),
            };
            let dest = base.join(&brand).join(&model);
            if !dest.exists() {
                let _ = std::fs::create_dir_all(&dest);
            }
            let total = paths.len();
            for (i, path) in paths.into_iter().enumerate() {
                if let Ok(p) = path.into_path() {
                    if let Some(file_name) = p.file_name() {
                        let _ = app.emit("upload_progress", UploadProgress {
                            current: i + 1,
                            total,
                            current_file: file_name.to_string_lossy().to_string(),
                        });
                        let _ = std::fs::copy(&p, dest.join(file_name));
                    }
                }
            }
            let _ = app.emit("refresh-data", ());
        }
    });
    Ok(())
}

#[derive(serde::Serialize)]
struct RebuildResult {
    count: usize,
    brands: usize,
    json: String,
    backup_path: String,
    changed: bool,
}

#[tauri::command]
fn rebuild_metadata(base_path: Option<String>) -> Result<RebuildResult, String> {
    let base = match base_path.as_deref() {
        Some(p) if !p.is_empty() => PathBuf::from(p),
        _ => get_base_dir()?,
    };
    if !base.is_dir() {
        return Err(format!("基础目录不存在: {}", base.display()));
    }

    let meta_path = base.join("metadata.json");
    let backup_path = base.join("metadata.json.bak");

    // Read top-level directories = brands (skip hidden / system / annotations)
    let brand_entries = std::fs::read_dir(&base)
        .map_err(|e| format!("扫描根目录失败: {}", e))?;
    let mut brands: Vec<(String, PathBuf)> = Vec::new();
    for entry in brand_entries.flatten() {
        let p = entry.path();
        if !p.is_dir() { continue; }
        let name = match p.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };
        if name.starts_with('.') { continue; }
        if name.starts_with('_') { continue; } // skip _annotations etc.
        brands.push((name, p));
    }
    brands.sort_by(|a, b| a.0.to_lowercase().cmp(&b.0.to_lowercase()));

    // Build the flat array of {brand, model, files, fileCount}
    let mut items: Vec<serde_json::Value> = Vec::new();
    for (brand, brand_dir) in &brands {
        let model_entries = match std::fs::read_dir(brand_dir) {
            Ok(r) => r,
            Err(_) => continue,
        };
        let mut models: Vec<(String, PathBuf)> = Vec::new();
        for mentry in model_entries.flatten() {
            let mp = mentry.path();
            if !mp.is_dir() { continue; }
            let mname = match mp.file_name().and_then(|n| n.to_str()) {
                Some(n) => n.to_string(),
                None => continue,
            };
            if mname.starts_with('.') { continue; }
            models.push((mname, mp));
        }
        models.sort_by(|a, b| a.0.to_lowercase().cmp(&b.0.to_lowercase()));

        for (model, model_dir) in &models {
            let files = collect_files_sorted(model_dir);
            if files.is_empty() { continue; }
            items.push(serde_json::json!({
                "brand": brand,
                "model": model,
                "files": files,
                "fileCount": files.len(),
            }));
        }
    }

    // Serialize compact (one line) like the existing file, with UTF-8 BOM + CRLF
    let body = serde_json::to_string(&items)
        .map_err(|e| format!("序列化失败: {}", e))?;
    let old_body = std::fs::read_to_string(&meta_path)
        .ok()
        .map(|s| s.trim_start_matches('\u{feff}').trim().to_string());
    let changed = old_body.as_deref() != Some(body.as_str());

    if changed && meta_path.exists() {
        let _ = std::fs::copy(&meta_path, &backup_path);
    }

    let mut out: Vec<u8> = Vec::with_capacity(body.len() + 5);
    out.extend_from_slice(&[0xEF, 0xBB, 0xBF]); // UTF-8 BOM
    out.extend_from_slice(body.as_bytes());
    out.extend_from_slice(b"\r\n");
    if changed {
        std::fs::write(&meta_path, &out)
            .map_err(|e| format!("写入 metadata.json 失败: {}", e))?;
    }

    Ok(RebuildResult {
        count: items.len(),
        brands: brands.len(),
        json: body,
        backup_path: backup_path.to_string_lossy().to_string(),
        changed,
    })
}

#[derive(serde::Serialize)]
struct SyncResult {
    success: bool,
    message: String,
    commit_hash: String,
}

#[tauri::command]
async fn sync_to_github(base_path: Option<String>) -> Result<SyncResult, String> {
    let base = match base_path.as_deref() {
        Some(p) if !p.is_empty() => PathBuf::from(p),
        _ => get_base_dir()?,
    };
    if !base.is_dir() {
        return Err(format!("同步失败：目录不存在: {}", base.display()));
    }
    if !base.join(".git").is_dir() {
        return Err(format!("同步失败：目录不是 Git 仓库: {}", base.display()));
    }

    #[cfg(target_os = "windows")]
    use std::os::windows::process::CommandExt;

    // Resolve the SSH key path once so the subprocess can always find it
    let ssh_key_path = {
        let home = std::env::var("USERPROFILE")
            .or_else(|_| std::env::var("HOME"))
            .unwrap_or_else(|_| "C:\\Users\\Baven".to_string());
        format!("{}/.ssh/id_ed25519_github", home.replace('\\', "/"))
    };
    let ssh_cmd = format!(
        "ssh -i \"{}\" -o StrictHostKeyChecking=no -o ServerAliveInterval=60",
        ssh_key_path
    );

    let log_file = format!("{}/sync_debug.log", base.display());
    let append_log = |msg: &str| {
        use std::io::Write;
        if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(&log_file) {
            let _ = writeln!(f, "[{}] {}", chrono_placeholder(), msg);
        }
        eprintln!("{}", msg);
    };

    append_log("=== 开始同步 ===");

    let run = |args: &[&str]| -> Result<String, String> {
        let mut cmd = std::process::Command::new("git");
        cmd.args(args).current_dir(&base);
        cmd.env("GIT_TERMINAL_PROMPT", "0");
        cmd.env("GIT_HTTP_LOW_SPEED_TIME", "15");
        cmd.env("GIT_HTTP_LOW_SPEED_LIMIT", "1000");
        // Explicitly point git to the SSH key so it works as a no-window subprocess
        cmd.env("GIT_SSH_COMMAND", &ssh_cmd);
        if let Ok(home) = std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME")) {
            cmd.env("HOME", &home);
        }
        #[cfg(target_os = "windows")]
        {
            cmd.creation_flags(0x08000000);
        }
        cmd.stdout(std::process::Stdio::piped());
        cmd.stderr(std::process::Stdio::piped());
        
        let step = args.join(" ");
        append_log(&format!("执行: git {}", step));
        let child = cmd.spawn().map_err(|e| format!("执行 git {} 失败: {}", step, e))?;
        let child_pid = child.id();

        let (tx, rx) = std::sync::mpsc::channel();
        std::thread::spawn(move || { let _ = tx.send(child.wait_with_output()); });

        const TIMEOUT: std::time::Duration = std::time::Duration::from_secs(120);
        let output = match rx.recv_timeout(TIMEOUT) {
            Ok(Ok(out)) => out,
            Ok(Err(e)) => {
                append_log(&format!("git {} 等待失败: {}", step, e));
                return Err(format!("git {} 等待失败: {}", step, e));
            }
            Err(_) => {
                #[cfg(target_os = "windows")]
                { let _ = std::process::Command::new("taskkill").args(["/F", "/T", "/PID", &child_pid.to_string()]).spawn(); }
                #[cfg(unix)]
                { let _ = std::process::Command::new("kill").args(["-9", &child_pid.to_string()]).spawn(); }
                append_log(&format!("git {} 超时(120s)，已强制终止", step));
                return Err(format!("git {} 超时(120s)，已强制终止", step));
            }
        };
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        
        if !output.status.success() {
            append_log(&format!("git {} 失败，退出码: {:?}", step, output.status.code()));
            append_log(&format!("stdout: {}", stdout));
            append_log(&format!("stderr: {}", stderr));
            return Err(format!("git {} 失败: {}", step, stderr));
        }
        append_log(&format!("git {} 成功", step));
        if !stdout.is_empty() {
            append_log(&format!("stdout: {}", stdout));
        }
        if !stderr.is_empty() {
            append_log(&format!("stderr: {}", stderr));
        }
        Ok(stdout)
    };

    run(&["add", "-A"])?;

    let status_out = run(&["status", "--porcelain"])?;
    if !status_out.trim().is_empty() {
        let now = chrono_placeholder();
        let msg = format!("Rebuild & sync images {}", now);
        let commit_result = run(&["commit", "-m", &msg, "--no-verify"]);
        if let Err(e) = commit_result {
            if !e.contains("nothing to commit") && !e.contains("nothing added") && !e.contains("无文件要提交") {
                return Err(format!("Git commit 失败: {}", e));
            }
        }
    }

    let hash = run(&["rev-parse", "--short", "HEAD"])?;

    // Push — if it fails only due to diverged history, pull and retry once.
    // IMPORTANT: never pull on timeout or other errors (pull would restore deleted files).
    match run(&["push", "origin", "main"]) {
        Ok(_) => {}
        Err(e) => {
            let is_diverged = e.contains("rejected")
                || e.contains("non-fast-forward")
                || e.contains("fetch first")
                || e.contains("[rejected]");
            if is_diverged {
                // Remote has new commits we don't have — merge and retry
                let _ = run(&["pull", "origin", "main", "--no-edit"]);
                run(&["push", "origin", "main"])
                    .map_err(|e2| format!("GitHub push 失败: {}", e2))?;
            } else {
                return Err(format!("GitHub push 失败: {}", e));
            }
        }
    }

    // CDN purge — best effort, errors ignored
    let cdn_purge_base = "https://purge.jsdelivr.net/gh/bavenbaven/ERS-Tech-ISP-Images@main";
    for file in &["metadata.json", "versions.json"] {
        let url = format!("{}/{}", cdn_purge_base, file);
        let _ = ureq::get(&url).call();
    }

    Ok(SyncResult {
        success: true,
        message: format!("同步完成，CDN 缓存已清除。版本: {}", hash),
        commit_hash: hash,
    })
}

fn chrono_placeholder() -> String {
    // Simple timestamp without extra crate
    use std::time::SystemTime;
    let Ok(dur) = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH) else {
        return "unknown".into();
    };
    let secs = dur.as_secs();
    // Rough UTC time formatting
    let h = (secs % 86400) / 3600;
    let m = (secs % 3600) / 60;
    let s = secs % 60;
    format!("{:02}:{:02}:{:02} UTC", h, m, s)
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &url.replace("&", "^&")])
            .spawn()
            .map_err(|e| format!("打开浏览器失败: {}", e))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("打开浏览器失败: {}", e))?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("打开浏览器失败: {}", e))?;
    }
    Ok(())
}

// ── Online Update ────────────────────────────────────────────────────────────

const VERSIONS_JSON_URL: &str = "https://cdn.jsdelivr.net/gh/bavenbaven/ERS-Tech-ISP--@main/versions.json";

fn get_current_version() -> String {
    // Embedded at compile time from Cargo.toml
    env!("CARGO_PKG_VERSION").to_string()
}

/// Compare two semver strings like "0.1.0" vs "0.2.0".
/// Returns Ordering: a < b => Less, a == b => Equal, a > b => Greater.
fn semver_cmp(a: &str, b: &str) -> std::cmp::Ordering {
    let parse = |v: &str| -> Vec<u32> {
        v.split('.')
            .filter_map(|s| s.parse::<u32>().ok())
            .collect()
    };
    let pa = parse(a);
    let pb = parse(b);
    pa.cmp(&pb)
}

#[derive(serde::Serialize, Clone)]
struct VersionCheckResult {
    blocked: bool,
    current: String,
    min_version: String,
    latest: String,
    latest_url: String,
    changelog: String,
    message: String,
}

#[tauri::command]
fn fetch_versions_json() -> Result<String, String> {
    let resp = ureq::get(VERSIONS_JSON_URL)
        .set("User-Agent", "ERS-Tech-ISP-Updater")
        .call()
        .map_err(|e| format!("获取版本信息失败: {}", e))?;
    resp.into_string()
        .map_err(|e| format!("读取版本信息失败: {}", e))
}

#[tauri::command]
fn check_version_block() -> Result<VersionCheckResult, String> {
    let current = get_current_version();

    // Network failure => allow use
    let json_str = match fetch_versions_json() {
        Ok(s) => s,
        Err(_) => {
            return Ok(VersionCheckResult {
                blocked: false,
                current: current.clone(),
                min_version: String::new(),
                latest: String::new(),
                latest_url: String::new(),
                changelog: String::new(),
                message: "网络检查失败，允许使用".to_string(),
            });
        }
    };

    let val: serde_json::Value =
        serde_json::from_str(&json_str).map_err(|e| format!("解析版本信息失败: {}", e))?;

    let latest = val["latest"].as_str().unwrap_or("").to_string();
    let min_version = val["min_version"].as_str().unwrap_or("").to_string();

    // Find latest version entry for download URL & changelog
    let mut latest_url = String::new();
    let mut changelog = String::new();
    if let Some(versions) = val["versions"].as_array() {
        for v in versions {
            if v["version"].as_str() == Some(&latest) {
                latest_url = v["url"].as_str().unwrap_or("").to_string();
                changelog = v["changelog"].as_str().unwrap_or("").to_string();
                break;
            }
        }
    }

    let blocked = if !min_version.is_empty() {
        semver_cmp(&current, &min_version) == std::cmp::Ordering::Less
    } else {
        false
    };

    let message = if blocked {
        format!(
            "您的版本 v{} 已不再支持，请更新到最新版本 v{} 以继续使用",
            current, latest
        )
    } else if !latest.is_empty() && semver_cmp(&current, &latest) == std::cmp::Ordering::Less {
        format!("发现新版本 v{}，当前版本 v{}", latest, current)
    } else {
        "已是最新版本".to_string()
    };

    Ok(VersionCheckResult {
        blocked,
        current,
        min_version,
        latest,
        latest_url,
        changelog,
        message,
    })
}

#[tauri::command]
fn download_update(url: String, version: String) -> Result<String, String> {
    let resp = ureq::get(&url)
        .set("User-Agent", "ERS-Tech-ISP-Updater")
        .call()
        .map_err(|e| format!("下载更新失败: {}", e))?;

    let temp_dir = std::env::temp_dir();
    let filename = format!("ERS-Tech-ISP-短接宝典_{}_x64-setup.exe", version);
    let dest = temp_dir.join(&filename);

    let mut bytes = Vec::new();
    resp.into_reader()
        .read_to_end(&mut bytes)
        .map_err(|e| format!("读取更新数据失败: {}", e))?;

    std::fs::write(&dest, &bytes)
        .map_err(|e| format!("保存更新文件失败: {}", e))?;

    Ok(dest.to_string_lossy().to_string())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            get_base_dir_str,
            get_metadata,
            get_metadata_from_path,
            read_image_base64,
            read_image_base64_from_path,
            save_annotation,
            load_annotation,
            baidu_get_auth_url,
            baidu_exchange_token,
            baidu_list_files,
            baidu_get_image,
            baidu_get_text_file,
            open_baidu_login_window,
            fetch_remote_image,
            rebuild_metadata,
            sync_to_github,
            open_url,
            upload_local_images,
            fetch_versions_json,
            check_version_block,
            download_update
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
