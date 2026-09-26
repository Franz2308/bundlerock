use crate::models::{
    DownloadProgressPayload, DownloadSegment, DownloadStatus, DownloadTask, ExtractorStatus,
    MediaFormatOption, MediaGalleryItem, MediaMetadata, SegmentStatus, SocialMediaPlatform,
};
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::sync::{watch, RwLock};
use url::Url;

/// Detects if a URL belongs to a supported social media platform and returns its classification and level:
/// - Level 1: YouTube, Twitter / X
/// - Level 2: Facebook
/// - Level 3: Reddit
pub fn detect_platform(url_str: &str) -> Option<(SocialMediaPlatform, u8, String)> {
    let clean = url_str.trim();
    if clean.is_empty() {
        return None;
    }
    let parsed = Url::parse(clean)
        .or_else(|_| Url::parse(&format!("https://{clean}")))
        .ok()?;
    let host = parsed.host_str()?.to_ascii_lowercase();

    // If URL path points directly to a static image file or image CDN, treat as direct accelerated download
    let path_lower = parsed.path().to_ascii_lowercase();
    if path_lower.ends_with(".jpg")
        || path_lower.ends_with(".jpeg")
        || path_lower.ends_with(".png")
        || path_lower.ends_with(".webp")
        || path_lower.ends_with(".gif")
        || path_lower.ends_with(".svg")
        || path_lower.ends_with(".bmp")
        || host == "i.redd.it"
        || host == "preview.redd.it"
        || host == "pbs.twimg.com"
    {
        return None;
    }

    // Level 1: YouTube
    if host == "youtube.com"
        || host.ends_with(".youtube.com")
        || host == "youtu.be"
        || host.ends_with(".youtu.be")
    {
        return Some((SocialMediaPlatform::YouTube, 1, "YouTube".to_string()));
    }

    // Level 1: Twitter / X
    if host == "twitter.com"
        || host.ends_with(".twitter.com")
        || host == "x.com"
        || host.ends_with(".x.com")
    {
        return Some((SocialMediaPlatform::Twitter, 1, "X (Twitter)".to_string()));
    }

    // Level 2: Facebook
    if host == "facebook.com"
        || host.ends_with(".facebook.com")
        || host == "fb.watch"
        || host == "fb.com"
        || host.ends_with(".fb.com")
    {
        return Some((SocialMediaPlatform::Facebook, 2, "Facebook".to_string()));
    }

    // Level 3: Reddit
    if host == "reddit.com"
        || host.ends_with(".reddit.com")
        || host == "redd.it"
        || host.ends_with(".redd.it")
    {
        return Some((SocialMediaPlatform::Reddit, 3, "Reddit".to_string()));
    }

    // Other streaming sites known to work with media extractors (Instagram, TikTok, Twitch, Vimeo)
    if host == "instagram.com"
        || host.ends_with(".instagram.com")
        || host == "tiktok.com"
        || host.ends_with(".tiktok.com")
        || host == "twitch.tv"
        || host.ends_with(".twitch.tv")
        || host == "vimeo.com"
        || host.ends_with(".vimeo.com")
    {
        return Some((
            SocialMediaPlatform::Other,
            1,
            format!("Stream ({host})"),
        ));
    }

    None
}

/// Returns the dedicated directory for BundleRock managed binaries (yt-dlp, ffmpeg)
pub fn get_bundlerock_bin_dir() -> PathBuf {
    #[cfg(windows)]
    {
        if let Ok(appdata) = std::env::var("APPDATA") {
            let p = PathBuf::from(appdata).join("BundleRock").join("bin");
            let _ = std::fs::create_dir_all(&p);
            return p;
        }
    }

    #[cfg(not(windows))]
    {
        if let Ok(home) = std::env::var("HOME") {
            let p = PathBuf::from(home)
                .join(".local")
                .join("share")
                .join("BundleRock")
                .join("bin");
            let _ = std::fs::create_dir_all(&p);
            return p;
        }
    }

    let p = std::env::current_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("bin");
    let _ = std::fs::create_dir_all(&p);
    p
}

/// Finds the `yt-dlp` executable on the system
pub fn find_ytdlp() -> Option<PathBuf> {
    #[cfg(windows)]
    let exe_name = "yt-dlp.exe";
    #[cfg(not(windows))]
    let exe_name = "yt-dlp";

    // 1. Environment variable override
    if let Ok(custom) = std::env::var("BUNDLEROCK_YTDLP_PATH") {
        let p = PathBuf::from(custom);
        if p.exists() {
            return Some(p);
        }
    }

    // 2. Managed BundleRock bin directory
    let managed = get_bundlerock_bin_dir().join(exe_name);
    if managed.exists() {
        return Some(managed);
    }

    // 3. Current executable directory / local ./bin
    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(parent) = current_exe.parent() {
            let candidate = parent.join(exe_name);
            if candidate.exists() {
                return Some(candidate);
            }
            let bin_candidate = parent.join("bin").join(exe_name);
            if bin_candidate.exists() {
                return Some(bin_candidate);
            }
        }
    }

    // 4. Working directory
    let local = PathBuf::from(exe_name);
    if local.exists() {
        return Some(local);
    }
    let local_bin = PathBuf::from("bin").join(exe_name);
    if local_bin.exists() {
        return Some(local_bin);
    }

    // 5. System PATH lookup
    if let Some(path_var) = std::env::var_os("PATH") {
        for dir in std::env::split_paths(&path_var) {
            let candidate = dir.join(exe_name);
            if candidate.exists() {
                return Some(candidate);
            }
        }
    }

    // 6. Common Windows paths
    #[cfg(windows)]
    {
        let common_paths = [
            r"C:\yt-dlp\yt-dlp.exe",
            r"C:\Program Files\yt-dlp\yt-dlp.exe",
            r"C:\ProgramData\chocolatey\bin\yt-dlp.exe",
            r"C:\tools\yt-dlp\yt-dlp.exe",
        ];
        for cp in &common_paths {
            let p = PathBuf::from(cp);
            if p.exists() {
                return Some(p);
            }
        }
    }

    None
}

/// Finds the `ffmpeg` executable on the system
pub fn find_ffmpeg() -> Option<PathBuf> {
    #[cfg(windows)]
    let exe_name = "ffmpeg.exe";
    #[cfg(not(windows))]
    let exe_name = "ffmpeg";

    // 1. Environment variable override
    if let Ok(custom) = std::env::var("BUNDLEROCK_FFMPEG_PATH") {
        let p = PathBuf::from(custom);
        if p.exists() {
            return Some(p);
        }
    }

    // 2. Managed BundleRock bin directory
    let managed = get_bundlerock_bin_dir().join(exe_name);
    if managed.exists() {
        return Some(managed);
    }

    // 3. Same directory as yt-dlp if found
    if let Some(ytdlp_path) = find_ytdlp() {
        if let Some(parent) = ytdlp_path.parent() {
            let candidate = parent.join(exe_name);
            if candidate.exists() {
                return Some(candidate);
            }
        }
    }

    // 4. Current executable directory / local ./bin
    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(parent) = current_exe.parent() {
            let candidate = parent.join(exe_name);
            if candidate.exists() {
                return Some(candidate);
            }
            let bin_candidate = parent.join("bin").join(exe_name);
            if bin_candidate.exists() {
                return Some(bin_candidate);
            }
        }
    }

    // 5. System PATH lookup
    if let Some(path_var) = std::env::var_os("PATH") {
        for dir in std::env::split_paths(&path_var) {
            let candidate = dir.join(exe_name);
            if candidate.exists() {
                return Some(candidate);
            }
        }
    }

    // 6. Common Windows paths
    #[cfg(windows)]
    {
        let mut common_paths = vec![
            PathBuf::from(r"C:\ffmpeg\bin\ffmpeg.exe"),
            PathBuf::from(r"C:\ffmpeg\ffmpeg.exe"),
            PathBuf::from(r"C:\Program Files\ffmpeg\bin\ffmpeg.exe"),
            PathBuf::from(r"C:\Program Files\ffmpeg\ffmpeg.exe"),
            PathBuf::from(r"C:\ProgramData\chocolatey\bin\ffmpeg.exe"),
            PathBuf::from(r"C:\tools\ffmpeg\bin\ffmpeg.exe"),
        ];

        if let Ok(userprofile) = std::env::var("USERPROFILE") {
            let up = PathBuf::from(&userprofile);
            common_paths.push(up.join("scoop").join("shims").join("ffmpeg.exe"));
            common_paths.push(up.join("scoop").join("apps").join("ffmpeg").join("current").join("bin").join("ffmpeg.exe"));
            common_paths.push(up.join("AppData").join("Local").join("Microsoft").join("WinGet").join("Links").join("ffmpeg.exe"));
        }
        if let Ok(localappdata) = std::env::var("LOCALAPPDATA") {
            let lp = PathBuf::from(&localappdata);
            common_paths.push(lp.join("Microsoft").join("WinGet").join("Links").join("ffmpeg.exe"));
        }

        for cp in &common_paths {
            if cp.exists() {
                return Some(cp.clone());
            }
        }
    }

    None
}

/// Returns the status of the multimedia extraction engine (yt-dlp and ffmpeg)
pub fn get_extractor_status() -> ExtractorStatus {
    let ytdlp = find_ytdlp();
    let ffmpeg = find_ffmpeg();

    ExtractorStatus {
        ytdlp_installed: ytdlp.is_some(),
        ytdlp_path: ytdlp.map(|p| p.to_string_lossy().to_string()),
        ffmpeg_installed: ffmpeg.is_some(),
        ffmpeg_path: ffmpeg.map(|p| p.to_string_lossy().to_string()),
    }
}

