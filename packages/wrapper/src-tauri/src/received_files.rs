use tauri::http::{header, Request, Response, StatusCode};
use tauri::{AppHandle, Manager, Runtime, UriSchemeContext, UriSchemeResponder};

pub const SCHEME: &str = "colibri-files";
const DIRECTORY: &str = "received-files";

pub fn serve<R: Runtime>(
    context: UriSchemeContext<'_, R>,
    request: Request<Vec<u8>>,
    responder: UriSchemeResponder,
) {
    let app = context.app_handle().clone();
    let id = request.uri().path().trim_start_matches('/').to_string();
    std::thread::spawn(move || responder.respond(respond(&app, &id)));
}

fn is_valid_id(id: &str) -> bool {
    !id.is_empty()
        && !id.contains("..")
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '.')
}

fn content_type(id: &str) -> &'static str {
    match id.rsplit('.').next().unwrap_or_default() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "heic" => "image/heic",
        "avif" => "image/avif",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "3gp" => "video/3gpp",
        _ => "application/octet-stream",
    }
}

fn empty(status: StatusCode) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .body(Vec::new())
        .unwrap_or_else(|_| Response::new(Vec::new()))
}

fn respond<R: Runtime>(app: &AppHandle<R>, id: &str) -> Response<Vec<u8>> {
    if !is_valid_id(id) {
        return empty(StatusCode::BAD_REQUEST);
    }
    let Ok(cache) = app.path().app_cache_dir() else {
        return empty(StatusCode::NOT_FOUND);
    };
    let path = cache.join(DIRECTORY).join(id);
    let Ok(bytes) = std::fs::read(&path) else {
        return empty(StatusCode::NOT_FOUND);
    };
    let _ = std::fs::remove_file(&path);
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type(id))
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .header(header::CACHE_CONTROL, "no-store")
        .body(bytes)
        .unwrap_or_else(|_| empty(StatusCode::INTERNAL_SERVER_ERROR))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_staged_ids_only() {
        assert!(is_valid_id("0b5f9a2e-1c2d-4e5f-8a9b-0c1d2e3f4a5b.png"));
        assert!(!is_valid_id(""));
        assert!(!is_valid_id("../secret"));
        assert!(!is_valid_id("a/b.png"));
        assert!(!is_valid_id("..png"));
    }

    #[test]
    fn maps_extensions_to_media_types() {
        assert_eq!(content_type("x.png"), "image/png");
        assert_eq!(content_type("x.jpeg"), "image/jpeg");
        assert_eq!(content_type("x.mp4"), "video/mp4");
        assert_eq!(content_type("x.unknown"), "application/octet-stream");
    }
}
