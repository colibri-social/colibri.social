use std::os::fd::OwnedFd;
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;

use ashpd::desktop::screencast::{CursorMode, Screencast, SelectSourcesOptions, SourceType};
use ashpd::desktop::{PersistMode, ResponseError};
use futures_util::StreamExt;
use pipewire as pw;
use pw::spa;
use pw::spa::param::video::{VideoFormat, VideoInfoRaw};
use pw::spa::pod::{ChoiceValue, Object, Pod, Property, Value};
use pw::spa::utils::{Choice, ChoiceEnum, ChoiceFlags};

use super::encoder::{Encoder, Frame, PixelOrder};
use super::{audio, start_audio, StartOptions};
use crate::native_error::{NativeError, NativeErrorCode};
use crate::screen_capture::{CaptureSource, FrameSender, SourceId, SourceKind};

const PORTAL_SOURCE: &str = "portal";
const LARGEST_WIDTH: u32 = 7680;
const LARGEST_HEIGHT: u32 = 4320;
const PIPEWIRE_START_TIMEOUT_SECONDS: u64 = 10;

pub fn sources() -> Vec<CaptureSource> {
    [
        (SourceKind::Display, "Whole screen"),
        (SourceKind::Window, "One window"),
    ]
    .into_iter()
    .map(|(kind, name)| CaptureSource {
        id: SourceId::new(kind, PORTAL_SOURCE).encode(),
        kind,
        name: name.to_string(),
        application: None,
        width: LARGEST_WIDTH,
        height: LARGEST_HEIGHT,
        has_thumbnail: false,
    })
    .collect()
}

fn cancelled() -> NativeError {
    NativeError::new(NativeErrorCode::Cancelled, "the share was cancelled")
}

fn portal_error(error: ashpd::Error) -> NativeError {
    match error {
        ashpd::Error::Response(ResponseError::Cancelled) => cancelled(),
        ashpd::Error::PortalNotFound(_) => NativeError::unsupported(),
        other => NativeError::failed(format!("the screen sharing portal failed: {other}")),
    }
}

struct Portal {
    proxy: Screencast,
    session: ashpd::desktop::Session<Screencast>,
}

struct Picked {
    portal: Portal,
    node: u32,
    fd: OwnedFd,
}

async fn pick(kind: SourceKind) -> Result<Picked, NativeError> {
    let proxy = Screencast::new().await.map_err(portal_error)?;
    let session = proxy
        .create_session(Default::default())
        .await
        .map_err(portal_error)?;

    let cursor = match proxy.available_cursor_modes().await {
        Ok(modes) if modes.contains(CursorMode::Embedded) => CursorMode::Embedded,
        _ => CursorMode::Hidden,
    };
    let source_type = match kind {
        SourceKind::Display => SourceType::Monitor,
        SourceKind::Window | SourceKind::Application => SourceType::Window,
    };

    let selection = proxy
        .select_sources(
            &session,
            SelectSourcesOptions::default()
                .set_cursor_mode(cursor)
                .set_sources(ashpd::enumflags2::BitFlags::from(source_type))
                .set_multiple(false)
                .set_persist_mode(PersistMode::DoNot),
        )
        .await;

    let portal = Portal { proxy, session };
    if let Err(error) = selection.and_then(|request| request.response()) {
        let _ = portal.session.close().await;
        return Err(portal_error(error));
    }

    let streams = match portal
        .proxy
        .start(&portal.session, None, Default::default())
        .await
        .and_then(|request| request.response())
    {
        Ok(streams) => streams,
        Err(error) => {
            let _ = portal.session.close().await;
            return Err(portal_error(error));
        }
    };

    let Some(node) = streams
        .streams()
        .first()
        .map(|stream| stream.pipe_wire_node_id())
    else {
        let _ = portal.session.close().await;
        return Err(cancelled());
    };

    let fd = match portal
        .proxy
        .open_pipe_wire_remote(&portal.session, Default::default())
        .await
    {
        Ok(fd) => fd,
        Err(error) => {
            let _ = portal.session.close().await;
            return Err(portal_error(error));
        }
    };

    Ok(Picked { portal, node, fd })
}

