use std::collections::HashMap;
use std::ffi::c_void;

use windows::Graphics::Capture::{GraphicsCaptureItem, GraphicsCaptureSession};
use windows::Win32::Foundation::HWND;
use windows::Win32::UI::WindowsAndMessaging::GetWindowThreadProcessId;

use super::{CaptureQuality, CaptureSource, FrameSender, SourceId, SourceKind};
use crate::native_error::NativeError;

mod audio;
mod capture;
mod encoder;
mod enumerate;
mod item;
mod thumbnail;

pub use capture::Capture;

const THUMBNAIL_LONG_EDGE: f64 = 400.0;
const MAX_THUMBNAILS: usize = 48;
const GRAPHICS_CAPTURE_MIN_BUILD: u32 = 18362;

pub fn supported() -> bool {
    if windows_version::OsVersion::current().build < GRAPHICS_CAPTURE_MIN_BUILD {
        return false;
    }

    item::join_multithreaded_apartment();
    GraphicsCaptureSession::IsSupported().unwrap_or(false)
}

pub fn permission_granted() -> bool {
    true
}

pub fn request_permission() -> bool {
    true
}

pub fn open_privacy_settings() -> Result<(), NativeError> {
    Ok(())
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

fn process_of(window: isize) -> u32 {
    let mut process = 0u32;
    unsafe { GetWindowThreadProcessId(HWND(window as *mut c_void), Some(&mut process)) };
    process
}

struct Candidate {
    source: CaptureSource,
    window: Option<isize>,
    monitor: Option<enumerate::MonitorInfo>,
}

fn collect_candidates() -> Vec<Candidate> {
    let monitors = enumerate::monitors();
    let listed = enumerate::windows();
    let applications = enumerate::applications(&listed);

    let mut candidates = Vec::new();

    for (index, monitor) in monitors.iter().enumerate() {
        let Ok(handle) = item::for_monitor(monitor.handle) else {
            continue;
        };
        let (width, height) = item::measured(&handle, (monitor.width, monitor.height));

        candidates.push(Candidate {
            source: CaptureSource {
                id: SourceId::new(SourceKind::Display, monitor.handle.to_string()).encode(),
                kind: SourceKind::Display,
                name: if monitor.primary && monitors.len() > 1 {
                    format!("Screen {} (Main)", index + 1)
                } else {
                    format!("Screen {}", index + 1)
                },
                application: None,
                width,
                height,
                has_thumbnail: false,
            },
            window: None,
            monitor: Some(monitor.clone()),
        });
    }

    for application in &applications {
        let Ok(handle) = item::for_window(application.primary_window) else {
            continue;
        };
        let (width, height) = item::measured(&handle, (application.width, application.height));

        candidates.push(Candidate {
            source: CaptureSource {
                id: SourceId::new(SourceKind::Application, application.token.clone()).encode(),
                kind: SourceKind::Application,
                name: application.name.clone(),
                application: None,
                width,
                height,
                has_thumbnail: false,
            },
            window: Some(application.primary_window),
            monitor: None,
        });
    }

    for window in &listed {
        let Ok(handle) = item::for_window(window.handle) else {
            continue;
        };
        let (width, height) = item::measured(&handle, (window.width, window.height));

        candidates.push(Candidate {
            source: CaptureSource {
                id: SourceId::new(SourceKind::Window, window.handle.to_string()).encode(),
                kind: SourceKind::Window,
                name: window.title.clone(),
                application: Some(window.app_name.clone()),
                width,
                height,
                has_thumbnail: false,
            },
            window: Some(window.handle),
            monitor: None,
        });
    }

    candidates
}

fn capture_thumbnails(candidates: &mut [Candidate]) -> HashMap<String, Vec<u8>> {
    let mut thumbnails = HashMap::new();

    for candidate in candidates.iter_mut().take(MAX_THUMBNAILS) {
        let png = match (&candidate.monitor, candidate.window) {
            (Some(monitor), _) => thumbnail::for_monitor(monitor),
            (None, Some(window)) => {
                thumbnail::for_window(window, candidate.source.width, candidate.source.height)
            }
            (None, None) => None,
        };

        if let Some(png) = png {
            thumbnails.insert(candidate.source.id.clone(), png);
            candidate.source.has_thumbnail = true;
        }
    }

    thumbnails
}

fn resolve(source: &SourceId) -> Result<(GraphicsCaptureItem, audio::Target), NativeError> {
    match source.kind {
        SourceKind::Display => {
            let wanted: isize = source
                .native
                .parse()
                .map_err(|_| NativeError::invalid_request("that screen id is not a number"))?;

            if !enumerate::monitors()
                .iter()
                .any(|monitor| monitor.handle == wanted)
            {
                return Err(NativeError::invalid_request(
                    "that screen is no longer connected",
                ));
            }

            let handle = item::for_monitor(wanted).map_err(|error| {
                NativeError::failed(format!("could not capture that screen: {error}"))
            })?;

            Ok((handle, audio::Target::EverythingExceptColibri))
        }
        SourceKind::Window => {
            let wanted: isize = source
                .native
                .parse()
                .map_err(|_| NativeError::invalid_request("that window id is not a number"))?;

            let handle = item::for_window(wanted).map_err(|_| {
                NativeError::invalid_request("that window has closed since you picked it")
            })?;

            Ok((handle, audio::Target::Process(process_of(wanted))))
        }
        SourceKind::Application => {
            let listed = enumerate::windows();
            let application = enumerate::applications(&listed)
                .into_iter()
                .find(|candidate| candidate.token == source.native)
                .ok_or_else(|| {
                    NativeError::invalid_request("that app has quit since you picked it")
                })?;

            let handle = item::for_window(application.primary_window).map_err(|_| {
                NativeError::invalid_request("that app has quit since you picked it")
            })?;

            Ok((
                handle,
                audio::Target::Process(process_of(application.primary_window)),
            ))
        }
    }
}

pub async fn list_sources() -> Result<(Vec<CaptureSource>, HashMap<String, Vec<u8>>), NativeError> {
    tauri::async_runtime::spawn_blocking(|| {
        item::join_multithreaded_apartment();

        let mut candidates = collect_candidates();
        if candidates.is_empty() {
            return Err(NativeError::failed("nothing on this PC can be captured"));
        }

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
    item::join_multithreaded_apartment();

    let (handle, target) = resolve(source)?;
    capture::start(handle, quality, capture_audio, target, sender)
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
