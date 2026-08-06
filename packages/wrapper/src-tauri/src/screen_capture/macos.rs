use std::collections::HashMap;
use std::sync::mpsc;
use std::time::Duration;

use block2::RcBlock;
use objc2::rc::Retained;
use objc2::AllocAnyThread;
use objc2_app_kit::{NSBitmapImageFileType, NSBitmapImageRep};
use objc2_core_graphics::CGImage;
use objc2_foundation::{NSArray, NSDictionary, NSError};
use objc2_screen_capture_kit::{
    SCContentFilter, SCDisplay, SCRunningApplication, SCScreenshotManager, SCShareableContent,
    SCStreamConfiguration, SCWindow,
};

use super::{CaptureQuality, CaptureSource, FrameSender, SourceId, SourceKind};
use crate::native_error::NativeError;

mod audio;
mod encoder;
mod permission;
mod stream;

pub use stream::Capture;

const CONTENT_TIMEOUT: Duration = Duration::from_secs(10);
const THUMBNAIL_TIMEOUT: Duration = Duration::from_secs(8);
const THUMBNAIL_LONG_EDGE: f64 = 400.0;
const MAX_THUMBNAILS: usize = 48;

pub fn supported() -> bool {
    true
}

pub fn permission_granted() -> bool {
    permission::granted()
}

pub fn request_permission() -> bool {
    permission::request()
}

pub fn open_privacy_settings() -> Result<(), NativeError> {
    permission::open_settings()
}

struct ShareableContent {
    content: Retained<SCShareableContent>,
}

fn shareable_content() -> Result<ShareableContent, NativeError> {
    let (tx, rx) = mpsc::channel::<Result<Retained<SCShareableContent>, String>>();

    let handler = RcBlock::new(
        move |content: *mut SCShareableContent, error: *mut NSError| {
            let outcome = if content.is_null() {
                let message = if error.is_null() {
                    "screen recording is not available".to_string()
                } else {
                    unsafe { &*error }.localizedDescription().to_string()
                };
                Err(message)
            } else {
                Ok(unsafe { Retained::retain(content) }
                    .expect("ScreenCaptureKit handed back a live object"))
            };
            let _ = tx.send(outcome);
        },
    );

    unsafe {
        SCShareableContent::getShareableContentExcludingDesktopWindows_onScreenWindowsOnly_completionHandler(
            true, true, &handler,
        );
    }

    match rx.recv_timeout(CONTENT_TIMEOUT) {
        Ok(Ok(content)) => Ok(ShareableContent { content }),
        Ok(Err(message)) => Err(permission_error(&message)),
        Err(_) => Err(NativeError::failed(
            "timed out asking macOS what can be captured",
        )),
    }
}

fn permission_error(message: &str) -> NativeError {
    let lowered = message.to_lowercase();
    if lowered.contains("permission")
        || lowered.contains("declined")
        || lowered.contains("not authorized")
        || lowered.contains("unauthorized")
    {
        NativeError::new(
            crate::native_error::NativeErrorCode::Unsupported,
            "Colibri needs Screen & System Audio Recording permission in System Settings",
        )
    } else {
        NativeError::failed(message.to_string())
    }
}

fn is_listable_window(window: &SCWindow) -> bool {
    unsafe {
        if window.windowLayer() != 0 || !window.isOnScreen() {
            return false;
        }
        let frame = window.frame();
        if frame.size.width < 80.0 || frame.size.height < 80.0 {
            return false;
        }
        window
            .title()
            .is_some_and(|title| !title.to_string().trim().is_empty())
    }
}

fn window_source(window: &SCWindow) -> CaptureSource {
    let (title, application, width, height, id) = unsafe {
        let frame = window.frame();
        (
            window
                .title()
                .map(|t| t.to_string())
                .unwrap_or_else(|| "Untitled window".to_string()),
            window
                .owningApplication()
                .map(|app| app.applicationName().to_string()),
            frame.size.width as u32,
            frame.size.height as u32,
            window.windowID(),
        )
    };

    CaptureSource {
        id: SourceId::new(SourceKind::Window, id.to_string()).encode(),
        kind: SourceKind::Window,
        name: title,
        application,
        width,
        height,
        has_thumbnail: false,
    }
}

fn display_source(display: &SCDisplay, index: usize) -> CaptureSource {
    let (id, width, height) = unsafe {
        (
            display.displayID(),
            display.width() as u32,
            display.height() as u32,
        )
    };

    CaptureSource {
        id: SourceId::new(SourceKind::Display, id.to_string()).encode(),
        kind: SourceKind::Display,
        name: format!("Screen {}", index + 1),
        application: None,
        width,
        height,
        has_thumbnail: false,
    }
}

fn application_source(
    app: &SCRunningApplication,
    width: u32,
    height: u32,
) -> Option<CaptureSource> {
    let (bundle, name) = unsafe {
        (
            app.bundleIdentifier().to_string(),
            app.applicationName().to_string(),
        )
    };

    if bundle.trim().is_empty() {
        return None;
    }

    Some(CaptureSource {
        id: SourceId::new(SourceKind::Application, bundle).encode(),
        kind: SourceKind::Application,
        name: if name.trim().is_empty() {
            "Unnamed app".to_string()
        } else {
            name
        },
        application: None,
        width,
        height,
        has_thumbnail: false,
    })
}

