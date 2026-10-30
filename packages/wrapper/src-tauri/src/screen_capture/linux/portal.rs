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
}

fn variant<'v, 'a>(value: &'v Variant<'a>) -> &'v Variant<'a> {
    match value {
        Variant::Value(inner) => variant(inner),
        other => other,
    }
}

type StartResults = HashMap<String, OwnedValue>;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct PortalStream {
    node: u32,
    source_type: Option<u32>,
    size: Option<(i32, i32)>,
    position: Option<(i32, i32)>,
}

impl std::fmt::Display for PortalStream {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let shown = |pair: Option<(i32, i32)>, separator: char| match pair {
            Some((first, second)) => format!("{first}{separator}{second}"),
            None => "unknown".to_string(),
        };
        let source_type = self
            .source_type
            .map_or_else(|| "unknown".to_string(), |kind| kind.to_string());
        write!(
            formatter,
            "node {} source_type {} size {} position {}",
            self.node,
            source_type,
            shown(self.size, 'x'),
            shown(self.position, ',')
        )
    }
}

fn int_pair(value: &Variant) -> Option<(i32, i32)> {
    let Variant::Structure(pair) = variant(value) else {
        return None;
    };
    match pair.fields() {
        [first, second] => match (variant(first), variant(second)) {
            (Variant::I32(first), Variant::I32(second)) => Some((*first, *second)),
            _ => None,
        },
        _ => None,
    }
}

fn portal_stream(stream: &Variant) -> Option<PortalStream> {
    let Variant::Structure(stream) = variant(stream) else {
        return None;
    };
    let [node, properties] = stream.fields() else {
        return None;
    };
    let Variant::U32(node) = variant(node) else {
        return None;
    };
    let mut parsed = PortalStream {
        node: *node,
        source_type: None,
        size: None,
        position: None,
    };
    if let Variant::Dict(properties) = variant(properties) {
        for (key, value) in properties.iter() {
            let Variant::Str(key) = variant(key) else {
                continue;
            };
            match (key.as_str(), variant(value)) {
                ("source_type", Variant::U32(kind)) => parsed.source_type = Some(*kind),
                ("size", value) => parsed.size = int_pair(value),
                ("position", value) => parsed.position = int_pair(value),
                _ => {}
            }
        }
    }
    Some(parsed)
}

fn portal_streams(results: &StartResults) -> Vec<PortalStream> {
    let Some(Variant::Array(streams)) = results.get("streams").map(|value| variant(value)) else {
        return Vec::new();
    };
    streams.inner().iter().filter_map(portal_stream).collect()
}

fn log_start_results(results: &StartResults, streams: &[PortalStream]) {
    let mut keys: Vec<&str> = results.keys().map(String::as_str).collect();
    keys.sort_unstable();
    eprintln!(
        "screen share portal started: {} stream(s), result keys [{}]",
        streams.len(),
        keys.join(", ")
    );
    for (index, stream) in streams.iter().enumerate() {
        eprintln!("screen share portal stream {index}: {stream}");
    }
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
                .set_persist_mode(PersistMode::DoNot),
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

    let streams = portal_streams(&results);
    log_start_results(&results, &streams);
    let Some(stream) = streams.first().copied() else {
        let _ = portal.session.close().await;
        return Err(cancelled());
    };
    let node = stream.node;
    let shared = shared_kind(stream.source_type, kind);

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
    connected: std::time::Instant,
    first_frame_seen: bool,
    unmapped_seen: bool,
}

impl StreamState {
    fn note_frame(&mut self) {
        if !self.first_frame_seen {
            self.first_frame_seen = true;
            eprintln!(
                "screen share video: first frame after {} ms",
                self.connected.elapsed().as_millis()
            );
        }
    }

