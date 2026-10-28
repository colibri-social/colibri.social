use std::collections::HashMap;
use std::os::fd::OwnedFd;
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;

use ashpd::desktop::screencast::{CursorMode, Screencast, SelectSourcesOptions, SourceType};
use ashpd::desktop::{PersistMode, ResponseError};
use ashpd::zvariant::{OwnedValue, Value as Variant};
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
const PORTAL_DESTINATION: &str = "org.freedesktop.portal.Desktop";
const REQUEST_PATH: &str = "/org/freedesktop/portal/desktop/request";
const REQUEST_INTERFACE: &str = "org.freedesktop.portal.Request";
const RESPONSE_SIGNAL: &str = "Response";
const START_METHOD: &str = "Start";
const RESPONSE_SUCCESS: u32 = 0;
const RESPONSE_CANCELLED: u32 = 1;
const PORTAL_MONITOR: u32 = 1;
const PORTAL_WINDOW: u32 = 2;
const PORTAL_VIRTUAL: u32 = 4;
const GNOME_RESTORE_VENDOR: &str = "GNOME";
const KDE_RESTORE_VENDOR: &str = "KDE";
const GNOME_WINDOW_SOURCE: u32 = 2;
const KDE_WINDOW_LIST_TYPE: &[u8] = b"WindowRestoreInfo>\0";
const QT_NULL_STRING: u32 = u32::MAX;
const MOST_RESTORED_WINDOWS: u32 = 64;

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
    shared: SourceKind,
    window_app: Option<String>,
}

fn variant<'v, 'a>(value: &'v Variant<'a>) -> &'v Variant<'a> {
    match value {
        Variant::Value(inner) => variant(inner),
        other => other,
    }
}

fn gnome_stream_app(stream: &Variant) -> Option<String> {
    let Variant::Structure(stream) = variant(stream) else {
        return None;
    };
    let [_, kind, window] = stream.fields() else {
        return None;
    };
    if !matches!(variant(kind), Variant::U32(GNOME_WINDOW_SOURCE)) {
        return None;
    }
    let Variant::Structure(window) = variant(window) else {
        return None;
    };
    match window.fields() {
        [app, _] => match variant(app) {
            Variant::Str(app) => audio::desktop_id(app.as_str()),
            _ => None,
        },
        _ => None,
    }
}

fn gnome_window_app(payload: &Variant) -> Option<String> {
    let Variant::Structure(payload) = variant(payload) else {
        return None;
    };
    payload
        .fields()
        .iter()
        .find_map(|field| match variant(field) {
            Variant::Array(streams) => streams.inner().iter().find_map(gnome_stream_app),
            _ => None,
        })
}

struct QtStream<'a> {
    bytes: &'a [u8],
}

impl QtStream<'_> {
    fn number(&mut self) -> Option<u32> {
        let (head, rest) = self.bytes.split_first_chunk::<4>()?;
        self.bytes = rest;
        Some(u32::from_be_bytes(*head))
    }

    fn string(&mut self) -> Option<String> {
        let length = self.number()?;
        if length == QT_NULL_STRING {
            return Some(String::new());
        }
        let length = usize::try_from(length).ok()?;
        if length % 2 != 0 || length > self.bytes.len() {
            return None;
        }
        let (text, rest) = self.bytes.split_at(length);
        self.bytes = rest;
        let units: Vec<u16> = text
            .chunks_exact(2)
            .map(|pair| u16::from_be_bytes([pair[0], pair[1]]))
            .collect();
        String::from_utf16(&units).ok()
    }
}

fn kde_window_app_in(bytes: &[u8]) -> Option<String> {
    let start = bytes
        .windows(KDE_WINDOW_LIST_TYPE.len())
        .position(|window| window == KDE_WINDOW_LIST_TYPE)?
        + KDE_WINDOW_LIST_TYPE.len();
    let mut stream = QtStream {
        bytes: &bytes[start..],
    };
    let count = stream.number()?;
    if count == 0 || count > MOST_RESTORED_WINDOWS {
        return None;
    }
    let app = stream.string()?;
    stream.string()?;
    audio::desktop_id(&app)
}