/// Downloads and installs yt-dlp automatically into BundleRock's managed bin directory
pub async fn install_ytdlp(_client: &reqwest::Client) -> Result<String, String> {
    #[cfg(windows)]
    let (url, filename) = (
        "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe",
        "yt-dlp.exe",
    );
    #[cfg(target_os = "macos")]
    let (url, filename) = (
        "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos",
        "yt-dlp",
    );
    #[cfg(all(not(windows), not(target_os = "macos")))]
    let (url, filename) = (
        "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp",
        "yt-dlp",
    );

    let bin_dir = get_bundlerock_bin_dir();
    let target_file = bin_dir.join(filename);
    let tmp_file = bin_dir.join(format!("{filename}.tmp"));

    // Dedicated client with extended timeout for large ~40MB binary download
    let download_client = reqwest::Client::builder()
        .timeout(Duration::from_secs(300))
        .build()
        .unwrap_or_default();

    let response = download_client
        .get(url)
        .header("User-Agent", "BundleRock/0.1.0 (Downloader)")
        .send()
        .await
        .map_err(|e| format!("Error descargando yt-dlp: {e}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "El servidor de descarga respondió con estado HTTP {}",
            response.status()
        ));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Error recibiendo archivo yt-dlp: {e}"))?;

    std::fs::write(&tmp_file, bytes)
        .map_err(|e| format!("Error guardando archivo temporal yt-dlp en disco: {e}"))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(&tmp_file)
            .map_err(|e| e.to_string())?
            .permissions();
        perms.set_mode(0o755);
        let _ = std::fs::set_permissions(&tmp_file, perms);
    }

    // Atomically replace target file
    let _ = std::fs::remove_file(&target_file);
    std::fs::rename(&tmp_file, &target_file)
        .map_err(|e| format!("Error finalizando instalación de yt-dlp: {e}"))?;

    // Download FFmpeg
    #[cfg(windows)]
    let (ff_url, ff_filename) = (
        "https://github.com/eugeneware/ffmpeg-static/releases/latest/download/win32-x64",
        "ffmpeg.exe",
    );
    #[cfg(target_os = "macos")]
    let (ff_url, ff_filename) = (
        "https://github.com/eugeneware/ffmpeg-static/releases/latest/download/darwin-x64",
        "ffmpeg",
    );
    #[cfg(all(not(windows), not(target_os = "macos")))]
    let (ff_url, ff_filename) = (
        "https://github.com/eugeneware/ffmpeg-static/releases/latest/download/linux-x64",
        "ffmpeg",
    );

    let ff_target_file = bin_dir.join(ff_filename);
    let ff_tmp_file = bin_dir.join(format!("{ff_filename}.tmp"));

    if let Ok(ff_response) = download_client
        .get(ff_url)
        .header("User-Agent", "BundleRock/0.1.0 (Downloader)")
        .send()
        .await
    {
        if ff_response.status().is_success() {
            if let Ok(ff_bytes) = ff_response.bytes().await {
                if std::fs::write(&ff_tmp_file, ff_bytes).is_ok() {
                    #[cfg(unix)]
                    {
                        use std::os::unix::fs::PermissionsExt;
                        if let Ok(meta) = std::fs::metadata(&ff_tmp_file) {
                            let mut perms = meta.permissions();
                            perms.set_mode(0o755);
                            let _ = std::fs::set_permissions(&ff_tmp_file, perms);
                        }
                    }
                    let _ = std::fs::remove_file(&ff_target_file);
                    let _ = std::fs::rename(&ff_tmp_file, &ff_target_file);
                }
            }
        }
    }

    Ok(target_file.to_string_lossy().to_string())
}

/// Determines if a Facebook URL points to a video/reel stream as opposed to a photo, album, or general post.
pub fn is_facebook_video_url(url_str: &str) -> bool {
    let lower = url_str.to_ascii_lowercase();
    lower.contains("fb.watch")
        || lower.contains("/watch")
        || lower.contains("/reel")
        || lower.contains("/reels")
        || lower.contains("/videos/")
        || lower.contains("video.php")
        || lower.contains("/share/r/")
        || lower.contains("/share/v/")
}