fn collect_sources(content: &ShareableContent) -> Vec<CaptureSource> {
    let displays = unsafe { content.content.displays() };
    let windows = unsafe { content.content.windows() };

    let mut sources: Vec<CaptureSource> = Vec::new();

    for (index, display) in displays.iter().enumerate() {
        sources.push(display_source(&display, index));
    }

    let listable: Vec<Retained<SCWindow>> =
        windows.iter().filter(|w| is_listable_window(w)).collect();

    let primary = sources
        .first()
        .map_or((1920, 1080), |d| (d.width, d.height));
    let mut seen_apps: Vec<String> = Vec::new();

    for window in &listable {
        let Some(app) = (unsafe { window.owningApplication() }) else {
            continue;
        };
        let bundle = unsafe { app.bundleIdentifier() }.to_string();
        if seen_apps.contains(&bundle) {
            continue;
        }
        seen_apps.push(bundle);
        if let Some(source) = application_source(&app, primary.0, primary.1) {
            sources.push(source);
        }
    }

    for window in &listable {
        sources.push(window_source(window));
    }

    sources
}

struct Candidate {
    source: CaptureSource,
    filter: Retained<SCContentFilter>,
}

fn measured_size(filter: &SCContentFilter, fallback: (u32, u32)) -> (u32, u32) {
    let info = unsafe { SCShareableContent::infoForFilter(filter) };
    let rect = unsafe { info.contentRect() };
    let scale = f64::from(unsafe { info.pointPixelScale() }).max(1.0);

    let wide = (rect.size.width * scale).round();
    let high = (rect.size.height * scale).round();

    if wide >= 2.0 && high >= 2.0 {
        (wide as u32, high as u32)
    } else {
        fallback
    }
}

fn collect_candidates(content: &ShareableContent) -> Vec<Candidate> {
    let mut candidates = Vec::new();

    for mut source in collect_sources(content) {
        let Some(parsed) = SourceId::parse(&source.id) else {
            continue;
        };
        let Ok(filter) = content_filter(content, &parsed) else {
            continue;
        };

        let (wide, high) = measured_size(&filter, (source.width, source.height));
        source.width = wide;
        source.height = high;

        candidates.push(Candidate { source, filter });
    }

    candidates
}

fn thumbnail_size(width: u32, height: u32) -> (usize, usize) {
    let wide = f64::from(width.max(1));
    let high = f64::from(height.max(1));
    let scale = (THUMBNAIL_LONG_EDGE / wide.max(high)).min(1.0);

    (
        ((wide * scale).round() as usize).max(2),
        ((high * scale).round() as usize).max(2),
    )
}

fn thumbnail_configuration(width: u32, height: u32) -> Retained<SCStreamConfiguration> {
    let (wide, high) = thumbnail_size(width, height);
    let config = unsafe { SCStreamConfiguration::new() };
    unsafe {
        config.setWidth(wide);
        config.setHeight(high);
        config.setShowsCursor(false);
        config.setScalesToFit(true);
    }
    config
}

fn png_from_cg_image(image: &CGImage) -> Option<Vec<u8>> {
    unsafe {
        let rep = NSBitmapImageRep::initWithCGImage(NSBitmapImageRep::alloc(), image);
        let properties = NSDictionary::new();
        let data =
            rep.representationUsingType_properties(NSBitmapImageFileType::PNG, &properties)?;
        Some(data.to_vec())
    }
}

fn capture_thumbnails(candidates: &mut [Candidate]) -> HashMap<String, Vec<u8>> {
    let (tx, rx) = mpsc::channel::<(String, Vec<u8>)>();
    let mut requested = 0usize;

    for candidate in candidates.iter() {
        if requested >= MAX_THUMBNAILS {
            break;
        }

        let source = &candidate.source;
        let filter = &candidate.filter;
        let config = thumbnail_configuration(source.width, source.height);

        let id = source.id.clone();
        let tx = tx.clone();
        let handler = RcBlock::new(move |image: *mut CGImage, _error: *mut NSError| {
            if image.is_null() {
                return;
            }
            if let Some(png) = png_from_cg_image(unsafe { &*image }) {
                let _ = tx.send((id.clone(), png));
            }
        });

        unsafe {
            SCScreenshotManager::captureImageWithFilter_configuration_completionHandler(
                filter,
                &config,
                Some(&handler),
            );
        }
        requested += 1;
    }

    drop(tx);

    let mut thumbnails = HashMap::new();
    let deadline = std::time::Instant::now() + THUMBNAIL_TIMEOUT;
    while thumbnails.len() < requested {
        let Some(remaining) = deadline.checked_duration_since(std::time::Instant::now()) else {
            break;
        };
        match rx.recv_timeout(remaining) {
            Ok((id, png)) => {
                thumbnails.insert(id, png);
            }
            Err(_) => break,
        }
    }

    for candidate in candidates.iter_mut() {
        candidate.source.has_thumbnail = thumbnails.contains_key(&candidate.source.id);
    }

    thumbnails
}