fn kde_window_app(payload: &Variant) -> Option<String> {
    let Variant::Array(bytes) = variant(payload) else {
        return None;
    };
    let bytes: Vec<u8> = bytes
        .inner()
        .iter()
        .map(|byte| match byte {
            Variant::U8(byte) => Some(*byte),
            _ => None,
        })
        .collect::<Option<_>>()?;
    kde_window_app_in(&bytes)
}

fn window_app(vendor: &str, payload: &Variant) -> Option<String> {
    match vendor {
        GNOME_RESTORE_VENDOR => gnome_window_app(payload),
        KDE_RESTORE_VENDOR => kde_window_app(payload),
        _ => None,
    }
}

type StartResults = HashMap<String, OwnedValue>;

fn first_stream(results: &StartResults) -> Option<(u32, Option<u32>)> {
    let Variant::Array(streams) = variant(results.get("streams")?) else {
        return None;
    };
    let Variant::Structure(stream) = variant(streams.inner().first()?) else {
        return None;
    };
    let [node, properties] = stream.fields() else {
        return None;
    };
    let Variant::U32(node) = variant(node) else {
        return None;
    };
    let reported = match variant(properties) {
        Variant::Dict(properties) => {
            properties
                .iter()
                .find_map(|(key, value)| match (variant(key), variant(value)) {
                    (Variant::Str(key), Variant::U32(kind)) if key.as_str() == "source_type" => {
                        Some(*kind)
                    }
                    _ => None,
                })
        }
        _ => None,
    };
    Some((*node, reported))
}

fn restored_window_app(results: &StartResults) -> Option<String> {
    let Variant::Structure(data) = variant(results.get("restore_data")?) else {
        return None;
    };
    let [vendor, _, payload] = data.fields() else {
        return None;
    };
    let Variant::Str(vendor) = variant(vendor) else {
        return None;
    };
    window_app(vendor.as_str(), payload)
}

fn handle_token() -> String {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|elapsed| elapsed.as_nanos())
        .unwrap_or_default();
    format!("colibri_{}_{nanos}", std::process::id())
}

fn bus_error(error: ashpd::zbus::Error) -> NativeError {
    NativeError::failed(format!("the screen sharing portal failed: {error}"))
}

async fn start_cast(portal: &Portal) -> Result<StartResults, NativeError> {
    let connection = portal.proxy.connection().clone();
    let token = handle_token();
    let sender = connection
        .unique_name()
        .map(|name| name.as_str().trim_start_matches(':').replace('.', "_"))
        .ok_or_else(|| NativeError::failed("the screen sharing portal has no connection"))?;
    let path = format!("{REQUEST_PATH}/{sender}/{token}");
    let request = ashpd::zbus::Proxy::new(
        &connection,
        PORTAL_DESTINATION,
        path.as_str(),
        REQUEST_INTERFACE,
    )
    .await
    .map_err(bus_error)?;
    let mut responses = request
        .receive_signal(RESPONSE_SIGNAL)
        .await
        .map_err(bus_error)?;

    let options: HashMap<&str, Variant> = HashMap::from([("handle_token", Variant::from(token))]);
    portal
        .proxy
        .call_method(START_METHOD, &(&portal.session, "", options))
        .await
        .map_err(bus_error)?;

    let message = responses.next().await.ok_or_else(cancelled)?;
    let (code, results): (u32, StartResults) = message.body().deserialize().map_err(bus_error)?;
    match code {
        RESPONSE_SUCCESS => Ok(results),
        RESPONSE_CANCELLED => Err(cancelled()),
        _ => Err(NativeError::failed(
            "the screen sharing portal could not start",
        )),
    }
}