/// Helper to decode basic HTML entities in extracted meta content
pub fn clean_html_entities(s: &str) -> String {
    s.replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&apos;", "'")
        .replace("&#39;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
}

/// Helper to parse OpenGraph and meta tags from HTML
pub fn extract_meta_tag(html: &str, property: &str) -> Option<String> {
    let prop_lower = property.to_ascii_lowercase();
    for part in html.split('<') {
        let tag = part.split('>').next().unwrap_or("");
        let tag_trimmed = tag.trim_start();
        let after_meta = tag_trimmed.strip_prefix("meta");
        if !matches!(after_meta, Some(rest) if rest.starts_with(|c: char| c.is_whitespace())) {
            continue;
        }
        let tag_lower = tag.to_ascii_lowercase();
        if tag_lower.contains(&format!("property=\"{prop_lower}\""))
            || tag_lower.contains(&format!("property='{prop_lower}'"))
            || tag_lower.contains(&format!("name=\"{prop_lower}\""))
            || tag_lower.contains(&format!("name='{prop_lower}'"))
        {
            if let Some(c_idx) = tag_lower.find("content=\"") {
                let rest = &tag[c_idx + 9..];
                if let Some(end_quote) = rest.find('"') {
                    return Some(clean_html_entities(&rest[..end_quote]));
                }
            } else if let Some(c_idx) = tag_lower.find("content='") {
                let rest = &tag[c_idx + 9..];
                if let Some(end_quote) = rest.find('\'') {
                    return Some(clean_html_entities(&rest[..end_quote]));
                }
            }
        }
    }
    None
}

/// Helper to parse link tags like <link rel="image_src" href="..." /> from HTML
pub fn extract_link_tag(html: &str, rel: &str) -> Option<String> {
    let rel_lower = rel.to_ascii_lowercase();
    for part in html.split('<') {
        let tag = part.split('>').next().unwrap_or("");
        let tag_trimmed = tag.trim_start();
        let after_link = tag_trimmed.strip_prefix("link");
        if !matches!(after_link, Some(rest) if rest.starts_with(|c: char| c.is_whitespace())) {
            continue;
        }
        let tag_lower = tag.to_ascii_lowercase();
        if tag_lower.contains(&format!("rel=\"{rel_lower}\""))
            || tag_lower.contains(&format!("rel='{rel_lower}'"))
        {
            if let Some(c_idx) = tag_lower.find("href=\"") {
                let rest = &tag[c_idx + 6..];
                if let Some(end_quote) = rest.find('"') {
                    return Some(clean_html_entities(&rest[..end_quote]));
                }
            } else if let Some(c_idx) = tag_lower.find("href='") {
                let rest = &tag[c_idx + 6..];
                if let Some(end_quote) = rest.find('\'') {
                    return Some(clean_html_entities(&rest[..end_quote]));
                }
            }
        }
    }
    None
}

/// Extracts OpenGraph image and metadata from a Facebook photo or post URL without forcing yt-dlp mp4 video downloads.
pub async fn probe_facebook_photo_or_post(
    client: &reqwest::Client,
    target_url: &str,
) -> Result<MediaMetadata, String> {
    let resp = client
        .get(target_url)
        .header(
            "User-Agent",
            "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
        )
        .header(
            "Accept",
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        )
        .header("Accept-Language", "es-ES,es;q=0.9,en;q=0.8")
        .timeout(Duration::from_secs(8))
        .send()
        .await;

    let html = match resp {
        Ok(r) if r.status().is_success() => r.text().await.unwrap_or_default(),
        _ => {
            if let Ok(r2) = client
                .get(target_url)
                .header(
                    "User-Agent",
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                )
                .timeout(Duration::from_secs(6))
                .send()
                .await
            {
                r2.text().await.unwrap_or_default()
            } else {
                String::new()
            }
        }
    };

    let og_image = extract_meta_tag(&html, "og:image")
        .or_else(|| extract_meta_tag(&html, "og:image:url"))
        .or_else(|| extract_meta_tag(&html, "twitter:image"))
        .or_else(|| extract_link_tag(&html, "image_src"));

    let og_title = extract_meta_tag(&html, "og:title")
        .or_else(|| extract_meta_tag(&html, "twitter:title"))
        .unwrap_or_else(|| "Foto de Facebook".to_string());

    let og_description = extract_meta_tag(&html, "og:description");

    if let Some(img_url) = og_image {
        if img_url.starts_with("http://") || img_url.starts_with("https://") {
            let clean_img = clean_html_entities(&img_url);
            return Ok(MediaMetadata {
                title: og_title,
                uploader: og_description,
                thumbnail_url: Some(clean_img.clone()),
                duration_seconds: None,
                platform: SocialMediaPlatform::Facebook,
                platform_level: 2,
                platform_display: "Facebook".to_string(),
                formats: vec![], // No video formats: image downloads as accelerated HTTP
                gallery_items: vec![MediaGalleryItem {
                    url: clean_img.clone(),
                    thumbnail_url: Some(clean_img),
                    width: None,
                    height: None,
                    index: 0,
                }],
                is_animated_gif: false,
            });
        }
    }

    Err("Esta publicación o foto de Facebook no contiene un video o requiere iniciar sesión en Facebook. Para descargar fotos de Facebook con BundleRock, asegúrate de que la publicación sea de acceso público.".to_string())
}

/// Probes a multimedia URL: if yt-dlp is available, uses it to extract full video metadata and formats.
/// If yt-dlp is not yet installed, uses fallback platform APIs (oEmbed/Reddit JSON) and defaults.
pub async fn probe_media(
    client: &reqwest::Client,
    target_url: &str,
) -> Result<MediaMetadata, String> {
    let (platform, level, platform_display) = detect_platform(target_url).unwrap_or((
        SocialMediaPlatform::Other,
        1,
        "Multimedia".to_string(),
    ));

    // Level 2: Facebook photo / post differentiation (avoid forcing yt-dlp on photos)
    if platform == SocialMediaPlatform::Facebook && !is_facebook_video_url(target_url) {
        return probe_facebook_photo_or_post(client, target_url).await;
    }

    // Try yt-dlp extraction first if available
    if let Some(ytdlp_path) = find_ytdlp() {
        let mut cmd = tokio::process::Command::new(&ytdlp_path);
        cmd.arg("--dump-single-json")
            .arg("--no-warnings")
            .arg("--skip-download");

        if platform == SocialMediaPlatform::YouTube {
            cmd.arg("--no-playlist");
        } else {
            cmd.arg("--playlist-items").arg("1-20");
        }

        cmd.arg(target_url);

        #[cfg(windows)]
        {
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        let output = tokio::time::timeout(Duration::from_secs(20), cmd.output()).await;
        if let Ok(Ok(out)) = output {
            if out.status.success() {
                if let Ok(json_str) = String::from_utf8(out.stdout) {
                    let trimmed = json_str.trim();
                    let json_payload = if let Some(idx) = trimmed.find('{') {
                        &trimmed[idx..]
                    } else {
                        trimmed
                    };
                    if let Ok(parsed_json) = serde_json::from_str::<serde_json::Value>(json_payload) {
                        let mut meta = build_media_metadata_from_ytdlp_json(
                            parsed_json,
                            platform.clone(),
                            level,
                            platform_display.clone(),
                        );

                        // If gallery_items was not extracted by yt-dlp, enrich with platform-specific extractors
                        if meta.gallery_items.is_empty() {
                            match platform {
                                SocialMediaPlatform::Twitter => {
                                    let (_, _, _, tw_items, tw_gif) = extract_twitter_data(client, target_url).await;
                                    if !tw_items.is_empty() {
                                        meta.gallery_items = tw_items;
                                    }
                                    if tw_gif && !meta.is_animated_gif {
                                        meta.is_animated_gif = true;
                                        meta.formats.insert(0, MediaFormatOption {
                                            format_id: "twitter-gif".to_string(),
                                            quality_label: "GIF Animado (.gif)".to_string(),
                                            ext: "gif".to_string(),
                                            resolution: Some("Animación GIF".to_string()),
                                            filesize_approx: None,
                                            is_audio_only: false,
                                            format_note: Some("Convertir stream a archivo .gif con paleta optimizada".to_string()),
                                        });
                                        meta.formats.insert(1, MediaFormatOption {
                                            format_id: "twitter-mp4".to_string(),
                                            quality_label: "Video en bucle MP4 (.mp4)".to_string(),
                                            ext: "mp4".to_string(),
                                            resolution: Some("Video MP4".to_string()),
                                            filesize_approx: None,
                                            is_audio_only: false,
                                            format_note: Some("Stream de video MP4 original sin reconvertir".to_string()),
                                        });
                                    }
                                }
                                SocialMediaPlatform::Reddit => {
                                    let (_, _, _, _, _, r_items) = extract_reddit_data(client, target_url).await;
                                    if !r_items.is_empty() {
                                        meta.gallery_items = r_items;
                                    }
                                }
                                _ => {}
                            }
                        }

                        return Ok(meta);
                    }
                }
            }
        }
    }

    // Fallback: Use platform APIs to extract title, thumbnail, author and gallery items
    probe_media_fallback(client, target_url, platform, level, platform_display).await
}

/// Builds structured `MediaMetadata` from yt-dlp JSON dump
fn build_media_metadata_from_ytdlp_json(
    json: serde_json::Value,
    platform: SocialMediaPlatform,
    level: u8,
    platform_display: String,
) -> MediaMetadata {
    let title = json
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("video_multimedia")
        .trim()
        .to_string();

    let uploader = json
        .get("uploader")
        .or_else(|| json.get("channel"))
        .or_else(|| json.get("creator"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let thumbnail_url = json
        .get("thumbnail")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let duration_seconds = json
        .get("duration")
        .and_then(|v| v.as_f64().map(|f| f as u64).or_else(|| v.as_u64()));

    // Analyze available heights and codecs in formats
    let mut available_heights = Vec::new();
    let mut has_audio = false;

    // Check top-level filesize first
    let mut estimated_size_best = json
        .get("filesize")
        .or_else(|| json.get("filesize_approx"))
        .and_then(|v| v.as_u64());

    if let Some(formats) = json.get("formats").and_then(|v| v.as_array()) {
        let mut max_video_size = 0u64;
        let mut max_audio_size = 0u64;

        for f in formats {
            if let Some(h) = f.get("height").and_then(|v| v.as_u64()) {
                if !available_heights.contains(&h) {
                    available_heights.push(h);
                }
            }
            if let Some(acodec) = f.get("acodec").and_then(|v| v.as_str()) {
                if acodec != "none" {
                    has_audio = true;
                }
            }

            let sz = f
                .get("filesize")
                .or_else(|| f.get("filesize_approx"))
                .and_then(|v| v.as_u64())
                .unwrap_or(0);

            let vcodec = f.get("vcodec").and_then(|v| v.as_str()).unwrap_or("none");
            let acodec = f.get("acodec").and_then(|v| v.as_str()).unwrap_or("none");

            if vcodec != "none" && acodec != "none" {
                if sz > max_video_size {
                    max_video_size = sz;
                }
            } else if vcodec != "none" {
                if sz > max_video_size {
                    max_video_size = sz;
                }
            } else if acodec != "none" {
                if sz > max_audio_size {
                    max_audio_size = sz;
                }
            }
        }

        if estimated_size_best.is_none() {
            let total = max_video_size + max_audio_size;
            if total > 0 {
                estimated_size_best = Some(total);
            }
        }
    }
    available_heights.sort_unstable();
    available_heights.reverse(); // descending

    let has_real_formats = json
        .get("formats")
        .and_then(|v| v.as_array())
        .map(|a| !a.is_empty())
        .unwrap_or(false);
    let has_video_or_audio = has_real_formats || !available_heights.is_empty() || has_audio;

    let raw_json_str = json.to_string();
    let is_animated_gif = if platform == SocialMediaPlatform::Twitter {
        raw_json_str.contains("\"animated_gif\"")
            || raw_json_str.contains("animated_gif")
            || json.get("format_note").and_then(|v| v.as_str()).map(|n| n.contains("gif") || n.contains("animated_gif")).unwrap_or(false)
            || json.get("description").and_then(|v| v.as_str()).map(|d| d.to_lowercase().contains("gif")).unwrap_or(false)
            || json.get("title").and_then(|v| v.as_str()).map(|t| t.to_lowercase().contains("gif")).unwrap_or(false)
    } else {
        false
    };

    let mut formats_list = Vec::new();

    if is_animated_gif {
        formats_list.push(MediaFormatOption {
            format_id: "twitter-gif".to_string(),
            quality_label: "GIF Animado (.gif)".to_string(),
            ext: "gif".to_string(),
            resolution: Some("Animación GIF".to_string()),
            filesize_approx: estimated_size_best,
            is_audio_only: false,
            format_note: Some("Convertir stream a archivo .gif con paleta optimizada FFmpeg".to_string()),
        });
        formats_list.push(MediaFormatOption {
            format_id: "twitter-mp4".to_string(),
            quality_label: "Video en bucle MP4 (.mp4)".to_string(),
            ext: "mp4".to_string(),
            resolution: Some("Video MP4".to_string()),
            filesize_approx: estimated_size_best,
            is_audio_only: false,
            format_note: Some("Stream de video MP4 original sin reconvertir".to_string()),
        });
    } else if has_video_or_audio {
        let max_height = available_heights.first().copied().unwrap_or(720);

        // 1. Max quality original
        formats_list.push(MediaFormatOption {
            format_id: "bestvideo+bestaudio/best".to_string(),
            quality_label: format!("Máxima Calidad ({max_height}p)"),
            ext: "mp4".to_string(),
            resolution: Some(format!("{max_height}p")),
            filesize_approx: estimated_size_best,
            is_audio_only: false,
            format_note: Some("Mejor pista de video y audio combinadas sin pérdida".to_string()),
        });

        // 2. 1440p (2K QHD) if available
        if max_height >= 1440 {
            formats_list.push(MediaFormatOption {
                format_id: "bestvideo[height<=1440]+bestaudio/best[height<=1440]/best".to_string(),
                quality_label: "1440p (2K QHD)".to_string(),
                ext: "mp4".to_string(),
                resolution: Some("2560x1440".to_string()),
                filesize_approx: estimated_size_best.map(|s| (s as f64 * 0.90) as u64),
                is_audio_only: false,
                format_note: Some("Resolución 2K Quad HD con audio de alta fidelidad".to_string()),
            });
        }

        // 3. 1080p (Full HD) if available
        if max_height >= 1080 {
            formats_list.push(MediaFormatOption {
                format_id: "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best".to_string(),
                quality_label: "1080p (Full HD)".to_string(),
                ext: "mp4".to_string(),
                resolution: Some("1920x1080".to_string()),
                filesize_approx: estimated_size_best.map(|s| (s as f64 * 0.75) as u64),
                is_audio_only: false,
                format_note: Some("Resolución Full HD 1080p con audio estéreo".to_string()),
            });
        }

        // 4. 720p (HD)
        if max_height >= 720 {
            formats_list.push(MediaFormatOption {
                format_id: "bestvideo[height<=720]+bestaudio/best[height<=720]/best".to_string(),
                quality_label: "720p (HD)".to_string(),
                ext: "mp4".to_string(),
                resolution: Some("1280x720".to_string()),
                filesize_approx: estimated_size_best.map(|s| (s as f64 * 0.5) as u64),
                is_audio_only: false,
                format_note: Some("Resolución de alta definición estándar".to_string()),
            });
        }

        // 5. 480p (SD)
        if max_height >= 480 {
            formats_list.push(MediaFormatOption {
                format_id: "bestvideo[height<=480]+bestaudio/best[height<=480]/best".to_string(),
                quality_label: "480p (SD)".to_string(),
                ext: "mp4".to_string(),
                resolution: Some("854x480".to_string()),
                filesize_approx: estimated_size_best.map(|s| (s as f64 * 0.3) as u64),
                is_audio_only: false,
                format_note: Some("Calidad equilibrada y descarga rápida".to_string()),
            });
        }

        // 6. 360p (Data saver)
        if max_height >= 360 {
            formats_list.push(MediaFormatOption {
                format_id: "bestvideo[height<=360]+bestaudio/best[height<=360]/best".to_string(),
                quality_label: "360p (Bajo Consumo)".to_string(),
                ext: "mp4".to_string(),
                resolution: Some("640x360".to_string()),
                filesize_approx: estimated_size_best.map(|s| (s as f64 * 0.18) as u64),
                is_audio_only: false,
                format_note: Some("Tamaño compacto para ahorrar espacio".to_string()),
            });
        }

        // 7. Audio Only MP3
        if has_audio || true {
            formats_list.push(MediaFormatOption {
                format_id: "audio-mp3".to_string(),
                quality_label: "Solo Audio (MP3)".to_string(),
                ext: "mp3".to_string(),
                resolution: None,
                filesize_approx: duration_seconds.map(|d| d * 24_000), // ~192kbps
                is_audio_only: true,
                format_note: Some("Extrae y convierte la pista de audio a MP3".to_string()),
            });

            // 8. Audio Only M4A (Original without re-encoding)
            formats_list.push(MediaFormatOption {
                format_id: "bestaudio[ext=m4a]/bestaudio/best".to_string(),
                quality_label: "Solo Audio (M4A / AAC)".to_string(),
                ext: "m4a".to_string(),
                resolution: None,
                filesize_approx: duration_seconds.map(|d| d * 16_000), // ~128kbps
                is_audio_only: true,
                format_note: Some("Pista de audio original sin pérdida de recompresión".to_string()),
            });
        }
    }

    let mut gallery_items = Vec::new();
    if let Some(entries) = json.get("entries").and_then(|v| v.as_array()) {
        for (idx, entry) in entries.iter().enumerate() {
            let mut img_url = entry.get("url").and_then(|v| v.as_str()).map(|s| s.to_string());
            let thumb = entry.get("thumbnail").and_then(|v| v.as_str()).map(|s| s.to_string())
                .or_else(|| img_url.clone());
            let w = entry.get("width").and_then(|v| v.as_u64()).map(|v| v as u32);
            let h = entry.get("height").and_then(|v| v.as_u64()).map(|v| v as u32);

            if img_url.is_none() {
                if let Some(thumbs) = entry.get("thumbnails").and_then(|v| v.as_array()) {
                    if let Some(last_t) = thumbs.last().and_then(|t| t.get("url")).and_then(|v| v.as_str()) {
                        img_url = Some(last_t.to_string());
                    }
                }
            }

            if let Some(u) = img_url {
                gallery_items.push(MediaGalleryItem {
                    url: u,
                    thumbnail_url: thumb,
                    width: w,
                    height: h,
                    index: idx,
                });
            }
        }
    }

    MediaMetadata {
        title,
        uploader,
        thumbnail_url,
        duration_seconds,
        platform,
        platform_level: level,
        platform_display,
        formats: formats_list,
        gallery_items,
        is_animated_gif,
    }
}

/// Extracts numeric status ID from a Twitter / X post URL
pub fn extract_twitter_status_id(url: &str) -> Option<String> {
    let clean = url.split('?').next()?;
    let segments: Vec<&str> = clean.split('/').collect();
    let status_pos = segments.iter().position(|&s| s == "status")?;
    let candidate = segments.get(status_pos + 1)?;
    if candidate.chars().all(|c| c.is_ascii_digit()) && !candidate.is_empty() {
        Some(candidate.to_string())
    } else {
        None
    }
}

/// Extracts images/photos and metadata from a Twitter/X post
pub async fn extract_twitter_data(
    client: &reqwest::Client,
    target_url: &str,
) -> (Option<String>, Option<String>, Option<String>, Vec<MediaGalleryItem>, bool) {
    let mut title = None;
    let mut uploader = None;
    let mut thumbnail_url = None;
    let mut gallery_items = Vec::new();
    let mut is_animated_gif = false;

    let status_id = match extract_twitter_status_id(target_url) {
        Some(id) => id,
        None => return (title, uploader, thumbnail_url, gallery_items, false),
    };

    // 1. Try Twitter Public Syndication API
    let syndication_url = format!("https://cdn.syndication.twimg.com/tweet-result?id={status_id}&token=5");
    let resp = client
        .get(&syndication_url)
        .header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        )
        .timeout(Duration::from_secs(8))
        .send()
        .await;

    if let Ok(response) = resp {
        if response.status().is_success() {
            if let Ok(json) = response.json::<serde_json::Value>().await {
                if let Some(text) = json.get("text").and_then(|v| v.as_str()) {
                    let clean_text = text.trim();
                    if !clean_text.is_empty() {
                        title = Some(clean_text.to_string());
                    }
                }

                if let Some(user) = json.get("user") {
                    if let Some(name) = user.get("name").and_then(|v| v.as_str()) {
                        uploader = Some(name.to_string());
                    }
                }

                // Check mediaDetails
                if let Some(media_arr) = json.get("mediaDetails").and_then(|v| v.as_array()) {
                    for item in media_arr {
                        let m_type = item.get("type").and_then(|v| v.as_str()).unwrap_or("");
                        if m_type == "animated_gif" {
                            is_animated_gif = true;
                            if thumbnail_url.is_none() {
                                if let Some(url_str) = item.get("media_url_https").and_then(|v| v.as_str()) {
                                    thumbnail_url = Some(url_str.to_string());
                                }
                            }
                        } else if m_type == "photo" {
                            if let Some(url_str) = item.get("media_url_https").and_then(|v| v.as_str()) {
                                let orig_url = format!("{url_str}?name=orig");
                                let thumb = format!("{url_str}?name=small");
                                let w = item.get("original_info")
                                    .and_then(|oi| oi.get("width"))
                                    .and_then(|v| v.as_u64())
                                    .map(|v| v as u32);
                                let h = item.get("original_info")
                                    .and_then(|oi| oi.get("height"))
                                    .and_then(|v| v.as_u64())
                                    .map(|v| v as u32);

                                gallery_items.push(MediaGalleryItem {
                                    url: orig_url,
                                    thumbnail_url: Some(thumb),
                                    width: w,
                                    height: h,
                                    index: gallery_items.len(),
                                });
                            }
                        }
                    }
                }

                // Fallback to photos array
                if gallery_items.is_empty() {
                    if let Some(photos_arr) = json.get("photos").and_then(|v| v.as_array()) {
                        for item in photos_arr {
                            if let Some(url_str) = item.get("url").and_then(|v| v.as_str()) {
                                let orig_url = format!("{url_str}?name=orig");
                                let thumb = format!("{url_str}?name=small");
                                let w = item.get("width").and_then(|v| v.as_u64()).map(|v| v as u32);
                                let h = item.get("height").and_then(|v| v.as_u64()).map(|v| v as u32);

                                gallery_items.push(MediaGalleryItem {
                                    url: orig_url,
                                    thumbnail_url: Some(thumb),
                                    width: w,
                                    height: h,
                                    index: gallery_items.len(),
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    // 2. Fallback to VxTwitter API if no gallery items were found
    if gallery_items.is_empty() {
        let vxtwitter_url = format!("https://api.vxtwitter.com/Twitter/status/{status_id}");
        if let Ok(response) = client
            .get(&vxtwitter_url)
            .header("User-Agent", "Mozilla/5.0 BundleRock/0.1.0")
            .timeout(Duration::from_secs(6))
            .send()
            .await
        {
            if response.status().is_success() {
                if let Ok(json) = response.json::<serde_json::Value>().await {
                    if title.is_none() {
                        if let Some(text) = json.get("text").and_then(|v| v.as_str()) {
                            title = Some(text.trim().to_string());
                        }
                    }
                    if uploader.is_none() {
                        if let Some(name) = json.get("user_name").and_then(|v| v.as_str()) {
                            uploader = Some(name.to_string());
                        }
                    }

                    if let Some(extended) = json.get("media_extended").and_then(|v| v.as_array()) {
                        for item in extended {
                            let t = item.get("type").and_then(|v| v.as_str()).unwrap_or("");
                            if t == "gif" || t == "animated_gif" {
                                is_animated_gif = true;
                                if thumbnail_url.is_none() {
                                    if let Some(u) = item.get("url").and_then(|v| v.as_str()) {
                                        thumbnail_url = Some(u.to_string());
                                    }
                                }
                            } else if t == "image" || t == "photo" {
                                if let Some(u) = item.get("url").and_then(|v| v.as_str()) {
                                    let w = item.get("size").and_then(|s| s.get("width")).and_then(|v| v.as_u64()).map(|v| v as u32);
                                    let h = item.get("size").and_then(|s| s.get("height")).and_then(|v| v.as_u64()).map(|v| v as u32);
                                    gallery_items.push(MediaGalleryItem {
                                        url: u.to_string(),
                                        thumbnail_url: Some(u.to_string()),
                                        width: w,
                                        height: h,
                                        index: gallery_items.len(),
                                    });
                                }
                            }
                        }
                    } else if let Some(media_urls) = json.get("mediaURLs").and_then(|v| v.as_array()) {
                        for u in media_urls {
                            if let Some(url_str) = u.as_str() {
                                gallery_items.push(MediaGalleryItem {
                                    url: url_str.to_string(),
                                    thumbnail_url: Some(url_str.to_string()),
                                    width: None,
                                    height: None,
                                    index: gallery_items.len(),
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    if let Some(first_item) = gallery_items.first() {
        thumbnail_url = first_item.thumbnail_url.clone().or_else(|| Some(first_item.url.clone()));
    }

    (title, uploader, thumbnail_url, gallery_items, is_animated_gif)
}

/// Extracts images/photos, video metadata, and gallery items from a Reddit post
pub async fn extract_reddit_data(
    client: &reqwest::Client,
    target_url: &str,
) -> (
    Option<String>,
    Option<String>,
    Option<String>,
    Option<u64>,
    Option<String>,
    Vec<MediaGalleryItem>,
) {
    let mut title = None;
    let mut uploader = None;
    let mut thumbnail_url = None;
    let mut duration_seconds = None;
    let mut resolution = None;
    let mut gallery_items = Vec::new();

    let reddit_clean = target_url.split('?').next().unwrap_or(target_url);
    let json_url = format!("{}.json", reddit_clean.trim_end_matches('/'));

    if let Ok(resp) = client
        .get(&json_url)
        .header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 BundleRock/0.1.0",
        )
        .timeout(Duration::from_secs(8))
        .send()
        .await
    {
        if resp.status().is_success() {
            if let Ok(json) = resp.json::<serde_json::Value>().await {
                if let Some(first_arr) = json.as_array().and_then(|a| a.first()) {
                    if let Some(post) = first_arr
                        .get("data")
                        .and_then(|d| d.get("children"))
                        .and_then(|c| c.as_array())
                        .and_then(|a| a.first())
                        .and_then(|p| p.get("data"))
                    {
                        if let Some(t) = post.get("title").and_then(|v| v.as_str()) {
                            title = Some(t.to_string());
                        }
                        if let Some(a) = post.get("author").and_then(|v| v.as_str()) {
                            uploader = Some(format!("u/{a}"));
                        }
                        if let Some(thumb) = post.get("thumbnail").and_then(|v| v.as_str()) {
                            if thumb.starts_with("http") {
                                thumbnail_url = Some(thumb.to_string());
                            }
                        }

                        // Check video metadata
                        let reddit_video = post
                            .get("media")
                            .and_then(|m| m.get("reddit_video"))
                            .or_else(|| {
                                post.get("secure_media")
                                    .and_then(|m| m.get("reddit_video"))
                            });

                        if let Some(rv) = reddit_video {
                            duration_seconds = rv.get("duration").and_then(|v| v.as_u64());
                            if let Some(h) = rv.get("height").and_then(|v| v.as_u64()) {
                                resolution = Some(format!("{h}p"));
                            }
                        }

                        // Check gallery items
                        if let Some(items) = post.get("gallery_data").and_then(|g| g.get("items")).and_then(|i| i.as_array()) {
                            let media_meta = post.get("media_metadata");
                            for (idx, item) in items.iter().enumerate() {
                                if let Some(media_id) = item.get("media_id").and_then(|m| m.as_str()) {
                                    let mut img_url = format!("https://i.redd.it/{media_id}.jpg");
                                    let mut thumb = Some(format!("https://preview.redd.it/{media_id}.jpg?width=640&crop=smart&auto=webp&s="));
                                    let mut w = None;
                                    let mut h = None;

                                    if let Some(meta) = media_meta.and_then(|mm| mm.get(media_id)) {
                                        if let Some(s) = meta.get("s") {
                                            if let Some(u) = s.get("u").and_then(|v| v.as_str()) {
                                                let clean_u = u.replace("&amp;", "&");
                                                img_url = clean_u.clone();
                                                thumb = Some(clean_u);
                                            }
                                            w = s.get("x").and_then(|v| v.as_u64()).map(|x| x as u32);
                                            h = s.get("y").and_then(|v| v.as_u64()).map(|y| y as u32);
                                        }
                                    }

                                    gallery_items.push(MediaGalleryItem {
                                        url: img_url,
                                        thumbnail_url: thumb,
                                        width: w,
                                        height: h,
                                        index: idx,
                                    });
                                }
                            }
                        }

                        // If not a gallery, but post url is a direct image
                        if gallery_items.is_empty() {
                            if let Some(u) = post.get("url").and_then(|v| v.as_str()) {
                                let u_lower = u.to_ascii_lowercase();
                                if u_lower.ends_with(".jpg")
                                    || u_lower.ends_with(".jpeg")
                                    || u_lower.ends_with(".png")
                                    || u_lower.ends_with(".webp")
                                    || u_lower.ends_with(".gif")
                                {
                                    gallery_items.push(MediaGalleryItem {
                                        url: u.to_string(),
                                        thumbnail_url: Some(u.to_string()),
                                        width: None,
                                        height: None,
                                        index: 0,
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if thumbnail_url.is_none() {
        if let Some(first) = gallery_items.first() {
            thumbnail_url = first.thumbnail_url.clone().or_else(|| Some(first.url.clone()));
        }
    }

    (title, uploader, thumbnail_url, duration_seconds, resolution, gallery_items)
}

/// Fallback metadata extraction using oEmbed / public JSON endpoints when yt-dlp is not present
async fn probe_media_fallback(
    client: &reqwest::Client,
    target_url: &str,
    platform: SocialMediaPlatform,
    level: u8,
    platform_display: String,
) -> Result<MediaMetadata, String> {
    let mut title = "Video de Red Social".to_string();
    let mut uploader = None;
    let mut thumbnail_url = None;
    let mut duration_seconds = None;
    let mut gallery_items = Vec::new();
    let mut is_animated_gif = false;

    match platform {
        SocialMediaPlatform::YouTube => {
            let oembed_url = format!("https://www.youtube.com/oembed?url={target_url}&format=json");
            if let Ok(resp) = client
                .get(&oembed_url)
                .timeout(Duration::from_secs(6))
                .send()
                .await
            {
                if let Ok(json) = resp.json::<serde_json::Value>().await {
                    if let Some(t) = json.get("title").and_then(|v| v.as_str()) {
                        title = t.to_string();
                    }
                    if let Some(a) = json.get("author_name").and_then(|v| v.as_str()) {
                        uploader = Some(a.to_string());
                    }
                    if let Some(thumb) = json.get("thumbnail_url").and_then(|v| v.as_str()) {
                        thumbnail_url = Some(thumb.to_string());
                    }
                }
            }
        }
        SocialMediaPlatform::Twitter => {
            let (tw_title, tw_uploader, tw_thumb, tw_gallery, tw_gif) = extract_twitter_data(client, target_url).await;
            if let Some(t) = tw_title {
                title = t;
            } else {
                let oembed_url =
                    format!("https://publish.twitter.com/oembed?url={target_url}&omit_script=true");
                if let Ok(resp) = client
                    .get(&oembed_url)
                    .timeout(Duration::from_secs(6))
                    .send()
                    .await
                {
                    if let Ok(json) = resp.json::<serde_json::Value>().await {
                        if let Some(a) = json.get("author_name").and_then(|v| v.as_str()) {
                            uploader = Some(a.to_string());
                            title = format!("Publicación de {a} en X");
                        }
                    }
                }
            }
            if let Some(a) = tw_uploader {
                uploader = Some(a);
            }
            if let Some(th) = tw_thumb {
                thumbnail_url = Some(th);
            }
            gallery_items = tw_gallery;
            if tw_gif {
                is_animated_gif = true;
            }
        }
        SocialMediaPlatform::Reddit => {
            let (r_title, r_uploader, r_thumb, r_dur, _r_res, r_gallery) = extract_reddit_data(client, target_url).await;
            if let Some(t) = r_title {
                title = t;
            }
            if let Some(a) = r_uploader {
                uploader = Some(a);
            }
            if let Some(th) = r_thumb {
                thumbnail_url = Some(th);
            }
            if let Some(d) = r_dur {
                duration_seconds = Some(d);
            }
            gallery_items = r_gallery;
        }
        SocialMediaPlatform::Facebook => {
            if !is_facebook_video_url(target_url) {
                return probe_facebook_photo_or_post(client, target_url).await;
            }
            title = "Video de Facebook".to_string();
        }
        SocialMediaPlatform::Other => {
            title = "Video Multimedia".to_string();
        }
    }

    let has_video = match platform {
        SocialMediaPlatform::Twitter => gallery_items.is_empty(),
        SocialMediaPlatform::Reddit => duration_seconds.is_some() || gallery_items.is_empty(),
        SocialMediaPlatform::Facebook => is_facebook_video_url(target_url),
        _ => true,
    };

    // Standard fallback formats list
    let formats = if is_animated_gif {
        vec![
            MediaFormatOption {
                format_id: "twitter-gif".to_string(),
                quality_label: "GIF Animado (.gif)".to_string(),
                ext: "gif".to_string(),
                resolution: Some("Animación GIF".to_string()),
                filesize_approx: None,
                is_audio_only: false,
                format_note: Some("Convertir stream a archivo .gif con paleta optimizada FFmpeg".to_string()),
            },
            MediaFormatOption {
                format_id: "twitter-mp4".to_string(),
                quality_label: "Video en bucle MP4 (.mp4)".to_string(),
                ext: "mp4".to_string(),
                resolution: Some("Video MP4".to_string()),
                filesize_approx: None,
                is_audio_only: false,
                format_note: Some("Stream de video MP4 original sin reconvertir".to_string()),
            },
        ]
    } else if has_video {
        vec![
            MediaFormatOption {
                format_id: "bestvideo+bestaudio/best".to_string(),
                quality_label: "Máxima Calidad (Original)".to_string(),
                ext: "mp4".to_string(),
                resolution: Some("Original".to_string()),
                filesize_approx: None,
                is_audio_only: false,
                format_note: Some("Mejor calidad de video y audio combinada".to_string()),
            },
            MediaFormatOption {
                format_id: "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best".to_string(),
                quality_label: "1080p (Full HD)".to_string(),
                ext: "mp4".to_string(),
                resolution: Some("1920x1080".to_string()),
                filesize_approx: None,
                is_audio_only: false,
                format_note: Some("Resolución Full HD con remux de audio".to_string()),
            },
            MediaFormatOption {
                format_id: "bestvideo[height<=720]+bestaudio/best[height<=720]/best".to_string(),
                quality_label: "720p (HD)".to_string(),
                ext: "mp4".to_string(),
                resolution: Some("1280x720".to_string()),
                filesize_approx: None,
                is_audio_only: false,
                format_note: Some("Resolución HD estándar".to_string()),
            },
            MediaFormatOption {
                format_id: "bestvideo[height<=480]+bestaudio/best[height<=480]/best".to_string(),
                quality_label: "480p (SD)".to_string(),
                ext: "mp4".to_string(),
                resolution: Some("854x480".to_string()),
                filesize_approx: None,
                is_audio_only: false,
                format_note: Some("Resolución estándar equilibrada".to_string()),
            },
            MediaFormatOption {
                format_id: "audio-mp3".to_string(),
                quality_label: "Solo Audio (MP3)".to_string(),
                ext: "mp3".to_string(),
                resolution: None,
                filesize_approx: None,
                is_audio_only: true,
                format_note: Some("Extraer y convertir a pista MP3".to_string()),
            },
            MediaFormatOption {
                format_id: "bestaudio[ext=m4a]/bestaudio/best".to_string(),
                quality_label: "Solo Audio (M4A / AAC)".to_string(),
                ext: "m4a".to_string(),
                resolution: None,
                filesize_approx: None,
                is_audio_only: true,
                format_note: Some("Pista de audio original sin pérdida".to_string()),
            },
        ]
    } else {
        Vec::new()
    };

    Ok(MediaMetadata {
        title,
        uploader,
        thumbnail_url,
        duration_seconds,
        platform,
        platform_level: level,
        platform_display,
        formats,
        gallery_items,
        is_animated_gif,
    })
}

/// Spawns a supervised multimedia download task using `yt-dlp` and `ffmpeg`.
/// Captures and translates real-time progress into BundleRock `DownloadProgressPayload` events.
pub async fn download_media_stream(
    mut task: DownloadTask,
    format_id: Option<String>,
    app_handle: Option<AppHandle>,
    mut cancel_rx: watch::Receiver<bool>,
    tasks_map: Arc<RwLock<HashMap<String, DownloadTask>>>,
    tasks_file: PathBuf,
) -> Result<(), String> {
    let task_id = task.id.clone();
    let app_clone = app_handle.clone();
    let tasks_map_clone = tasks_map.clone();

    let ytdlp_path = match find_ytdlp() {
        Some(p) => p,
        None => {
            let err_msg = "Motor extractor multimedia (yt-dlp) no encontrado. Por favor instálalo desde la ventana de descarga.".to_string();
            task.status = DownloadStatus::Failed;
            task.error_message = Some(err_msg.clone());
            task.speed_bps = 0;
            if let Some(ref app) = app_clone {
                let mut payload = DownloadProgressPayload::from(&task);
                payload.error_message = Some(err_msg.clone());
                let _ = app.emit("download-progress", payload);
            }
            let mut tasks = tasks_map_clone.write().await;
            tasks.insert(task_id, task);
            return Err(err_msg);
        }
    };

    let ffmpeg_path = find_ffmpeg();
    let target_path = PathBuf::from(&task.file_path);

    let parent_dir = target_path
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| PathBuf::from("."));
    let _ = std::fs::create_dir_all(&parent_dir);

    let stem = target_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("video");

    let chosen_format = match format_id.as_deref() {
        Some("twitter-gif") | Some("twitter-mp4") => "bestvideo/best".to_string(),
        Some(f) if !f.trim().is_empty() => f.to_string(),
        _ => "bestvideo+bestaudio/best".to_string(),
    };

    let is_gif_output = format_id.as_deref() == Some("twitter-gif")
        || task.media_format.as_deref() == Some("twitter-gif")
        || task.file_name.to_lowercase().ends_with(".gif");

    let is_mp3 = chosen_format == "audio-mp3" || task.file_name.to_lowercase().ends_with(".mp3");
    let is_m4a = chosen_format.starts_with("bestaudio") || task.file_name.to_lowercase().ends_with(".m4a");

    let mut cmd = tokio::process::Command::new(&ytdlp_path);
    cmd.env("PYTHONUNBUFFERED", "1");
    cmd.arg(&task.url);

    // Multi-threaded fragment downloading for DASH and HLS streams
    let concurrent_frags = task.num_connections.max(1);
    cmd.arg("--concurrent-fragments").arg(concurrent_frags.to_string());

    // Standard output template with %(ext)s prevents duplicated extensions (.mp4.mp4 / .mp3.mp3)
    let output_template = parent_dir.join(format!("{stem}.%(ext)s"));
    cmd.arg("-o").arg(output_template.to_string_lossy().as_ref());

    // Format and remuxing configuration
    if is_mp3 {
        cmd.arg("-x")
            .arg("--audio-format")
            .arg("mp3")
            .arg("--audio-quality")
            .arg("0");
    } else if is_m4a {
        cmd.arg("-f").arg(&chosen_format);
    } else {
        cmd.arg("-f").arg(&chosen_format);
        if ffmpeg_path.is_some() {
            cmd.arg("--merge-output-format").arg("mp4");
            cmd.arg("--postprocessor-args").arg("Merger:-c copy");
        }
    }

    // Configure ffmpeg directory if available
    if let Some(ref ffp) = ffmpeg_path {
        if let Some(ffmpeg_dir) = ffp.parent() {
            cmd.arg("--ffmpeg-location").arg(ffmpeg_dir);
        }
    }

    // Allow resuming partial downloads
    cmd.arg("-c");
    cmd.arg("--newline");
    cmd.arg("--progress-delta").arg("0.5");
    cmd.arg("--no-colors");
    cmd.arg("--no-playlist");

    // Correct yt-dlp progress template prefix syntax: download:download-json:...
    cmd.arg("--progress-template");
    cmd.arg("download:download-json:{\"downloaded\":%(progress.downloaded_bytes)j,\"total\":%(progress.total_bytes)j,\"total_est\":%(progress.total_bytes_estimate)j,\"speed\":%(progress.speed)j,\"eta\":%(progress.eta)j,\"status\":%(progress.status)j}");

    #[cfg(windows)]
    {
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Error iniciando yt-dlp: {e}"))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "No se pudo conectar a stdout de yt-dlp".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "No se pudo conectar a stderr de yt-dlp".to_string())?;

    let mut stdout_reader = BufReader::new(stdout).lines();
    let mut stderr_reader = BufReader::new(stderr).lines();

    // Background reader for stderr (tracks merger / ffmpeg stages & errors)
    let stage_tracker = Arc::new(RwLock::new(None::<String>));
    let stage_tracker_clone = stage_tracker.clone();
    let last_error = Arc::new(RwLock::new(None::<String>));
    let last_error_clone = last_error.clone();

    tokio::spawn(async move {
        while let Ok(Some(line)) = stderr_reader.next_line().await {
            let trimmed = line.trim();
            if trimmed.contains("[Merger]") || trimmed.contains("Merging formats") {
                *stage_tracker_clone.write().await =
                    Some("Ensamblando audio y video con FFmpeg...".to_string());
            } else if trimmed.contains("[ExtractAudio]") {
                *stage_tracker_clone.write().await =
                    Some("Extrayendo pista de audio...".to_string());
            } else if trimmed.contains("[VideoRemuxer]") {
                *stage_tracker_clone.write().await =
                    Some("Remuxing contenedor multimedia...".to_string());
            } else if trimmed.starts_with("ERROR:") || trimmed.to_lowercase().contains("error:") {
                *last_error_clone.write().await = Some(trimmed.to_string());
            }
        }
    });

    let mut last_emit = std::time::Instant::now();
    let mut ticker = tokio::time::interval(Duration::from_millis(250));
    ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

    loop {
        tokio::select! {
            line_result = stdout_reader.next_line() => {
                match line_result {
                    Ok(Some(line)) => {
                        let trimmed = line.trim();

                        if trimmed.starts_with("download-json:") {
                            let json_payload = &trimmed["download-json:".len()..];
                            if let Ok(val) = serde_json::from_str::<serde_json::Value>(json_payload) {
                                if let Some(downloaded) = val.get("downloaded").and_then(|v| v.as_u64()) {
                                    task.downloaded_bytes = downloaded;
                                }
                                let total = val.get("total").and_then(|v| v.as_u64())
                                    .or_else(|| val.get("total_est").and_then(|v| v.as_u64()));
                                if let Some(t) = total {
                                    task.total_bytes = Some(t);
                                }
                                if let Some(speed) = val.get("speed").and_then(|v| v.as_f64()) {
                                    task.speed_bps = speed as u64;
                                }

                                if let Some(tot) = task.total_bytes {
                                    if tot > 0 {
                                        let pct = ((task.downloaded_bytes as f64 / tot as f64) * 100.0).clamp(0.0, 99.9);
                                        // Monotonic progress to prevent jumping back when downloading detached audio
                                        task.progress_percentage = task.progress_percentage.max(pct);
                                    }
                                }

                                // Update virtual segment for UI visualization
                                let total_b = task.total_bytes.unwrap_or(task.downloaded_bytes);
                                let mut seg = DownloadSegment::new(0, 0, if total_b > 0 { total_b - 1 } else { 0 });
                                seg.downloaded_bytes = task.downloaded_bytes;
                                seg.current_byte = task.downloaded_bytes;
                                seg.status = SegmentStatus::Downloading;
                                task.segments = vec![seg];

                                if let Some(stage) = stage_tracker.read().await.clone() {
                                    task.stage_message = Some(stage);
                                }

                                if last_emit.elapsed() >= Duration::from_millis(250) {
                                    last_emit = std::time::Instant::now();
                                    task.updated_at = crate::models::now_millis();

                                    if let Some(ref app) = app_clone {
                                        let mut payload = DownloadProgressPayload::from(&task);
                                        payload.stage_message = task.stage_message.clone();
                                        let _ = app.emit("download-progress", payload);
                                    }

                                    let mut tasks = tasks_map_clone.write().await;
                                    if let Some(t) = tasks.get_mut(&task_id) {
                                        if t.status == DownloadStatus::Downloading {
                                            *t = task.clone();
                                        }
                                    }
                                }
                            }
                        } else if trimmed.starts_with("[download]") {
                            // Fallback parser for standard yt-dlp percentage lines
                            if let Some(pct) = parse_ytdlp_percent_line(trimmed) {
                                task.progress_percentage = task.progress_percentage.max(pct).clamp(0.0, 99.9);
                                if last_emit.elapsed() >= Duration::from_millis(250) {
                                    last_emit = std::time::Instant::now();
                                    task.updated_at = crate::models::now_millis();

                                    let mut tasks = tasks_map_clone.write().await;
                                    if let Some(t) = tasks.get_mut(&task_id) {
                                        if t.status == DownloadStatus::Downloading {
                                            *t = task.clone();
                                        }
                                        if let Some(ref app) = app_clone {
                                            let mut payload = DownloadProgressPayload::from(&task);
                                            payload.stage_message = task.stage_message.clone();
                                            let _ = app.emit("download-progress", payload);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    Ok(None) => break, // stdout closed, process terminating
                    Err(_) => break,
                }
            }
            _ = ticker.tick() => {
                // Heartbeat to keep frontend updated on stage changes (e.g. during ffmpeg merging when stdout is silent)
                let current_stage = stage_tracker.read().await.clone();
                if current_stage != task.stage_message {
                    task.stage_message = current_stage;
                    task.updated_at = crate::models::now_millis();

                    let mut tasks = tasks_map_clone.write().await;
                    if let Some(t) = tasks.get_mut(&task_id) {
                        t.stage_message = task.stage_message.clone();
                        if let Some(ref app) = app_clone {
                            let mut payload = DownloadProgressPayload::from(&task);
                            payload.stage_message = task.stage_message.clone();
                            let _ = app.emit("download-progress", payload);
                        }
                    }
                }
            }
            _ = cancel_rx.changed() => {
                if *cancel_rx.borrow() {
                    let _ = child.start_kill();
                    let current_status = {
                        let tasks = tasks_map_clone.read().await;
                        tasks.get(&task_id).map(|t| t.status)
                    };
                    if current_status.is_none() {
                        // Task was removed from memory via remove_task or clear_all_tasks!
                        return Ok(());
                    }
                    let final_status = match current_status {
                        Some(DownloadStatus::Paused) => DownloadStatus::Paused,
                        _ => DownloadStatus::Cancelled,
                    };

                    task.status = final_status;
                    task.speed_bps = 0;
                    let mut tasks = tasks_map_clone.write().await;
                    if let Some(t) = tasks.get_mut(&task_id) {
                        t.status = final_status;
                        t.speed_bps = 0;
                        if let Some(ref app) = app_clone {
                            let mut payload = DownloadProgressPayload::from(&task);
                            payload.status = final_status;
                            let _ = app.emit("download-progress", payload);
                        }
                    }
                    return Ok(());
                }
            }
        }
    }

    let status = child.wait().await.map_err(|e| e.to_string())?;

    // Guard: If task was removed from memory while downloading, do not resurrect or emit events!
    let is_still_in_map = {
        let tasks = tasks_map_clone.read().await;
        tasks.contains_key(&task_id)
    };
    if !is_still_in_map {
        return Ok(());
    }

    if status.success() {
        // Resolve final output file location
        let resolved_file = if parent_dir.join(format!("{stem}.mp3")).exists() {
            parent_dir.join(format!("{stem}.mp3"))
        } else if parent_dir.join(format!("{stem}.m4a")).exists() {
            parent_dir.join(format!("{stem}.m4a"))
        } else if parent_dir.join(format!("{stem}.mp4")).exists() {
            parent_dir.join(format!("{stem}.mp4"))
        } else if target_path.exists() {
            target_path.clone()
        } else {
            let mut candidate = target_path.clone();
            if let Ok(entries) = std::fs::read_dir(&parent_dir) {
                for entry in entries.flatten() {
                    let p = entry.path();
                    if p.is_file() {
                        if let Some(file_stem_str) = p.file_stem().and_then(|s| s.to_str()) {
                            if file_stem_str == stem {
                                candidate = p;
                                break;
                            }
                        }
                    }
                }
            }
            candidate
        };

        // If GIF output requested, convert the downloaded video stream to high-quality GIF using FFmpeg
        let mut final_resolved_file = resolved_file;
        if is_gif_output {
            let gif_target = parent_dir.join(format!("{stem}.gif"));
            if let Some(ref ffp) = ffmpeg_path {
                task.stage_message = Some("Convirtiendo stream a GIF animado con FFmpeg...".to_string());
                if let Some(ref app) = app_clone {
                    let mut payload = DownloadProgressPayload::from(&task);
                    payload.stage_message = task.stage_message.clone();
                    let _ = app.emit("download-progress", payload);
                }

                let mut fcmd = tokio::process::Command::new(ffp);
                fcmd.arg("-y")
                    .arg("-i").arg(&final_resolved_file)
                    .arg("-vf").arg("fps=15,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse")
                    .arg(&gif_target);

                #[cfg(windows)]
                {
                    fcmd.creation_flags(0x08000000);
                }

                if let Ok(f_status) = fcmd.status().await {
                    if f_status.success() && gif_target.exists() {
                        if final_resolved_file != gif_target && final_resolved_file.exists() {
                            let _ = std::fs::remove_file(&final_resolved_file);
                        }
                        final_resolved_file = gif_target;
                    }
                }
            } else {
                task.error_message = Some("FFmpeg no encontrado. Se conservó el video en bucle original MP4.".to_string());
            }
        }

        let file_size = std::fs::metadata(&final_resolved_file)
            .map(|m| m.len())
            .unwrap_or(task.downloaded_bytes);

        task.file_path = final_resolved_file.to_string_lossy().to_string();
        task.file_name = final_resolved_file
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(&task.file_name)
            .to_string();

        task.downloaded_bytes = file_size;
        task.total_bytes = Some(file_size);
        task.progress_percentage = 100.0;
        task.speed_bps = 0;
        task.status = DownloadStatus::Completed;
        task.stage_message = Some("Descarga y procesamiento completado con éxito".to_string());
        task.updated_at = crate::models::now_millis();

        let mut seg = DownloadSegment::new(0, 0, if file_size > 0 { file_size - 1 } else { 0 });
        seg.downloaded_bytes = file_size;
        seg.current_byte = file_size;
        seg.status = SegmentStatus::Completed;
        task.segments = vec![seg];

        // Guard before updating and emitting final event
        let mut tasks = tasks_map_clone.write().await;
        if tasks.contains_key(&task_id) {
            tasks.insert(task_id.clone(), task.clone());
            crate::manager::DownloadManager::save_tasks_map(&*tasks, &tasks_file);
            if let Some(ref app) = app_clone {
                let mut payload = DownloadProgressPayload::from(&task);
                payload.stage_message = task.stage_message.clone();
                let _ = app.emit("download-progress", payload);
                let _ = app.emit("download-finished", task.clone());
            }
        }

        Ok(())
    } else {
        let err_detail = last_error
            .read()
            .await
            .clone()
            .unwrap_or_else(|| format!("yt-dlp finalizó con código de error {status}"));

        task.status = DownloadStatus::Failed;
        task.error_message = Some(err_detail.clone());
        let mut tasks = tasks_map_clone.write().await;
        if tasks.contains_key(&task_id) {
            tasks.insert(task_id, task.clone());
            crate::manager::DownloadManager::save_tasks_map(&*tasks, &tasks_file);
            if let Some(ref app) = app_clone {
                let mut payload = DownloadProgressPayload::from(&task);
                payload.error_message = Some(err_detail.clone());
                let _ = app.emit("download-progress", payload);
            }
        }

        Err(err_detail)
    }
}

/// Helper to parse standard yt-dlp percentage outputs like `[download]  45.2% of ~ 50.20MiB at  4.20MiB/s`
pub fn parse_ytdlp_percent_line(line: &str) -> Option<f64> {
    if !line.contains("[download]") {
        return None;
    }
    let after_prefix = line.split("[download]").nth(1)?.trim();
    let pct_str = after_prefix.split('%').next()?.trim();
    pct_str.parse::<f64>().ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_social_media_platforms_all_levels() {
        // Level 1: YouTube
        assert_eq!(
            detect_platform("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
            Some((SocialMediaPlatform::YouTube, 1, "YouTube".to_string()))
        );
        assert_eq!(
            detect_platform("https://youtu.be/dQw4w9WgXcQ"),
            Some((SocialMediaPlatform::YouTube, 1, "YouTube".to_string()))
        );
        assert_eq!(
            detect_platform("https://m.youtube.com/watch?v=dQw4w9WgXcQ"),
            Some((SocialMediaPlatform::YouTube, 1, "YouTube".to_string()))
        );
        assert_eq!(
            detect_platform("https://www.youtube.com/shorts/abcdef12345"),
            Some((SocialMediaPlatform::YouTube, 1, "YouTube".to_string()))
        );
        assert_eq!(
            detect_platform("youtube.com/watch?v=dQw4w9WgXcQ"),
            Some((SocialMediaPlatform::YouTube, 1, "YouTube".to_string()))
        );

        // Level 1: Twitter / X
        assert_eq!(
            detect_platform("https://twitter.com/nasa/status/1234567890"),
            Some((SocialMediaPlatform::Twitter, 1, "X (Twitter)".to_string()))
        );
        assert_eq!(
            detect_platform("https://x.com/rustlang/status/987654321"),
            Some((SocialMediaPlatform::Twitter, 1, "X (Twitter)".to_string()))
        );
        assert_eq!(
            detect_platform("https://mobile.x.com/rustlang/status/987654321"),
            Some((SocialMediaPlatform::Twitter, 1, "X (Twitter)".to_string()))
        );

        // Level 2: Facebook
        assert_eq!(
            detect_platform("https://www.facebook.com/watch/?v=123456789"),
            Some((SocialMediaPlatform::Facebook, 2, "Facebook".to_string()))
        );
        assert_eq!(
            detect_platform("https://fb.watch/abcd1234/"),
            Some((SocialMediaPlatform::Facebook, 2, "Facebook".to_string()))
        );
        assert_eq!(
            detect_platform("https://www.facebook.com/reel/123456789"),
            Some((SocialMediaPlatform::Facebook, 2, "Facebook".to_string()))
        );

        // Level 3: Reddit
        assert_eq!(
            detect_platform("https://www.reddit.com/r/rust/comments/123456/sample_post/"),
            Some((SocialMediaPlatform::Reddit, 3, "Reddit".to_string()))
        );
        assert_eq!(
            detect_platform("https://v.redd.it/abcdef12345"),
            Some((SocialMediaPlatform::Reddit, 3, "Reddit".to_string()))
        );
        assert_eq!(
            detect_platform("https://redd.it/abcdef12345"),
            Some((SocialMediaPlatform::Reddit, 3, "Reddit".to_string()))
        );

        // Non-social standard URL
        assert_eq!(
            detect_platform("https://releases.ubuntu.com/22.04/ubuntu.iso"),
            None
        );
    }

    #[test]
    fn test_parse_ytdlp_percent() {
        assert_eq!(
            parse_ytdlp_percent_line("[download]  45.2% of ~ 50.20MiB at  4.20MiB/s ETA 00:06"),
            Some(45.2)
        );
        assert_eq!(
            parse_ytdlp_percent_line("[download] 100.0% of 10.00MiB in 00:02"),
            Some(100.0)
        );
        assert_eq!(
            parse_ytdlp_percent_line("[download]   0.5% of ~ 100.00MiB"),
            Some(0.5)
        );
        assert_eq!(parse_ytdlp_percent_line("Invalid line"), None);
    }

    #[test]
    fn test_extractor_status_structure() {
        let status = get_extractor_status();
        // Just verify struct fields are queryable without panics
        let _ = status.ytdlp_installed;
        let _ = status.ffmpeg_installed;
    }

    #[test]
    fn test_build_media_metadata_from_ytdlp_json() {
        let raw_json = serde_json::json!({
            "title": "Awesome Rust Tutorial",
            "uploader": "Ferris",
            "thumbnail": "https://example.com/thumb.jpg",
            "duration": 600,
            "formats": [
                {
                    "format_id": "137",
                    "height": 1080,
                    "ext": "mp4",
                    "vcodec": "avc1.640028",
                    "acodec": "none",
                    "filesize": 40_000_000
                },
                {
                    "format_id": "136",
                    "height": 720,
                    "ext": "mp4",
                    "vcodec": "avc1.4d401f",
                    "acodec": "none",
                    "filesize": 20_000_000
                },
                {
                    "format_id": "140",
                    "ext": "m4a",
                    "vcodec": "none",
                    "acodec": "mp4a.40.2",
                    "filesize": 5_000_000
                }
            ]
        });

        let metadata = build_media_metadata_from_ytdlp_json(
            raw_json,
            SocialMediaPlatform::YouTube,
            1,
            "YouTube".to_string(),
        );

        assert_eq!(metadata.title, "Awesome Rust Tutorial");
        assert_eq!(metadata.uploader, Some("Ferris".to_string()));
        assert_eq!(metadata.duration_seconds, Some(600));
        assert_eq!(metadata.platform_level, 1);

        let format_labels: Vec<_> = metadata
            .formats
            .iter()
            .map(|f| f.quality_label.as_str())
            .collect();
        assert!(format_labels.iter().any(|l| l.contains("1080p")));
        assert!(format_labels.iter().any(|l| l.contains("720p")));
        assert!(format_labels.iter().any(|l| l.contains("Audio")));
    }

    #[test]
    fn test_extract_twitter_status_id() {
        assert_eq!(
            extract_twitter_status_id("https://twitter.com/nasa/status/1234567890"),
            Some("1234567890".to_string())
        );
        assert_eq!(
            extract_twitter_status_id("https://x.com/rustlang/status/987654321?s=20"),
            Some("987654321".to_string())
        );
        assert_eq!(
            extract_twitter_status_id("https://youtube.com/watch?v=12345"),
            None
        );
    }

    #[test]
    fn test_direct_images_bypass_social_media() {
        assert_eq!(detect_platform("https://i.redd.it/my_photo.jpg"), None);
        assert_eq!(detect_platform("https://pbs.twimg.com/media/photo.png"), None);
        assert_eq!(detect_platform("https://preview.redd.it/image.webp"), None);
        assert_eq!(detect_platform("https://example.com/picture.jpeg"), None);
    }

    #[test]
    fn test_gallery_items_extraction_from_ytdlp_json() {
        let raw_json = serde_json::json!({
            "title": "Post with 2 images",
            "uploader": "Artist",
            "entries": [
                {
                    "url": "https://pbs.twimg.com/media/img1.jpg",
                    "thumbnail": "https://pbs.twimg.com/media/img1_thumb.jpg",
                    "width": 1920,
                    "height": 1080
                },
                {
                    "url": "https://pbs.twimg.com/media/img2.jpg",
                    "thumbnail": "https://pbs.twimg.com/media/img2_thumb.jpg",
                    "width": 1280,
                    "height": 720
                }
            ],
            "formats": []
        });

        let metadata = build_media_metadata_from_ytdlp_json(
            raw_json,
            SocialMediaPlatform::Twitter,
            1,
            "X (Twitter)".to_string(),
        );

        assert_eq!(metadata.gallery_items.len(), 2);
        assert_eq!(metadata.gallery_items[0].url, "https://pbs.twimg.com/media/img1.jpg");
        assert_eq!(metadata.gallery_items[0].width, Some(1920));
        assert_eq!(metadata.gallery_items[1].index, 1);
        assert_eq!(metadata.formats.len(), 0);
    }

    #[test]
    fn test_is_facebook_video_url() {
        assert!(is_facebook_video_url("https://www.facebook.com/watch/?v=123456789"));
        assert!(is_facebook_video_url("https://fb.watch/abcd1234/"));
        assert!(is_facebook_video_url("https://www.facebook.com/reel/123456789"));
        assert!(is_facebook_video_url("https://facebook.com/user/videos/123456/"));
        assert!(is_facebook_video_url("https://facebook.com/share/r/abcde/"));

        // Non-video Facebook posts
        assert!(!is_facebook_video_url("https://www.facebook.com/photo/?fbid=123456&set=a.123"));
        assert!(!is_facebook_video_url("https://www.facebook.com/photo.php?fbid=123456"));
        assert!(!is_facebook_video_url("https://www.facebook.com/permalink.php?story_fbid=123"));
        assert!(!is_facebook_video_url("https://www.facebook.com/username/posts/123456"));
        assert!(!is_facebook_video_url("https://www.facebook.com/username/photos/123456"));
        assert!(!is_facebook_video_url("https://www.facebook.com/media/set/?set=a.123456"));
    }

    #[test]
    fn test_extract_meta_tag_and_clean_entities() {
        let sample_html = r#"
            <html>
                <head>
                    <meta property="og:title" content="Sample &amp; Beautiful Photo" />
                    <meta
                        property="og:image"
                        content="https://scontent.xx.fbcdn.net/v/t39.30808-6/photo.jpg?stp=dst-jpg&amp;oh=123" />
                    <meta name="description" content="A description with &quot;quotes&quot;" />
                </head>
            </html>
        "#;

        assert_eq!(
            extract_meta_tag(sample_html, "og:title"),
            Some("Sample & Beautiful Photo".to_string())
        );
        assert_eq!(
            extract_meta_tag(sample_html, "og:image"),
            Some("https://scontent.xx.fbcdn.net/v/t39.30808-6/photo.jpg?stp=dst-jpg&oh=123".to_string())
        );
        assert_eq!(
            extract_meta_tag(sample_html, "description"),
            Some("A description with \"quotes\"".to_string())
        );
        assert_eq!(extract_meta_tag(sample_html, "nonexistent"), None);
    }

    #[test]
    fn test_extract_link_tag() {
        let sample_html = r#"
            <html>
                <head>
                    <link rel="image_src" href="https://example.com/facebook_photo.jpg" />
                    <link rel="canonical" href="https://example.com/post/123" />
                </head>
            </html>
        "#;

        assert_eq!(
            extract_link_tag(sample_html, "image_src"),
            Some("https://example.com/facebook_photo.jpg".to_string())
        );
        assert_eq!(
            extract_link_tag(sample_html, "canonical"),
            Some("https://example.com/post/123".to_string())
        );
        assert_eq!(extract_link_tag(sample_html, "nonexistent"), None);
    }

    #[test]
    fn test_twitter_animated_gif_metadata() {
        let raw_json = serde_json::json!({
            "title": "Funny Reaction GIF",
            "uploader": "TwitterUser",
            "format_note": "animated_gif",
            "formats": [
                {
                    "format_id": "0",
                    "ext": "mp4",
                    "vcodec": "h264",
                    "acodec": "none",
                    "filesize": 1_200_000
                }
            ]
        });

        let metadata = build_media_metadata_from_ytdlp_json(
            raw_json,
            SocialMediaPlatform::Twitter,
            1,
            "X (Twitter)".to_string(),
        );

        assert!(metadata.is_animated_gif);
        assert_eq!(metadata.formats.len(), 2);
        assert_eq!(metadata.formats[0].format_id, "twitter-gif");
        assert_eq!(metadata.formats[0].ext, "gif");
        assert_eq!(metadata.formats[1].format_id, "twitter-mp4");
        assert_eq!(metadata.formats[1].ext, "mp4");
    }
}