fn find_display(content: &ShareableContent, native: &str) -> Option<Retained<SCDisplay>> {
    let wanted: u32 = native.parse().ok()?;
    unsafe { content.content.displays() }
        .iter()
        .find(|display| unsafe { display.displayID() } == wanted)
}

fn primary_display(content: &ShareableContent) -> Option<Retained<SCDisplay>> {
    unsafe { content.content.displays() }.iter().next()
}

fn content_filter(
    content: &ShareableContent,
    source: &SourceId,
) -> Result<Retained<SCContentFilter>, NativeError> {
    match source.kind {
        SourceKind::Display => {
            let display = find_display(content, &source.native).ok_or_else(|| {
                NativeError::invalid_request("that screen is no longer connected")
            })?;
            let empty: Retained<NSArray<SCWindow>> = NSArray::new();
            Ok(unsafe {
                SCContentFilter::initWithDisplay_excludingWindows(
                    SCContentFilter::alloc(),
                    &display,
                    &empty,
                )
            })
        }
        SourceKind::Window => {
            let wanted: u32 = source
                .native
                .parse()
                .map_err(|_| NativeError::invalid_request("that window id is not a number"))?;
            let window = unsafe { content.content.windows() }
                .iter()
                .find(|window| unsafe { window.windowID() } == wanted)
                .ok_or_else(|| {
                    NativeError::invalid_request("that window has closed since you picked it")
                })?;
            Ok(unsafe {
                SCContentFilter::initWithDesktopIndependentWindow(SCContentFilter::alloc(), &window)
            })
        }
        SourceKind::Application => {
            let display = primary_display(content)
                .ok_or_else(|| NativeError::failed("no display is available to capture"))?;
            let apps: Vec<Retained<SCRunningApplication>> =
                unsafe { content.content.applications() }
                    .iter()
                    .filter(|app| unsafe { app.bundleIdentifier() }.to_string() == source.native)
                    .collect();

            if apps.is_empty() {
                return Err(NativeError::invalid_request(
                    "that app has quit since you picked it",
                ));
            }

            let apps = NSArray::from_retained_slice(&apps);
            let empty: Retained<NSArray<SCWindow>> = NSArray::new();
            Ok(unsafe {
                SCContentFilter::initWithDisplay_includingApplications_exceptingWindows(
                    SCContentFilter::alloc(),
                    &display,
                    &apps,
                    &empty,
                )
            })
        }
    }
}

pub async fn list_sources() -> Result<(Vec<CaptureSource>, HashMap<String, Vec<u8>>), NativeError> {
    tauri::async_runtime::spawn_blocking(|| {
        let content = shareable_content()?;
        let mut candidates = collect_candidates(&content);
        let thumbnails = capture_thumbnails(&mut candidates);
        let sources = candidates
            .into_iter()
            .map(|candidate| candidate.source)
            .collect();
        Ok((sources, thumbnails))
    })
    .await
    .map_err(|error| NativeError::failed(error.to_string()))?
}

pub fn start(
    source: &SourceId,
    quality: CaptureQuality,
    capture_audio: bool,
    sender: FrameSender,
) -> Result<Capture, NativeError> {
    let content = shareable_content()?;
    let filter = content_filter(&content, source)?;
    stream::start(&filter, quality, capture_audio, sender)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ratio(width: u32, height: u32) -> f64 {
        let (wide, high) = thumbnail_size(width, height);
        wide as f64 / high as f64
    }

    #[test]
    fn a_thumbnail_keeps_the_aspect_ratio_of_a_wide_display() {
        assert!((ratio(3840, 2160) - 16.0 / 9.0).abs() < 0.01);
    }

    #[test]
    fn a_thumbnail_keeps_the_aspect_ratio_of_a_tall_window() {
        assert!((ratio(600, 1400) - 600.0 / 1400.0).abs() < 0.01);
    }

    #[test]
    fn an_ultrawide_display_is_not_squeezed_into_sixteen_by_nine() {
        let sixteen_by_nine = 16.0 / 9.0;
        assert!(ratio(5120, 1440) > sixteen_by_nine + 0.5);
    }

    #[test]
    fn the_long_edge_is_capped() {
        let (wide, high) = thumbnail_size(6000, 3000);
        assert_eq!(wide, THUMBNAIL_LONG_EDGE as usize);
        assert!(high <= THUMBNAIL_LONG_EDGE as usize);
    }

    #[test]
    fn a_small_window_is_never_scaled_up() {
        assert_eq!(thumbnail_size(120, 80), (120, 80));
    }

    #[test]
    fn a_degenerate_size_still_produces_a_usable_box() {
        let (wide, high) = thumbnail_size(0, 0);
        assert!(wide >= 2 && high >= 2);
    }
}
