use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::time::Duration;

#[cfg(target_os = "windows")]
extern "system" {
    fn CreateMutexW(
        lpMutexAttributes: *mut std::ffi::c_void,
        bInitialOwner: i32,
        lpName: *const u16,
    ) -> *mut std::ffi::c_void;
    fn GetLastError() -> u32;
    fn CloseHandle(hObject: *mut std::ffi::c_void) -> i32;
}

#[cfg(target_os = "windows")]
static mut APP_MUTEX_HANDLE: *mut std::ffi::c_void = std::ptr::null_mut();

/// Helper to percent-decode URL components without truncating on '&' delimiters
pub fn percent_decode(input: &str) -> String {
    let mut bytes = Vec::new();
    let mut iter = input.as_bytes().iter().copied();
    while let Some(b) = iter.next() {
        if b == b'%' {
            let h1 = iter.next();
            let h2 = iter.next();
            if let (Some(c1), Some(c2)) = (h1, h2) {
                let hex_str = [c1, c2];
                if let Ok(s) = std::str::from_utf8(&hex_str) {
                    if let Ok(val) = u8::from_str_radix(s, 16) {
                        bytes.push(val);
                        continue;
                    }
                }
                bytes.push(b'%');
                bytes.push(c1);
                bytes.push(c2);
            } else {
                bytes.push(b'%');
                if let Some(c1) = h1 {
                    bytes.push(c1);
                }
            }
        } else if b == b'+' {
            bytes.push(b' ');
        } else {
            bytes.push(b);
        }
    }
    String::from_utf8_lossy(&bytes).to_string()
}

/// Extracts the target download URL from a protocol argument string.
/// Supports formats:
/// - `bundlerock://download?url=<ENCODED_OR_RAW_URL>`
/// - `bundlerock://download/?url=<ENCODED_OR_RAW_URL>`
/// - `bundlerock://?url=<ENCODED_OR_RAW_URL>`
/// - `bundlerock://download/<URL>`
/// - `bundlerock://<URL>`
/// - `bundlerock:<URL>`
/// Also cleans surrounding quotes added by Windows shell command execution.
pub fn extract_url_from_protocol_arg(arg: &str) -> Option<String> {
    let clean = arg.trim_matches('"').trim();
    let lower = clean.to_lowercase();
    if !lower.starts_with("bundlerock://") && !lower.starts_with("bundlerock:") {
        return None;
    }

    let payload = if lower.starts_with("bundlerock://") {
        &clean["bundlerock://".len()..]
    } else {
        &clean["bundlerock:".len()..]
    };

    let trimmed = payload.trim_start_matches('/');

    // 1. Check if query parameter `url=` exists
    // (e.g. download?url=..., download/?url=..., ?url=..., /?url=...)
    if let Some(q_pos) = trimmed.find('?') {
        let query = &trimmed[q_pos + 1..];
        if let Some(idx) = query.find("url=") {
            let raw_val = &query[idx + 4..];
            let decoded = percent_decode(raw_val);
            let candidate = if decoded.starts_with("http://") || decoded.starts_with("https://") {
                decoded
            } else if raw_val.starts_with("http://") || raw_val.starts_with("https://") {
                raw_val.to_string()
            } else {
                decoded
            };
            if !candidate.trim().is_empty() {
                return Some(candidate.trim().to_string());
            }
        }
    }

    // 2. Strip optional "download/" prefix
    let lower_trimmed = trimmed.to_lowercase();
    let without_prefix = if lower_trimmed.starts_with("download/") {
        &trimmed["download/".len()..]
    } else if lower_trimmed.starts_with("download") {
        &trimmed["download".len()..]
    } else {
        trimmed
    };

    let candidate = without_prefix.trim_start_matches('/');

    // 3. Direct http/https link
    if candidate.starts_with("http://") || candidate.starts_with("https://") {
        return Some(candidate.to_string());
    }

    // 4. Try percent-decoding if it was an encoded url without ?url= parameter
    let decoded = percent_decode(candidate);
    if decoded.starts_with("http://") || decoded.starts_with("https://") {
        return Some(decoded);
    }

    if !decoded.trim().is_empty() {
        return Some(decoded);
    }

    None
}