fn shared_kind(reported: Option<u32>, requested: SourceKind) -> SourceKind {
    match reported {
        Some(PORTAL_MONITOR | PORTAL_VIRTUAL) => SourceKind::Display,
        Some(PORTAL_WINDOW) => SourceKind::Window,
        _ => requested,
    }
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
                .set_persist_mode(PersistMode::Application),
        )
        .await;

    let portal = Portal { proxy, session };
    if let Err(error) = selection.and_then(|request| request.response()) {
        let _ = portal.session.close().await;
        return Err(portal_error(error));
    }

    let results = match start_cast(&portal).await {
        Ok(results) => results,
        Err(error) => {
            let _ = portal.session.close().await;
            return Err(error);
        }
    };

    let Some((node, reported)) = first_stream(&results) else {
        let _ = portal.session.close().await;
        return Err(cancelled());
    };
    let shared = shared_kind(reported, kind);
    let window_app = match shared {
        SourceKind::Display => None,
        SourceKind::Window | SourceKind::Application => restored_window_app(&results),
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

    Ok(Picked {
        portal,
        node,
        fd,
        shared,
        window_app,
    })
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

    pw::init();
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

    let Picked {
        portal,
        node,
        fd,
        shared,
        window_app,
    } = pick(source.kind).await?;

    let audio = Arc::new(Mutex::new(start_audio(
        &options,
        &audio::Shared {
            requested: source.kind,
            kind: shared,
            window_process: None,
            window_app,
        },
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

    #[test]
    fn a_handle_token_is_a_valid_object_path_element() {
        let token = handle_token();
        assert!(!token.is_empty());
        assert!(token.chars().all(|c| c.is_ascii_alphanumeric() || c == '_'));
    }

    #[test]
    fn the_shared_kind_follows_what_the_portal_reports() {
        assert_eq!(
            shared_kind(Some(PORTAL_WINDOW), SourceKind::Display),
            SourceKind::Window
        );
        assert_eq!(
            shared_kind(Some(PORTAL_MONITOR), SourceKind::Window),
            SourceKind::Display
        );
        assert_eq!(
            shared_kind(Some(PORTAL_VIRTUAL), SourceKind::Window),
            SourceKind::Display
        );
    }

    #[test]
    fn an_unknown_reported_kind_falls_back_to_the_requested_one() {
        assert_eq!(shared_kind(None, SourceKind::Display), SourceKind::Display);
        assert_eq!(shared_kind(None, SourceKind::Window), SourceKind::Window);
        assert_eq!(shared_kind(Some(9), SourceKind::Window), SourceKind::Window);
    }

    fn owned(value: Variant<'static>) -> OwnedValue {
        value.try_to_owned().expect("owns")
    }

    fn structure(fields: Vec<Variant<'static>>) -> Variant<'static> {
        let builder = fields.into_iter().fold(
            ashpd::zvariant::StructureBuilder::new(),
            |builder, field| builder.append_field(field),
        );
        Variant::Structure(builder.build().expect("builds"))
    }

    fn stream_with(node: u32, kind: Option<u32>) -> Variant<'static> {
        let mut properties: HashMap<String, Variant<'static>> = HashMap::new();
        properties.insert("size".to_string(), Variant::from((1920i32, 1080i32)));
        if let Some(kind) = kind {
            properties.insert("source_type".to_string(), Variant::U32(kind));
        }
        structure(vec![Variant::U32(node), Variant::from(properties)])
    }

    #[test]
    fn the_first_stream_gives_its_node_and_reported_kind() {
        let mut results = StartResults::new();
        results.insert(
            "streams".to_string(),
            owned(Variant::Array(
                vec![stream_with(57, Some(PORTAL_WINDOW))].into(),
            )),
        );
        assert_eq!(first_stream(&results), Some((57, Some(PORTAL_WINDOW))));

        results.insert(
            "streams".to_string(),
            owned(Variant::Array(vec![stream_with(12, None)].into())),
        );
        assert_eq!(first_stream(&results), Some((12, None)));
    }

    #[test]
    fn no_streams_means_nothing_was_shared() {
        assert_eq!(first_stream(&StartResults::new()), None);
        let mut results = StartResults::new();
        results.insert(
            "streams".to_string(),
            owned(Variant::Array(Vec::<Variant<'static>>::new().into())),
        );
        assert_eq!(first_stream(&results), None);
    }

    #[test]
    fn restore_data_names_the_shared_window_app() {
        let mut results = StartResults::new();
        assert_eq!(restored_window_app(&results), None);
        results.insert(
            "restore_data".to_string(),
            owned(structure(vec![
                Variant::from("GNOME".to_string()),
                Variant::U32(1),
                Variant::Value(Box::new(gnome_payload(vec![gnome_stream(
                    2,
                    "org.gnome.Totem.desktop",
                )]))),
            ])),
        );
        assert_eq!(
            restored_window_app(&results).as_deref(),
            Some("org.gnome.Totem")
        );
    }

    fn qt_string(text: &str) -> Vec<u8> {
        let units: Vec<u8> = text.encode_utf16().flat_map(u16::to_be_bytes).collect();
        let mut bytes = (units.len() as u32).to_be_bytes().to_vec();
        bytes.extend(units);
        bytes
    }

    fn kde_payload(windows: &[(&str, &str)]) -> Vec<u8> {
        let mut bytes = 3u32.to_be_bytes().to_vec();
        bytes.extend(qt_string("outputs"));
        bytes.extend([0, 0, 0, 9, 0]);
        bytes.extend(0u32.to_be_bytes());
        bytes.extend(qt_string("windows"));
        bytes.extend(65536u32.to_be_bytes());
        bytes.push(0);
        let name = b"QList<WindowRestoreInfo>\0";
        bytes.extend((name.len() as u32).to_be_bytes());
        bytes.extend(name);
        bytes.extend((windows.len() as u32).to_be_bytes());
        for (app, title) in windows {
            bytes.extend(qt_string(app));
            bytes.extend(qt_string(title));
        }
        bytes
    }

    fn gnome_payload(streams: Vec<Variant<'static>>) -> Variant<'static> {
        Variant::Structure(
            ashpd::zvariant::StructureBuilder::new()
                .append_field(Variant::I64(1))
                .append_field(Variant::I64(2))
                .append_field(Variant::Array(streams.into()))
                .build()
                .expect("builds"),
        )
    }

    fn gnome_stream(kind: u32, app: &str) -> Variant<'static> {
        let window = Variant::Structure(
            ashpd::zvariant::StructureBuilder::new()
                .append_field(Variant::from(app.to_string()))
                .append_field(Variant::from("A title".to_string()))
                .build()
                .expect("builds"),
        );
        Variant::Structure(
            ashpd::zvariant::StructureBuilder::new()
                .append_field(Variant::U32(0))
                .append_field(Variant::U32(kind))
                .append_field(Variant::Value(Box::new(window)))
                .build()
                .expect("builds"),
        )
    }

    #[test]
    fn a_gnome_window_names_its_app() {
        let payload = gnome_payload(vec![gnome_stream(2, "org.mozilla.firefox.desktop")]);
        assert_eq!(
            window_app("GNOME", &payload).as_deref(),
            Some("org.mozilla.firefox")
        );
    }

    #[test]
    fn a_gnome_monitor_or_unknown_window_names_no_app() {
        let monitor = gnome_payload(vec![gnome_stream(1, "org.mozilla.firefox.desktop")]);
        assert_eq!(window_app("GNOME", &monitor), None);
        let unknown = gnome_payload(vec![gnome_stream(2, "window:42")]);
        assert_eq!(window_app("GNOME", &unknown), None);
        let empty = gnome_payload(vec![gnome_stream(2, "")]);
        assert_eq!(window_app("GNOME", &empty), None);
    }

    #[test]
    fn a_kde_window_names_its_app() {
        let bytes = kde_payload(&[("org.kde.dolphin", "Home")]);
        let payload = Variant::Array(bytes.into());
        assert_eq!(
            window_app("KDE", &payload).as_deref(),
            Some("org.kde.dolphin")
        );
    }

    #[test]
    fn a_kde_payload_without_windows_names_no_app() {
        assert_eq!(kde_window_app_in(&kde_payload(&[])), None);
        assert_eq!(kde_window_app_in(&qt_string("windows")), None);
        let mut truncated = kde_payload(&[("org.kde.dolphin", "Home")]);
        truncated.truncate(truncated.len() - 6);
        assert_eq!(kde_window_app_in(&truncated), None);
    }

    #[test]
    fn an_unknown_vendor_names_no_app() {
        let payload = gnome_payload(vec![gnome_stream(2, "org.mozilla.firefox")]);
        assert_eq!(window_app("COSMIC", &payload), None);
        assert_eq!(window_app("KDE", &payload), None);
    }
}
