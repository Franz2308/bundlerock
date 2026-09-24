use crate::models::ProbeResult;
use reqwest::header;
use std::time::Duration;
use url::Url;

const DEFAULT_USER_AGENT: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 BundleRock/0.1.0";

/// Probes a URL using HEAD or fallback GET Range: bytes=0-0 to discover download metadata.
pub async fn probe_url(client: &reqwest::Client, target_url: &str) -> Result<ProbeResult, String> {
    let parsed_url = Url::parse(target_url).map_err(|e| format!("Invalid URL: {e}"))?;

    // Step 1: Try HEAD request first
    let head_result = client
        .head(target_url)
        .header(header::USER_AGENT, DEFAULT_USER_AGENT)
        .timeout(Duration::from_secs(12))
        .send()
        .await;

    let mut content_length = None;
    let mut accept_ranges = false;
    let mut etag = None;
    let mut content_type = None;
    let mut filename_from_disposition = None;
    let mut head_success = false;
    let mut head_error = None;

    match head_result {
        Ok(resp) => {
            let status = resp.status();
            if status.is_success() {
                head_success = true;
                let headers = resp.headers();

                if let Some(val) = headers.get(header::ACCEPT_RANGES) {
                    if let Ok(s) = val.to_str() {
                        if s.trim().eq_ignore_ascii_case("bytes") {
                            accept_ranges = true;
                        }
                    }
                }

                if let Some(val) = headers.get(header::CONTENT_LENGTH) {
                    if let Ok(s) = val.to_str() {
                        content_length = s.trim().parse::<u64>().ok();
                    }
                }

                if let Some(val) = headers.get(header::ETAG) {
                    if let Ok(s) = val.to_str() {
                        etag = Some(s.trim().trim_matches('"').to_string());
                    }
                }

                if let Some(val) = headers.get(header::CONTENT_TYPE) {
                    if let Ok(s) = val.to_str() {
                        content_type = Some(s.to_string());
                    }
                }

                if let Some(val) = headers.get(header::CONTENT_DISPOSITION) {
                    if let Ok(s) = val.to_str() {
                        filename_from_disposition = parse_content_disposition_filename(s);
                    }
                }
            } else if status.is_client_error() || status.is_server_error() {
                head_error = Some(format!("HTTP status {status}"));
            }
        }
        Err(e) => {
            head_error = Some(e.to_string());
        }
    }

    // Step 2: If HEAD was not successful or did not confirm range support, probe with GET Range: bytes=0-0
    if !head_success || !accept_ranges || content_length.is_none() {
        let range_result = client
            .get(target_url)
            .header(header::USER_AGENT, DEFAULT_USER_AGENT)
            .header(header::RANGE, "bytes=0-0")
            .timeout(Duration::from_secs(12))
            .send()
            .await;

        match range_result {
            Ok(resp) => {
                let status = resp.status();
                let headers = resp.headers();

                if status == reqwest::StatusCode::PARTIAL_CONTENT {
                    // 206 Partial Content confirms range support
                    accept_ranges = true;

                    // Extract total size from Content-Range: bytes 0-0/123456
                    if let Some(val) = headers.get(header::CONTENT_RANGE) {
                        if let Ok(s) = val.to_str() {
                            if let Some(total) = parse_content_range_total(s) {
                                content_length = Some(total);
                            }
                        }
                    }
                } else if status.is_success() {
                    // 200 OK: server ignored Range header, streams from byte 0
                    accept_ranges = false;
                    if content_length.is_none() {
                        if let Some(val) = headers.get(header::CONTENT_LENGTH) {
                            if let Ok(s) = val.to_str() {
                                content_length = s.trim().parse::<u64>().ok();
                            }
                        }
                    }
                } else {
                    // If HEAD also failed, fail with the server status
                    if !head_success {
                        return Err(format!("Server responded with HTTP error {status}"));
                    }
                }

                if etag.is_none() {
                    if let Some(val) = headers.get(header::ETAG) {
                        if let Ok(s) = val.to_str() {
                            etag = Some(s.trim().trim_matches('"').to_string());
                        }
                    }
                }

                if content_type.is_none() {
                    if let Some(val) = headers.get(header::CONTENT_TYPE) {
                        if let Ok(s) = val.to_str() {
                            content_type = Some(s.to_string());
                        }
                    }
                }

                if filename_from_disposition.is_none() {
                    if let Some(val) = headers.get(header::CONTENT_DISPOSITION) {
                        if let Ok(s) = val.to_str() {
                            filename_from_disposition = parse_content_disposition_filename(s);
                        }
                    }
                }
            }
            Err(e) => {
                // If both HEAD and GET failed, fail the probe
                if !head_success {
                    let prev = head_error.unwrap_or_else(|| "HEAD request failed".to_string());
                    return Err(format!("Failed to probe URL (HEAD: {prev}, GET: {e})"));
                }
            }
        }
    }

    // Step 3: Extract and sanitize filename
    let file_name = if let Some(disp_name) = filename_from_disposition {
        sanitize_filename(&disp_name)
    } else {
        extract_filename_from_url(&parsed_url)
    };

    // Step 4: Calculate suggested connections based on size and range capability
    let suggested_connections = calculate_suggested_connections(accept_ranges, content_length);

    Ok(ProbeResult {
        url: target_url.to_string(),
        file_name,
        content_length,
        accept_ranges,
        etag,
        content_type,
        suggested_connections,
        media_info: None,
    })
}