fn serialize(object: Object) -> Option<Vec<u8>> {
    spa::pod::serialize::PodSerializer::serialize(
        std::io::Cursor::new(Vec::new()),
        &Value::Object(object),
    )
    .ok()
    .map(|(cursor, _)| cursor.into_inner())
}

fn format_param(framerate: u32) -> Option<Vec<u8>> {
    serialize(spa::pod::object!(
        spa::utils::SpaTypes::ObjectParamFormat,
        spa::param::ParamType::EnumFormat,
        spa::pod::property!(
            spa::param::format::FormatProperties::MediaType,
            Id,
            spa::param::format::MediaType::Video
        ),
        spa::pod::property!(
            spa::param::format::FormatProperties::MediaSubtype,
            Id,
            spa::param::format::MediaSubtype::Raw
        ),
        spa::pod::property!(
            spa::param::format::FormatProperties::VideoFormat,
            Choice,
            Enum,
            Id,
            VideoFormat::BGRx,
            VideoFormat::BGRx,
            VideoFormat::BGRA,
            VideoFormat::RGBx,
            VideoFormat::RGBA,
        ),
        spa::pod::property!(
            spa::param::format::FormatProperties::VideoSize,
            Choice,
            Range,
            Rectangle,
            spa::utils::Rectangle {
                width: 1920,
                height: 1080
            },
            spa::utils::Rectangle {
                width: 1,
                height: 1
            },
            spa::utils::Rectangle {
                width: 8192,
                height: 8192
            }
        ),
        spa::pod::property!(
            spa::param::format::FormatProperties::VideoFramerate,
            Choice,
            Range,
            Fraction,
            spa::utils::Fraction {
                num: framerate,
                denom: 1
            },
            spa::utils::Fraction { num: 0, denom: 1 },
            spa::utils::Fraction {
                num: 1000,
                denom: 1
            }
        ),
    ))
}

fn buffers_param() -> Option<Vec<u8>> {
    let memory: i32 = (1 << spa::sys::SPA_DATA_MemFd) | (1 << spa::sys::SPA_DATA_MemPtr);
    serialize(Object {
        type_: spa::sys::SPA_TYPE_OBJECT_ParamBuffers,
        id: spa::sys::SPA_PARAM_Buffers,
        properties: vec![Property::new(
            spa::sys::SPA_PARAM_BUFFERS_dataType,
            Value::Choice(ChoiceValue::Int(Choice(
                ChoiceFlags::empty(),
                ChoiceEnum::Flags {
                    default: memory,
                    flags: Vec::new(),
                },
            ))),
        )],
    })
}

fn pixel_order(format: VideoFormat) -> Option<PixelOrder> {
    match format {
        VideoFormat::BGRx | VideoFormat::BGRA => Some(PixelOrder::Bgrx),
        VideoFormat::RGBx | VideoFormat::RGBA => Some(PixelOrder::Rgbx),
        _ => None,
    }
}

struct StreamState {
    encoder: Arc<Encoder>,
    format: Option<(PixelOrder, u32, u32)>,
    halted: bool,
}