    fn note_unmapped(&mut self, kind: spa::buffer::DataType) {
        if !self.unmapped_seen {
            self.unmapped_seen = true;
            eprintln!("screen share video: a buffer has no mapped memory ({kind:?})");
        }
    }
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
            connected: std::time::Instant::now(),
            first_frame_seen: false,
            unmapped_seen: false,
        })
        .state_changed(move |_, _, _, next| {
            eprintln!("screen share video stream: {next:?}");
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
            let framerate = info.framerate();
            eprintln!(
                "screen share video format: {:?} {}x{} at {}/{} fps, modifier {}",
                info.format(),
                size.width,
                size.height,
                framerate.num,
                framerate.denom,
                info.modifier()
            );
            state.format = pixel_order(info.format()).map(|order| (order, size.width, size.height));
            if state.format.is_none() {
                eprintln!("screen share video format is not one Colibri can encode");
            }

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
            let kind = data.type_();
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
                state.note_unmapped(kind);
                return;
            };
            let Some(slice) = bytes.get(offset..offset.saturating_add(size).min(bytes.len()))
            else {
                return;
            };
            state.note_frame();
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

#[derive(Default)]
struct AudioSlot {
    stopped: bool,
    capture: Option<audio::Capture>,
}

type SharedAudio = Arc<Mutex<AudioSlot>>;

fn stop_audio(slot: &SharedAudio) {
    let capture = match slot.lock() {
        Ok(mut slot) => {
            slot.stopped = true;
            slot.capture.take()
        }
        Err(_) => None,
    };
    if let Some(capture) = capture {
        capture.stop();
    }
}

fn store_audio(slot: &SharedAudio, capture: audio::Capture) {
    let rejected = match slot.lock() {
        Ok(mut slot) if !slot.stopped => {
            slot.capture = Some(capture);
            None
        }
        _ => Some(capture),
    };
    if let Some(capture) = rejected {
        capture.stop();
    }
}

fn audio_stopped(slot: &SharedAudio) -> bool {
    slot.lock().map_or(true, |slot| slot.stopped)
}

fn spawn_audio(
    options: StartOptions,
    shared: audio::Shared,
    sender: FrameSender,
    slot: SharedAudio,
) {
    if !options.capture_audio {
        return;
    }
    let spawned = std::thread::Builder::new()
        .name("colibri-capture-audio-start".to_string())
        .spawn(move || {
            if audio_stopped(&slot) {
                return;
            }
            if let Some(capture) = start_audio(&options, &shared, &sender) {
                store_audio(&slot, capture);
            }
        });
    if let Err(error) = spawned {
        eprintln!("screen share audio failed: could not start its thread: {error}");
    }
}

pub struct Capture {
    stop: pw::channel::Sender<()>,
    worker: Option<JoinHandle<()>>,
    session: Option<tokio::sync::oneshot::Sender<()>>,
    audio: SharedAudio,
}

impl Capture {
    pub fn stop(mut self) {
        stop_audio(&self.audio);
        let _ = self.stop.send(());
        if let Some(session) = self.session.take() {
            let _ = session.send(());
        }
        if let Some(worker) = self.worker.take() {
            let _ = worker.join();
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
    } = pick(source.kind).await?;

    let audio = SharedAudio::default();
    let audio_sender = sender.clone();
    let encoder = Arc::new(Encoder::new(options.quality, sender));
    let (stop, stop_receiver) = pw::channel::channel::<()>();
    let (ready, started) = std::sync::mpsc::channel::<Result<(), String>>();
    let framerate = options.quality.framerate;
    let ended_audio = audio.clone();

    let worker = std::thread::Builder::new()
        .name("colibri-capture-pipewire".to_string())
        .spawn(move || {
            run_pipewire(fd, node, framerate, encoder, stop_receiver, ready);
            stop_audio(&ended_audio);
        });

    let worker = match worker {
        Ok(worker) => worker,
        Err(error) => {
            let _ = portal.session.close().await;
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
        audio: audio.clone(),
    };

    match outcome {
        Ok(Ok(Ok(()))) => {
            keep_session_open(portal, closed);
            spawn_audio(
                options,
                audio::Shared {
                    requested: source.kind,
                    kind: shared,
                    window_process: None,
                },
                audio_sender,
                audio,
            );
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

    fn stream_with(node: u32, kind: Option<u32>, position: Option<(i32, i32)>) -> Variant<'static> {
        let mut properties: HashMap<String, Variant<'static>> = HashMap::new();
        properties.insert(
            "size".to_string(),
            Variant::Value(Box::new(Variant::from((1920i32, 1080i32)))),
        );
        if let Some(kind) = kind {
            properties.insert(
                "source_type".to_string(),
                Variant::Value(Box::new(Variant::U32(kind))),
            );
        }
        if let Some(position) = position {
            properties.insert(
                "position".to_string(),
                Variant::Value(Box::new(Variant::from(position))),
            );
        }
        properties.insert(
            "id".to_string(),
            Variant::Value(Box::new(Variant::from("0".to_string()))),
        );
        structure(vec![Variant::U32(node), Variant::from(properties)])
    }

    fn results_with(streams: Vec<Variant<'static>>) -> StartResults {
        let mut results = StartResults::new();
        results.insert(
            "streams".to_string(),
            owned(Variant::Value(Box::new(Variant::Array(streams.into())))),
        );
        results
    }

    #[test]
    fn the_first_stream_gives_its_node_and_properties() {
        let results = results_with(vec![
            stream_with(57, Some(PORTAL_WINDOW), Some((0, 0))),
            stream_with(58, Some(PORTAL_MONITOR), None),
        ]);
        let streams = portal_streams(&results);
        assert_eq!(streams.len(), 2);
        assert_eq!(
            streams[0],
            PortalStream {
                node: 57,
                source_type: Some(PORTAL_WINDOW),
                size: Some((1920, 1080)),
                position: Some((0, 0)),
            }
        );
        assert_eq!(
            streams[0].to_string(),
            "node 57 source_type 2 size 1920x1080 position 0,0"
        );
    }

    #[test]
    fn optional_stream_properties_may_be_missing() {
        let streams = portal_streams(&results_with(vec![stream_with(12, None, None)]));
        assert_eq!(
            streams,
            vec![PortalStream {
                node: 12,
                source_type: None,
                size: Some((1920, 1080)),
                position: None,
            }]
        );
        assert_eq!(
            streams[0].to_string(),
            "node 12 source_type unknown size 1920x1080 position unknown"
        );
    }

    #[test]
    fn a_stream_with_empty_properties_still_gives_its_node() {
        let empty: HashMap<String, Variant<'static>> = HashMap::new();
        let stream = structure(vec![Variant::U32(9), Variant::from(empty)]);
        assert_eq!(
            portal_streams(&results_with(vec![stream])),
            vec![PortalStream {
                node: 9,
                source_type: None,
                size: None,
                position: None,
            }]
        );
    }

    #[test]
    fn no_streams_means_nothing_was_shared() {
        assert!(portal_streams(&StartResults::new()).is_empty());
        assert!(portal_streams(&results_with(Vec::new())).is_empty());
    }

    #[test]
    fn a_stopped_audio_slot_rejects_a_late_capture() {
        let slot = SharedAudio::default();
        assert!(!audio_stopped(&slot));
        stop_audio(&slot);
        assert!(audio_stopped(&slot));
        store_audio(&slot, audio::Capture::idle());
        assert!(slot.lock().expect("locks").capture.is_none());
    }

    #[test]
    fn a_running_audio_slot_keeps_its_capture_until_stopped() {
        let slot = SharedAudio::default();
        store_audio(&slot, audio::Capture::idle());
        assert!(slot.lock().expect("locks").capture.is_some());
        stop_audio(&slot);
        assert!(slot.lock().expect("locks").capture.is_none());
    }
}