/// Parses Content-Disposition header to extract the filename per RFC 6266 and RFC 5987.
/// Prioritizes `filename*=` (UTF-8 encoded) over `filename=`.
pub fn parse_content_disposition_filename(header_value: &str) -> Option<String> {
    let mut filename_star = None;
    let mut filename_standard = None;

    for part in header_value.split(';') {
        let part = part.trim();
        if let Some(eq_idx) = part.find('=') {
            let key = part[..eq_idx].trim().to_ascii_lowercase();
            let value = part[eq_idx + 1..].trim().trim_matches('"').trim_matches('\'');

            if key == "filename*" {
                // Format: charset'[language]'encoded_text
                let encoded = if let Some(idx) = value.rfind("''") {
                    &value[idx + 2..]
                } else {
                    value
                };

                if let Ok(decoded) = percent_encoding_decode(encoded) {
                    let cleaned = decoded.trim();
                    if !cleaned.is_empty() {
                        filename_star = Some(cleaned.to_string());
                    }
                }
            } else if key == "filename" && filename_standard.is_none() {
                let cleaned = value.trim();
                if !cleaned.is_empty() {
                    filename_standard = Some(cleaned.to_string());
                }
            }
        }
    }

    filename_star.or(filename_standard)
}

/// Parses the total byte length from Content-Range header: `bytes 0-0/1234567` or `bytes */1234567`
pub fn parse_content_range_total(header_value: &str) -> Option<u64> {
    let slash_idx = header_value.rfind('/')?;
    let total_str = header_value[slash_idx + 1..].trim();
    if total_str == "*" {
        None
    } else {
        total_str.parse::<u64>().ok()
    }
}

/// Extracts a clean filename from a URL path.
pub fn extract_filename_from_url(url: &Url) -> String {
    let mut candidate = None;
    if let Some(segments) = url.path_segments() {
        for seg in segments.rev() {
            let trimmed = seg.trim();
            if !trimmed.is_empty() {
                candidate = Some(trimmed);
                break;
            }
        }
    }

    let raw_name = match candidate {
        Some(seg) => percent_encoding_decode(seg).unwrap_or_else(|_| seg.to_string()),
        None => "download.bin".to_string(),
    };

    sanitize_filename(&raw_name)
}

/// Decodes percent-encoded UTF-8 strings (e.g. %20 -> space).
pub fn percent_encoding_decode(input: &str) -> Result<String, ()> {
    let mut bytes = Vec::with_capacity(input.len());
    let mut chars = input.bytes().peekable();

    while let Some(b) = chars.next() {
        if b == b'%' {
            let hex1 = chars.next().ok_or(())?;
            let hex2 = chars.next().ok_or(())?;
            let val1 = hex_val(hex1).ok_or(())?;
            let val2 = hex_val(hex2).ok_or(())?;
            bytes.push((val1 << 4) | val2);
        } else if b == b'+' {
            bytes.push(b' ');
        } else {
            bytes.push(b);
        }
    }

    String::from_utf8(bytes).map_err(|_| ())
}

fn hex_val(b: u8) -> Option<u8> {
    match b {
        b'0'..=b'9' => Some(b - b'0'),
        b'a'..=b'f' => Some(b - b'a' + 10),
        b'A'..=b'F' => Some(b - b'A' + 10),
        _ => None,
    }
}