fn run_pipewire(
    fd: OwnedFd,
    node: u32,
    framerate: u32,
    encoder: Arc<Encoder>,
    stop: pw::channel::Receiver<()>,
    ready: std::sync::mpsc::Sender<Result<(), String>>,
) {
    let fail = |message: String| {
        let _ = ready.send(Err(message));
    };

    let Ok(main_loop) = pw::main_loop::MainLoopRc::new(None) else {
        return fail("could not start PipeWire".to_string());
    };
    let Ok(context) = pw::context::ContextRc::new(&main_loop, None) else {
        return fail("could not open a PipeWire context".to_string());
    };
    let core = match context.connect_fd_rc(fd, None) {
        Ok(core) => core,
        Err(error) => return fail(format!("could not reach PipeWire: {error}")),
    };

    let stream = match pw::stream::StreamRc::new(
        core,
        "colibri-screen-share",
        pw::properties::properties! {
            *pw::keys::MEDIA_TYPE => "Video",
            *pw::keys::MEDIA_CATEGORY => "Capture",
            *pw::keys::MEDIA_ROLE => "Screen",
        },
    ) {
        Ok(stream) => stream,
        Err(error) => return fail(format!("could not create the video stream: {error}")),
    };

    let ending = main_loop.downgrade();
    let halting = main_loop.downgrade();
    let listener = stream
        .add_local_listener_with_user_data(StreamState {
            encoder,
            format: None,
            halted: false,
        })
        .state_changed(move |_, _, _, next| {
            if matches!(
                next,
                pw::stream::StreamState::Error(_) | pw::stream::StreamState::Unconnected
            ) {
                if let Some(main_loop) = ending.upgrade() {
                    main_loop.quit();
                }
            }
        })
        .param_changed(|stream, state, id, param| {
            let Some(param) = param else {
                return;
            };
            if id != spa::param::ParamType::Format.as_raw() {
                return;
            }
            let mut info = VideoInfoRaw::default();
            if info.parse(param).is_err() {
                return;
            }
            let size = info.size();
            state.format = pixel_order(info.format()).map(|order| (order, size.width, size.height));

            if let Some(bytes) = buffers_param() {
                if let Some(pod) = Pod::from_bytes(&bytes) {
                    let _ = stream.update_params(&mut [pod]);
                }
            }
        })
        .process(move |stream, state| {
            if state.halted {
                while stream.dequeue_buffer().is_some() {}
                return;
            }
            let Some((order, width, height)) = state.format else {
                while stream.dequeue_buffer().is_some() {}
                return;
            };
            let mut latest = None;
            while let Some(buffer) = stream.dequeue_buffer() {
                latest = Some(buffer);
            }
            let Some(mut buffer) = latest else {
                return;
            };
            if !state.encoder.due() {
                return;
            }
            let Some(data) = buffer.datas_mut().first_mut() else {
                return;
            };
            let chunk = data.chunk();
            let offset = chunk.offset() as usize;
            let size = chunk.size() as usize;
            let stride = chunk.stride();
            if size == 0 {
                return;
            }
            let stride = if stride > 0 {
                stride as usize
            } else {
                width as usize * 4
            };
            let Some(bytes) = data.data() else {
                return;
            };
            let Some(slice) = bytes.get(offset..offset.saturating_add(size).min(bytes.len()))
            else {
                return;
            };
            if !state.encoder.encode(&Frame {
                data: slice,
                width,
                height,
                stride,
                order,
            }) {
                state.halted = true;
                if let Some(main_loop) = halting.upgrade() {
                    main_loop.quit();
                }
            }
        })
        .register();

    let listener = match listener {
        Ok(listener) => listener,
        Err(error) => return fail(format!("could not listen to the video stream: {error}")),
    };

    let Some(format) = format_param(framerate) else {
        return fail("could not describe the video format".to_string());
    };
    let Some(format) = Pod::from_bytes(&format) else {
        return fail("could not describe the video format".to_string());
    };

    if let Err(error) = stream.connect(
        spa::utils::Direction::Input,
        Some(node),
        pw::stream::StreamFlags::AUTOCONNECT | pw::stream::StreamFlags::MAP_BUFFERS,
        &mut [format],
    ) {
        return fail(format!("could not connect the video stream: {error}"));
    }

    let quitting = main_loop.downgrade();
    let _stop = stop.attach(main_loop.loop_(), move |_| {
        if let Some(main_loop) = quitting.upgrade() {
            main_loop.quit();
        }
    });

    let _ = ready.send(Ok(()));
    main_loop.run();

    let _ = stream.disconnect();
    drop(listener);
}