/// Registers the `bundlerock://` protocol in Windows Registry under
/// `HKEY_CURRENT_USER\Software\Classes\bundlerock`.
///
/// Registry structure:
/// - HKCU\Software\Classes\bundlerock
///     (Default) = "URL:BundleRock Protocol"
///     "URL Protocol" = ""
/// - HKCU\Software\Classes\bundlerock\shell\open\command
///     (Default) = "\"<path_to_bundlerock.exe>\" \"%1\""
///
/// Running under HKCU does NOT require Administrator privileges or UAC elevation.
#[cfg(target_os = "windows")]
pub fn register_windows_protocol() {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let Ok(exe_path) = std::env::current_exe() else {
        return;
    };
    let exe_str = exe_path.to_string_lossy().to_string();
    let command_val = format!("\"{}\" \"%1\"", exe_str);

    // Check if registry already has this executable configured
    let query_output = std::process::Command::new("reg")
        .args(&["query", r"HKCU\Software\Classes\bundlerock\shell\open\command", "/ve"])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    let needs_registration = match query_output {
        Ok(out) if out.status.success() => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            !stdout.contains(&exe_str)
        }
        _ => true,
    };

    if needs_registration {
        println!("[protocol] Registering bundlerock:// protocol in HKCU registry...");
        let _ = std::process::Command::new("reg")
            .args(&["add", r"HKCU\Software\Classes\bundlerock", "/ve", "/d", "URL:BundleRock Protocol", "/f"])
            .creation_flags(CREATE_NO_WINDOW)
            .output();

        let _ = std::process::Command::new("reg")
            .args(&["add", r"HKCU\Software\Classes\bundlerock", "/v", "URL Protocol", "/d", "", "/f"])
            .creation_flags(CREATE_NO_WINDOW)
            .output();

        let _ = std::process::Command::new("reg")
            .args(&["add", r"HKCU\Software\Classes\bundlerock\shell\open\command", "/ve", "/d", &command_val, "/f"])
            .creation_flags(CREATE_NO_WINDOW)
            .output();
    }
}

#[cfg(not(target_os = "windows"))]
pub fn register_windows_protocol() {
    // No-op on non-Windows platforms
}