/// Sanitizes filenames for Windows filesystem compatibility.
/// Strips forbidden characters: <>:"/\|?* and control characters.
/// Guards against Windows reserved names (CON, PRN, AUX, NUL, COM1..9, LPT1..9).
pub fn sanitize_filename(filename: &str) -> String {
    let forbidden = ['<', '>', ':', '"', '/', '\\', '|', '?', '*'];
    let mut cleaned: String = filename
        .chars()
        .filter(|&c| !forbidden.contains(&c) && !c.is_control())
        .collect();

    // Strip leading and trailing spaces and dots (Windows rule)
    cleaned = cleaned.trim_matches(|c| c == ' ' || c == '.').to_string();

    if cleaned.is_empty() {
        return "download.bin".to_string();
    }

    let reserved_names = [
        "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7",
        "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
    ];

    let stem = cleaned.split('.').next().unwrap_or(&cleaned);

    for res in reserved_names {
        if stem.eq_ignore_ascii_case(res) {
            return format!("_{cleaned}");
        }
    }

    cleaned
}

/// Calculates suggested connections based on file size and range support.
pub fn calculate_suggested_connections(accept_ranges: bool, content_length: Option<u64>) -> usize {
    if !accept_ranges {
        return 1;
    }

    match content_length {
        None => 1,
        Some(len) if len < 2 * 1024 * 1024 => 2,       // < 2 MB: 2 connections
        Some(len) if len < 20 * 1024 * 1024 => 4,      // < 20 MB: 4 connections
        Some(len) if len < 200 * 1024 * 1024 => 8,     // < 200 MB: 8 connections
        Some(_) => 16,                                  // >= 200 MB: 16 connections
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_content_disposition_standard() {
        let header = "attachment; filename=\"ubuntu-22.04.iso\"";
        assert_eq!(
            parse_content_disposition_filename(header),
            Some("ubuntu-22.04.iso".to_string())
        );

        let unquoted = "attachment; filename=report.pdf";
        assert_eq!(
            parse_content_disposition_filename(unquoted),
            Some("report.pdf".to_string())
        );

        let uppercase = "attachment; FILENAME=\"backup.tar.gz\"";
        assert_eq!(
            parse_content_disposition_filename(uppercase),
            Some("backup.tar.gz".to_string())
        );
    }

    #[test]
    fn test_parse_content_disposition_encoded() {
        let header = "attachment; filename*=UTF-8''my%20cool%20file.pdf";
        assert_eq!(
            parse_content_disposition_filename(header),
            Some("my cool file.pdf".to_string())
        );

        // RFC 6266: filename* takes precedence over filename
        let both = "attachment; filename=\"fallback.txt\"; filename*=UTF-8''priority%20name.txt";
        assert_eq!(
            parse_content_disposition_filename(both),
            Some("priority name.txt".to_string())
        );

        // Whitespace around '='
        let spaced = "attachment; filename* = UTF-8''spaced%20name.txt";
        assert_eq!(
            parse_content_disposition_filename(spaced),
            Some("spaced name.txt".to_string())
        );
    }

    #[test]
    fn test_parse_content_range_total() {
        let header = "bytes 0-0/987654321";
        assert_eq!(parse_content_range_total(header), Some(987654321));

        let star_header = "bytes 0-0/*";
        assert_eq!(parse_content_range_total(star_header), None);

        let any_range = "bytes */5000000";
        assert_eq!(parse_content_range_total(any_range), Some(5000000));
    }

    #[test]
    fn test_extract_filename_from_url() {
        let url = Url::parse("https://example.com/downloads/setup%20file.exe?token=123").unwrap();
        assert_eq!(extract_filename_from_url(&url), "setup file.exe");

        let root_url = Url::parse("https://example.com/").unwrap();
        assert_eq!(extract_filename_from_url(&root_url), "download.bin");
    }

    #[test]
    fn test_sanitize_filename() {
        assert_eq!(sanitize_filename("valid_name.zip"), "valid_name.zip");
        assert_eq!(sanitize_filename("illegal:name*?.txt"), "illegalname.txt");
        assert_eq!(sanitize_filename("CON.txt"), "_CON.txt");
        assert_eq!(sanitize_filename("aux.tar.gz"), "_aux.tar.gz");
        assert_eq!(sanitize_filename("   ...   "), "download.bin");
        assert_eq!(sanitize_filename("../../etc/passwd"), "etcpasswd");
    }

    #[test]
    fn test_calculate_suggested_connections() {
        assert_eq!(calculate_suggested_connections(false, Some(100_000_000)), 1);
        assert_eq!(calculate_suggested_connections(true, None), 1);
        assert_eq!(calculate_suggested_connections(true, Some(1_000_000)), 2);
        assert_eq!(calculate_suggested_connections(true, Some(10_000_000)), 4);
        assert_eq!(calculate_suggested_connections(true, Some(50_000_000)), 8);
        assert_eq!(calculate_suggested_connections(true, Some(500_000_000)), 16);
    }
}
