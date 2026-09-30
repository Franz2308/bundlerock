// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if bundlerock_lib::protocol::handle_second_instance(&args) {
        return;
    }

    bundlerock_lib::run()
}

#[cfg(test)]
mod tests {
    use bundlerock_lib::protocol::*;

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

    #[test]
    fn test_normalize_reddit_packaged_media_url() {
        let raw = "https://packaged-media.redd.it/wzdp7g5z5psh1/pb/m2-res_720p.mp4?m=DASHPlaylist.mpd&var=sgpssan&v=1&e=1790823600&s=f2d0a14f3db7aeff83ca2ab39f509cfc9135c87e";
        assert_eq!(
            bundlerock_lib::media_extractor::normalize_reddit_url(raw),
            "https://v.redd.it/wzdp7g5z5psh1"
        );

        let normal_post = "https://www.reddit.com/r/memes/comments/123/title/";
        assert_eq!(bundlerock_lib::media_extractor::normalize_reddit_url(normal_post), normal_post);
    }

    #[test]
    fn test_windows_protocol_registration() {
        register_windows_protocol();

        // Verify with reg query
        let output = std::process::Command::new("reg")
            .args(&["query", r"HKCU\Software\Classes\bundlerock", "/s"])
            .output()
            .expect("Failed to run reg query");

        assert!(output.status.success());
        let stdout = String::from_utf8_lossy(&output.stdout);
        assert!(stdout.contains("URL:BundleRock Protocol"));
        assert!(stdout.contains("URL Protocol"));
        assert!(stdout.contains(r"shell\open\command"));
    }
}