pub struct Capture {
    stop: pw::channel::Sender<()>,
    worker: Option<JoinHandle<()>>,
    session: Option<tokio::sync::oneshot::Sender<()>>,
    audio: Arc<Mutex<Option<audio::Capture>>>,
}

impl Capture {
    pub fn stop(mut self) {
        let _ = self.stop.send(());
        if let Some(session) = self.session.take() {
            let _ = session.send(());
        }
        if let Some(worker) = self.worker.take() {
            let _ = worker.join();
        }
        if let Ok(mut audio) = self.audio.lock() {
            if let Some(audio) = audio.take() {
                audio.stop();
            }
        }
    }
}

fn keep_session_open(portal: Portal, closed: tokio::sync::oneshot::Receiver<()>) {
    tauri::async_runtime::spawn(async move {
        let revoked = async {
            match portal.session.receive_closed().await {
                Ok(signal) => {
                    let mut signal = std::pin::pin!(signal);
                    signal.next().await;
                }
                Err(_) => std::future::pending::<()>().await,
            }
        };
        tokio::select! {
            _ = closed => {}
            _ = revoked => {}
        }
        let _ = portal.session.close().await;
    });
}

pub async fn start(
    source: &SourceId,
    options: StartOptions,
    sender: FrameSender,
) -> Result<Capture, NativeError> {
    if source.native != PORTAL_SOURCE {
        return Err(NativeError::invalid_request(
            "pick what to share through the system dialog",
        ));
    }

    let Picked { portal, node, fd } = pick(source.kind).await?;

    let audio = Arc::new(Mutex::new(start_audio(
        &options,
        source.kind,
        None,
        &sender,
    )));

    let encoder = Arc::new(Encoder::new(options.quality, sender));
    let (stop, stop_receiver) = pw::channel::channel::<()>();
    let (ready, started) = std::sync::mpsc::channel::<Result<(), String>>();
    let framerate = options.quality.framerate;
    let ended_audio = audio.clone();

    let worker = std::thread::Builder::new()
        .name("colibri-capture-pipewire".to_string())
        .spawn(move || {
            run_pipewire(fd, node, framerate, encoder, stop_receiver, ready);
            if let Ok(mut audio) = ended_audio.lock() {
                if let Some(audio) = audio.take() {
                    audio.stop();
                }
            }
        });

    let worker = match worker {
        Ok(worker) => worker,
        Err(error) => {
            let _ = portal.session.close().await;
            if let Ok(mut audio) = audio.lock() {
                if let Some(audio) = audio.take() {
                    audio.stop();
                }
            }
            return Err(NativeError::failed(format!(
                "could not start the video stream: {error}"
            )));
        }
    };

    let outcome = tauri::async_runtime::spawn_blocking(move || {
        started.recv_timeout(std::time::Duration::from_secs(
            PIPEWIRE_START_TIMEOUT_SECONDS,
        ))
    })
    .await;

    let (closed_sender, closed) = tokio::sync::oneshot::channel();
    let capture = Capture {
        stop,
        worker: Some(worker),
        session: Some(closed_sender),
        audio,
    };

    match outcome {
        Ok(Ok(Ok(()))) => {
            keep_session_open(portal, closed);
            Ok(capture)
        }
        Ok(Ok(Err(message))) => {
            let _ = portal.session.close().await;
            capture.stop();
            Err(NativeError::failed(message))
        }
        _ => {
            let _ = portal.session.close().await;
            capture.stop();
            Err(NativeError::failed("the video stream never started"))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_portal_offers_one_screen_and_one_window_entry() {
        let listed = sources();
        assert_eq!(listed.len(), 2);
        assert!(
            listed
                .iter()
                .all(|source| SourceId::parse(&source.id)
                    .is_some_and(|id| id.native == PORTAL_SOURCE))
        );
    }
}