/// Checks if an existing instance of BundleRock is already running or starting.
/// Uses a Windows Named Mutex to prevent race conditions during cold boot.
/// If an instance is active or booting, it forwards the download request or focus command
/// to 127.0.0.1:18200 (retrying while the primary instance completes initialization) and returns `true`.
/// If no instance is active, claims primary ownership and returns `false`.
pub fn handle_second_instance(args: &[String]) -> bool {
    let mut target_url = None;
    for arg in args.iter().skip(1) {
        if let Some(url) = extract_url_from_protocol_arg(arg) {
            target_url = Some(url);
            break;
        }
    }

    #[cfg(target_os = "windows")]
    {
        use std::ffi::OsStr;
        use std::os::windows::ffi::OsStrExt;

        let wide_name: Vec<u16> = OsStr::new("Local\\BundleRock_SingleInstance_Mutex\0")
            .encode_wide()
            .collect();

        unsafe {
            let handle = CreateMutexW(std::ptr::null_mut(), 0, wide_name.as_ptr());
            let last_err = GetLastError();

            // 183 = ERROR_ALREADY_EXISTS
            if !handle.is_null() && last_err == 183 {
                let _ = CloseHandle(handle);

                let addr: SocketAddr = "127.0.0.1:18200".parse().unwrap();
                // Primary instance is running or booting; retry connection for up to 3 seconds
                for _ in 0..30 {
                    if let Ok(mut stream) = TcpStream::connect_timeout(&addr, Duration::from_millis(150)) {
                        let _ = stream.set_read_timeout(Some(Duration::from_millis(2000)));
                        let _ = stream.set_write_timeout(Some(Duration::from_millis(2000)));

                        if let Some(ref url) = target_url {
                            let payload = serde_json::json!({
                                "url": url,
                                "page_url": null
                            })
                            .to_string();

                            let req = format!(
                                "POST /api/download HTTP/1.1\r\nHost: 127.0.0.1:18200\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                                payload.len(),
                                payload
                            );
                            let _ = stream.write_all(req.as_bytes());
                            let mut resp = Vec::new();
                            let _ = stream.read_to_end(&mut resp);
                        } else {
                            let req = "POST /api/focus HTTP/1.1\r\nHost: 127.0.0.1:18200\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
                            let _ = stream.write_all(req.as_bytes());
                            let mut resp = Vec::new();
                            let _ = stream.read_to_end(&mut resp);
                        }

                        return true;
                    }
                    std::thread::sleep(Duration::from_millis(100));
                }

                // If primary instance did not respond after 3 seconds, allow this process to take over
                return false;
            } else if !handle.is_null() {
                APP_MUTEX_HANDLE = handle;
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let addr: SocketAddr = "127.0.0.1:18200".parse().unwrap();
        if let Ok(mut stream) = TcpStream::connect_timeout(&addr, Duration::from_millis(200)) {
            let _ = stream.set_read_timeout(Some(Duration::from_millis(1500)));
            let _ = stream.set_write_timeout(Some(Duration::from_millis(1500)));

            if let Some(ref url) = target_url {
                let payload = serde_json::json!({
                    "url": url,
                    "page_url": null
                })
                .to_string();

                let req = format!(
                    "POST /api/download HTTP/1.1\r\nHost: 127.0.0.1:18200\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    payload.len(),
                    payload
                );
                let _ = stream.write_all(req.as_bytes());
                let mut resp = Vec::new();
                let _ = stream.read_to_end(&mut resp);
            } else {
                let req = "POST /api/focus HTTP/1.1\r\nHost: 127.0.0.1:18200\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
                let _ = stream.write_all(req.as_bytes());
                let mut resp = Vec::new();
                let _ = stream.read_to_end(&mut resp);
            }

            return true;
        }
    }

    false
}

/// Inspects process startup arguments for a `bundlerock://` protocol URL.
pub fn get_startup_protocol_url() -> Option<String> {
    for arg in std::env::args().skip(1) {
        if let Some(url) = extract_url_from_protocol_arg(&arg) {
            return Some(url);
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_url_with_query_param() {
        let arg = "bundlerock://download?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ";
        assert_eq!(
            extract_url_from_protocol_arg(arg),
            Some("https://www.youtube.com/watch?v=dQw4w9WgXcQ".to_string())
        );
    }

    #[test]
    fn test_extract_url_with_query_param_slash() {
        let arg = "bundlerock://download/?url=https%3A%2F%2Fwww.reddit.com%2Fr%2Fmemes%2Fcomments%2F123";
        assert_eq!(
            extract_url_from_protocol_arg(arg),
            Some("https://www.reddit.com/r/memes/comments/123".to_string())
        );
    }

    #[test]
    fn test_extract_url_with_multiple_query_params_unencoded() {
        let arg = "bundlerock://download?url=https://example.com/video.mp4?param1=abc&param2=def";
        assert_eq!(
            extract_url_from_protocol_arg(arg),
            Some("https://example.com/video.mp4?param1=abc&param2=def".to_string())
        );
    }

    #[test]
    fn test_extract_url_with_multiple_query_params_encoded() {
        let arg = "bundlerock://download?url=https%3A%2F%2Fexample.com%2Fvideo.mp4%3Fparam1%3Dabc%26param2%3Ddef";
        assert_eq!(
            extract_url_from_protocol_arg(arg),
            Some("https://example.com/video.mp4?param1=abc&param2=def".to_string())
        );
    }

    #[test]
    fn test_extract_url_direct_scheme() {
        let arg = "bundlerock://https://example.com/video.mp4";
        assert_eq!(
            extract_url_from_protocol_arg(arg),
            Some("https://example.com/video.mp4".to_string())
        );
    }

    #[test]
    fn test_extract_url_download_path() {
        let arg = "bundlerock://download/https://example.com/file.zip";
        assert_eq!(
            extract_url_from_protocol_arg(arg),
            Some("https://example.com/file.zip".to_string())
        );
    }

    #[test]
    fn test_extract_url_with_quotes() {
        let arg = "\"bundlerock://download?url=https://example.com/test.mp4\"";
        assert_eq!(
            extract_url_from_protocol_arg(arg),
            Some("https://example.com/test.mp4".to_string())
        );
    }

    #[test]
    fn test_extract_url_reddit_packaged_media() {
        let arg = "bundlerock://download?url=https%3A%2F%2Fpackaged-media.redd.it%2Fwzdp7g5z5psh1%2Fpb%2Fm2-res_720p.mp4%3Fm%3DDASHPlaylist.mpd%26var%3Dsgpssan%26v%3D1%26e%3D1790823600%26s%3Df2d0a14f3db7aeff83ca2ab39f509cfc9135c87e";
        assert_eq!(
            extract_url_from_protocol_arg(arg),
            Some("https://packaged-media.redd.it/wzdp7g5z5psh1/pb/m2-res_720p.mp4?m=DASHPlaylist.mpd&var=sgpssan&v=1&e=1790823600&s=f2d0a14f3db7aeff83ca2ab39f509cfc9135c87e".to_string())
        );
    }

    #[test]
    fn test_extract_url_non_protocol() {
        assert_eq!(extract_url_from_protocol_arg("https://example.com"), None);
        assert_eq!(extract_url_from_protocol_arg("--flag"), None);
        assert_eq!(extract_url_from_protocol_arg("bundlerock://"), None);
    }

    #[test]
    fn test_percent_decode_helper() {
        assert_eq!(
            percent_decode("https%3A%2F%2Ftest.com%2Ffoo%3Fbar%3Dbaz%20qux"),
            "https://test.com/foo?bar=baz qux"
        );
        assert_eq!(
            percent_decode("hello+world%21"),
            "hello world!"
        );
    }
}
