use std::collections::HashMap;
use std::fs::File;
use std::os::fd::OwnedFd;
use std::os::unix::fs::FileExt;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

use x11rb::connection::Connection;
use x11rb::cookie::Cookie;
use x11rb::errors::ConnectionError;
use x11rb::protocol::composite::{ConnectionExt as _, Redirect};
use x11rb::protocol::randr::ConnectionExt as _;
use x11rb::protocol::shm::ConnectionExt as _;
use x11rb::protocol::xfixes::ConnectionExt as _;
use x11rb::protocol::xproto::{
    AtomEnum, ConnectionExt as _, ImageFormat, ImageOrder, MapState, Window,
};
use x11rb::rust_connection::RustConnection;
use x11rb::x11_utils::TryParse;

use super::encoder::{scale_rgb, Encoder, Frame, PixelOrder};
use super::{audio, start_audio, StartOptions};
use crate::native_error::NativeError;
use crate::screen_capture::{CaptureSource, SourceId, SourceKind};

const THUMBNAIL_LONG_EDGE: u32 = 400;
const MAX_THUMBNAILS: usize = 48;
const MIN_WINDOW_EDGE: u32 = 48;
const BYTES_PER_PIXEL: usize = 4;
const LARGEST_ICON_EDGE: u32 = 256;

x11rb::atom_manager! {
    Atoms: AtomsCookie {
        _NET_CLIENT_LIST,
        _NET_CLIENT_LIST_STACKING,
        _NET_WM_NAME,
        _NET_WM_PID,
        _NET_WM_ICON,
        _NET_WM_STATE,
        _NET_WM_STATE_SKIP_TASKBAR,
        _NET_WM_WINDOW_TYPE,
        _NET_WM_WINDOW_TYPE_NORMAL,
        _NET_WM_WINDOW_TYPE_DIALOG,
        UTF8_STRING,
    }
}

fn reply<R: TryParse>(cookie: Result<Cookie<'_, RustConnection, R>, ConnectionError>) -> Option<R> {
    cookie.ok()?.reply().ok()
}

struct Display {
    connection: RustConnection,
    root: Window,
    atoms: Atoms,
}

fn open() -> Result<Display, NativeError> {
    let (connection, screen) = x11rb::connect(None)
        .map_err(|error| NativeError::failed(format!("could not reach the X server: {error}")))?;
    let setup = connection.setup();
    let root = setup
        .roots
        .get(screen)
        .ok_or_else(|| NativeError::failed("the X server has no screen"))?
        .root;

    if setup.image_byte_order != ImageOrder::LSB_FIRST
        || !setup
            .pixmap_formats
            .iter()
            .any(|format| format.depth == 24 && format.bits_per_pixel == 32)
    {
        return Err(NativeError::failed(
            "this display uses a pixel format Colibri can't share",
        ));
    }

    let atoms = Atoms::new(&connection)
        .ok()
        .and_then(|cookie| cookie.reply().ok())
        .ok_or_else(|| NativeError::failed("could not read window properties"))?;

    let _ = reply(connection.composite_query_version(0, 4));
    let _ = reply(connection.xfixes_query_version(4, 0));
    let _ = reply(connection.randr_query_version(1, 5));

    Ok(Display {
        connection,
        root,
        atoms,
    })
}

impl Display {
    fn property(&self, window: Window, atom: u32, kind: impl Into<u32>) -> Option<Vec<u8>> {
        let value =
            reply(
                self.connection
                    .get_property(false, window, atom, kind.into(), 0, u32::MAX / 4),
            )?;
        if value.value.is_empty() {
            None
        } else {
            Some(value.value)
        }
    }

    fn property32(&self, window: Window, atom: u32, kind: impl Into<u32>) -> Vec<u32> {
        reply(
            self.connection
                .get_property(false, window, atom, kind.into(), 0, u32::MAX / 4),
        )
        .and_then(|value| value.value32().map(Iterator::collect))
        .unwrap_or_default()
    }

    fn title(&self, window: Window) -> String {
        self.property(window, self.atoms._NET_WM_NAME, self.atoms.UTF8_STRING)
            .or_else(|| self.property(window, AtomEnum::WM_NAME.into(), AtomEnum::STRING))
            .map(|bytes| String::from_utf8_lossy(&bytes).trim().to_string())
            .unwrap_or_default()
    }

    fn class(&self, window: Window) -> Option<String> {
        let bytes = self.property(window, AtomEnum::WM_CLASS.into(), AtomEnum::STRING)?;
        let parts: Vec<String> = bytes
            .split(|byte| *byte == 0)
            .filter(|part| !part.is_empty())
            .map(|part| String::from_utf8_lossy(part).to_string())
            .collect();
        parts.get(1).or_else(|| parts.first()).cloned()
    }

    fn process(&self, window: Window) -> Option<u32> {
        self.property32(window, self.atoms._NET_WM_PID, AtomEnum::CARDINAL)
            .first()
            .copied()
            .filter(|pid| *pid > 0)
    }

    fn shown_in_taskbar(&self, window: Window) -> bool {
        let types = self.property32(window, self.atoms._NET_WM_WINDOW_TYPE, AtomEnum::ATOM);
        let normal = types.is_empty()
            || types.iter().any(|kind| {
                *kind == self.atoms._NET_WM_WINDOW_TYPE_NORMAL
                    || *kind == self.atoms._NET_WM_WINDOW_TYPE_DIALOG
            });
        let skipped = self
            .property32(window, self.atoms._NET_WM_STATE, AtomEnum::ATOM)
            .contains(&self.atoms._NET_WM_STATE_SKIP_TASKBAR);
        normal && !skipped
    }

    fn icon(&self, window: Window) -> Option<(u32, u32, Vec<u32>)> {
        let values = self.property32(window, self.atoms._NET_WM_ICON, AtomEnum::CARDINAL);
        largest_icon(&values)
    }

    fn client_windows(&self) -> Vec<Window> {
        let stacking = self.property32(
            self.root,
            self.atoms._NET_CLIENT_LIST_STACKING,
            AtomEnum::WINDOW,
        );
        if !stacking.is_empty() {
            return stacking.into_iter().rev().collect();
        }
        self.property32(self.root, self.atoms._NET_CLIENT_LIST, AtomEnum::WINDOW)
    }

    fn viewable(&self, window: Window) -> bool {
        reply(self.connection.get_window_attributes(window))
            .is_some_and(|attributes| attributes.map_state == MapState::VIEWABLE)
    }
}

fn largest_icon(values: &[u32]) -> Option<(u32, u32, Vec<u32>)> {
    let mut best: Option<(u32, u32, &[u32])> = None;
    let mut index = 0usize;

    while index + 2 <= values.len() {
        let width = values[index];
        let height = values[index + 1];
        let count = width as usize * height as usize;
        let start = index + 2;
        let Some(pixels) = values.get(start..start + count) else {
            break;
        };
        index = start + count;
        if width == 0 || height == 0 {
            continue;
        }

        let better = match best {
            None => true,
            Some((best_width, _, _)) => {
                match (width <= LARGEST_ICON_EDGE, best_width <= LARGEST_ICON_EDGE) {
                    (true, false) => true,
                    (false, true) => false,
                    (true, true) => width > best_width,
                    (false, false) => width < best_width,
                }
            }
        };
        if better {
            best = Some((width, height, pixels));
        }
    }

    best.map(|(width, height, pixels)| (width, height, pixels.to_vec()))
}

#[derive(Debug, Clone)]
struct Monitor {
    name: u32,
    x: i16,
    y: i16,
    width: u16,
    height: u16,
    primary: bool,
}

fn monitors(display: &Display) -> Vec<Monitor> {
    let listed: Vec<Monitor> = reply(display.connection.randr_get_monitors(display.root, true))
        .map(|reply| {
            reply
                .monitors
                .into_iter()
                .filter(|monitor| monitor.width > 0 && monitor.height > 0)
                .map(|monitor| Monitor {
                    name: monitor.name,
                    x: monitor.x,
                    y: monitor.y,
                    width: monitor.width,
                    height: monitor.height,
                    primary: monitor.primary,
                })
                .collect()
        })
        .unwrap_or_default();

    if !listed.is_empty() {
        return listed;
    }

    reply(display.connection.get_geometry(display.root))
        .map(|geometry| {
            vec![Monitor {
                name: 0,
                x: 0,
                y: 0,
                width: geometry.width,
                height: geometry.height,
                primary: true,
            }]
        })
        .unwrap_or_default()
}

#[derive(Debug, Clone)]
struct WindowInfo {
    window: Window,
    title: String,
    width: u32,
    height: u32,
    app_token: String,
    app_name: String,
    process: Option<u32>,
}

#[derive(Debug, Clone)]
struct ApplicationInfo {
    token: String,
    name: String,
    primary_window: Window,
    width: u32,
    height: u32,
}

fn app_token(name: &str) -> String {
    let token: String = name
        .to_ascii_lowercase()
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '.' || character == '_' {
                character
            } else {
                '_'
            }
        })
        .collect();
    if token.is_empty() {
        "unknown".to_string()
    } else {
        token
    }
}

fn process_name(process: u32) -> Option<String> {
    std::fs::read_to_string(format!("/proc/{process}/comm"))
        .ok()
        .map(|name| name.trim().to_string())
        .filter(|name| !name.is_empty())
}

fn windows(display: &Display) -> Vec<WindowInfo> {
    let own = std::process::id();
    let mut listed = Vec::new();

    for window in display.client_windows() {
        let process = display.process(window);
        if process == Some(own) || !display.shown_in_taskbar(window) {
            continue;
        }

        let Some(geometry) = reply(display.connection.get_geometry(window)) else {
            continue;
        };
        let width = u32::from(geometry.width);
        let height = u32::from(geometry.height);
        if width < MIN_WINDOW_EDGE || height < MIN_WINDOW_EDGE {
            continue;
        }

        let app_name = display
            .class(window)
            .or_else(|| process.and_then(process_name))
            .unwrap_or_else(|| "Unnamed app".to_string());
        let title = display.title(window);
        let title = if title.is_empty() {
            app_name.clone()
        } else {
            title
        };

        listed.push(WindowInfo {
            window,
            title,
            width,
            height,
            app_token: app_token(&app_name),
            app_name,
            process,
        });
    }

    listed
}

fn applications(windows: &[WindowInfo]) -> Vec<ApplicationInfo> {
    let mut grouped: Vec<ApplicationInfo> = Vec::new();

    for window in windows {
        let area = u64::from(window.width) * u64::from(window.height);
        if let Some(existing) = grouped
            .iter_mut()
            .find(|candidate| candidate.token == window.app_token)
        {
            if area > u64::from(existing.width) * u64::from(existing.height) {
                existing.primary_window = window.window;
                existing.width = window.width;
                existing.height = window.height;
            }
            continue;
        }

        grouped.push(ApplicationInfo {
            token: window.app_token.clone(),
            name: window.app_name.clone(),
            primary_window: window.window,
            width: window.width,
            height: window.height,
        });
    }

    grouped
}

static SEGMENT_COUNTER: AtomicU32 = AtomicU32::new(0);

fn shared_memory_dir() -> PathBuf {
    let dev_shm = PathBuf::from("/dev/shm");
    if dev_shm.is_dir() {
        return dev_shm;
    }
    std::env::var_os("XDG_RUNTIME_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir)
}

struct SharedBuffer {
    segment: u32,
    file: File,
    capacity: usize,
}

struct Grabber {
    shared: Option<SharedBuffer>,
    shared_available: bool,
}

impl Grabber {
    fn new(display: &Display) -> Self {
        Self {
            shared: None,
            shared_available: reply(display.connection.shm_query_version()).is_some(),
        }
    }

    fn release(&mut self, display: &Display) {
        if let Some(shared) = self.shared.take() {
            let _ = display.connection.shm_detach(shared.segment);
            let _ = display.connection.flush();
        }
    }

    fn ensure_shared(&mut self, display: &Display, needed: usize) -> Option<()> {
        if self
            .shared
            .as_ref()
            .is_some_and(|shared| shared.capacity >= needed)
        {
            return Some(());
        }
        self.release(display);

        let path = shared_memory_dir().join(format!(
            "colibri-capture-{}-{}",
            std::process::id(),
            SEGMENT_COUNTER.fetch_add(1, Ordering::Relaxed)
        ));
        let file = std::fs::OpenOptions::new()
            .read(true)
            .write(true)
            .create_new(true)
            .open(&path)
            .ok()?;
        let _ = std::fs::remove_file(&path);
        file.set_len(needed as u64).ok()?;

        let descriptor: OwnedFd = file.try_clone().ok()?.into();
        let segment = display.connection.generate_id().ok()?;
        display
            .connection
            .shm_attach_fd(segment, descriptor, false)
            .ok()?
            .check()
            .ok()?;

        self.shared = Some(SharedBuffer {
            segment,
            file,
            capacity: needed,
        });
        Some(())
    }

    fn grab_shared(
        &mut self,
        display: &Display,
        drawable: u32,
        area: (i16, i16, u16, u16),
    ) -> Option<Vec<u8>> {
        let (x, y, width, height) = area;
        let needed = usize::from(width) * usize::from(height) * BYTES_PER_PIXEL;
        self.ensure_shared(display, needed)?;
        let shared = self.shared.as_ref()?;
        let image = reply(display.connection.shm_get_image(
            drawable,
            x,
            y,
            width,
            height,
            u32::MAX,
            u8::from(ImageFormat::Z_PIXMAP),
            shared.segment,
            0,
        ))?;
        let size = (image.size as usize).min(needed);
        let mut pixels = vec![0u8; size];
        shared.file.read_exact_at(&mut pixels, 0).ok()?;
        Some(pixels)
    }

    fn grab(
        &mut self,
        display: &Display,
        drawable: u32,
        area: (i16, i16, u16, u16),
    ) -> Option<Vec<u8>> {
        if self.shared_available {
            if let Some(pixels) = self.grab_shared(display, drawable, area) {
                return Some(pixels);
            }
            self.shared_available = false;
            self.release(display);
        }

        let (x, y, width, height) = area;
        reply(display.connection.get_image(
            ImageFormat::Z_PIXMAP,
            drawable,
            x,
            y,
            width,
            height,
            u32::MAX,
        ))
        .map(|image| image.data)
    }
}

fn overlay_cursor(display: &Display, pixels: &mut [u8], size: (u32, u32), origin: (i32, i32)) {
    let Some(cursor) = reply(display.connection.xfixes_get_cursor_image()) else {
        return;
    };
    let left = i32::from(cursor.x) - i32::from(cursor.xhot) - origin.0;
    let top = i32::from(cursor.y) - i32::from(cursor.yhot) - origin.1;
    let cursor_width = i32::from(cursor.width);
    let (width, height) = (size.0 as i32, size.1 as i32);

    for (index, argb) in cursor.cursor_image.iter().enumerate() {
        let x = left + index as i32 % cursor_width.max(1);
        let y = top + index as i32 / cursor_width.max(1);
        if x < 0 || y < 0 || x >= width || y >= height {
            continue;
        }
        let alpha = argb >> 24;
        if alpha == 0 {
            continue;
        }
        let offset = (y as usize * width as usize + x as usize) * BYTES_PER_PIXEL;
        let Some(pixel) = pixels.get_mut(offset..offset + 3) else {
            continue;
        };
        let inverse = 255 - alpha;
        let source = [argb & 0xFF, (argb >> 8) & 0xFF, (argb >> 16) & 0xFF];
        for (channel, value) in pixel.iter_mut().zip(source) {
            *channel = (value + (u32::from(*channel) * inverse + 127) / 255).min(255) as u8;
        }
    }
}

struct NamedPixmap {
    pixmap: u32,
    width: u16,
    height: u16,
    border: u16,
}

fn name_pixmap(display: &Display, window: Window) -> Option<NamedPixmap> {
    let geometry = reply(display.connection.get_geometry(window))?;
    let pixmap = display.connection.generate_id().ok()?;
    display
        .connection
        .composite_name_window_pixmap(window, pixmap)
        .ok()?
        .check()
        .ok()?;
    Some(NamedPixmap {
        pixmap,
        width: geometry.width,
        height: geometry.height,
        border: geometry.border_width,
    })
}

fn free_pixmap(display: &Display, named: NamedPixmap) {
    let _ = display.connection.free_pixmap(named.pixmap);
}

fn grab_window(display: &Display, grabber: &mut Grabber, named: &NamedPixmap) -> Option<Vec<u8>> {
    let border = named.border as i16;
    grabber.grab(
        display,
        named.pixmap,
        (border, border, named.width, named.height),
    )
}

fn thumbnail_size(width: u32, height: u32) -> (u32, u32) {
    let wide = f64::from(width.max(1));
    let high = f64::from(height.max(1));
    let scale = (f64::from(THUMBNAIL_LONG_EDGE) / wide.max(high)).min(1.0);
    (
        ((wide * scale).round() as u32).max(2),
        ((high * scale).round() as u32).max(2),
    )
}

fn thumbnail_from_bgrx(pixels: &[u8], width: u32, height: u32) -> Option<Vec<u8>> {
    let (thumb_width, thumb_height) = thumbnail_size(width, height);
    let rgb = scale_rgb(
        &Frame {
            data: pixels,
            width,
            height,
            stride: width as usize * BYTES_PER_PIXEL,
            order: PixelOrder::Bgrx,
        },
        thumb_width,
        thumb_height,
    )?;
    Some(png(&rgb, thumb_width, thumb_height, 3))
}

fn thumbnail_from_icon(width: u32, height: u32, argb: &[u32]) -> Vec<u8> {
    let mut rgba = Vec::with_capacity(argb.len() * 4);
    for pixel in argb {
        rgba.extend_from_slice(&[
            (pixel >> 16) as u8,
            (pixel >> 8) as u8,
            *pixel as u8,
            (pixel >> 24) as u8,
        ]);
    }
    png(&rgba, width, height, 4)
}

fn crc32(bytes: &[u8], mut crc: u32) -> u32 {
    crc = !crc;
    for byte in bytes {
        crc ^= u32::from(*byte);
        for _ in 0..8 {
            crc = if crc & 1 == 1 {
                (crc >> 1) ^ 0xEDB8_8320
            } else {
                crc >> 1
            };
        }
    }
    !crc
}

fn adler32(bytes: &[u8]) -> u32 {
    let (mut a, mut b) = (1u32, 0u32);
    for chunk in bytes.chunks(5552) {
        for byte in chunk {
            a += u32::from(*byte);
            b += a;
        }
        a %= 65521;
        b %= 65521;
    }
    (b << 16) | a
}

fn png_chunk(output: &mut Vec<u8>, kind: &[u8; 4], data: &[u8]) {
    output.extend_from_slice(&(data.len() as u32).to_be_bytes());
    output.extend_from_slice(kind);
    output.extend_from_slice(data);
    let crc = crc32(data, crc32(kind, 0));
    output.extend_from_slice(&crc.to_be_bytes());
}

fn png(pixels: &[u8], width: u32, height: u32, channels: usize) -> Vec<u8> {
    let row = width as usize * channels;
    let mut raw = Vec::with_capacity((row + 1) * height as usize);
    for line in pixels.chunks_exact(row).take(height as usize) {
        raw.push(0);
        raw.extend_from_slice(line);
    }

    let mut deflated = vec![0x78, 0x01];
    let blocks: Vec<&[u8]> = raw.chunks(u16::MAX as usize).collect();
    if blocks.is_empty() {
        deflated.extend_from_slice(&[1, 0, 0, 0xFF, 0xFF]);
    }
    for (index, block) in blocks.iter().enumerate() {
        deflated.push(u8::from(index + 1 == blocks.len()));
        let length = block.len() as u16;
        deflated.extend_from_slice(&length.to_le_bytes());
        deflated.extend_from_slice(&(!length).to_le_bytes());
        deflated.extend_from_slice(block);
    }
    deflated.extend_from_slice(&adler32(&raw).to_be_bytes());

    let mut header = Vec::with_capacity(13);
    header.extend_from_slice(&width.to_be_bytes());
    header.extend_from_slice(&height.to_be_bytes());
    header.extend_from_slice(&[8, if channels == 4 { 6 } else { 2 }, 0, 0, 0]);

    let mut output = vec![0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A];
    png_chunk(&mut output, b"IHDR", &header);
    png_chunk(&mut output, b"IDAT", &deflated);
    png_chunk(&mut output, b"IEND", &[]);
    output
}

fn window_thumbnail(display: &Display, grabber: &mut Grabber, window: Window) -> Option<Vec<u8>> {
    if !display.viewable(window) {
        return None;
    }
    display
        .connection
        .composite_redirect_window(window, Redirect::AUTOMATIC)
        .ok()?;
    let named = name_pixmap(display, window);
    let png = named.as_ref().and_then(|named| {
        let pixels = grab_window(display, grabber, named)?;
        thumbnail_from_bgrx(&pixels, u32::from(named.width), u32::from(named.height))
    });
    if let Some(named) = named {
        free_pixmap(display, named);
    }
    let _ = display
        .connection
        .composite_unredirect_window(window, Redirect::AUTOMATIC);
    let _ = display.connection.flush();
    png
}

fn monitor_thumbnail(
    display: &Display,
    grabber: &mut Grabber,
    monitor: &Monitor,
) -> Option<Vec<u8>> {
    let pixels = grabber.grab(
        display,
        display.root,
        (monitor.x, monitor.y, monitor.width, monitor.height),
    )?;
    thumbnail_from_bgrx(&pixels, u32::from(monitor.width), u32::from(monitor.height))
}

enum Preview {
    Monitor(Monitor),
    Window(Window),
}

type Listing = (Vec<CaptureSource>, HashMap<String, Vec<u8>>);

pub fn list_sources() -> Result<Listing, NativeError> {
    let display = open()?;
    let screens = monitors(&display);
    let listed = windows(&display);
    let apps = applications(&listed);

    let mut candidates: Vec<(CaptureSource, Preview)> = Vec::new();

    for (index, monitor) in screens.iter().enumerate() {
        candidates.push((
            CaptureSource {
                id: SourceId::new(SourceKind::Display, monitor.name.to_string()).encode(),
                kind: SourceKind::Display,
                name: if monitor.primary && screens.len() > 1 {
                    format!("Screen {} (Main)", index + 1)
                } else {
                    format!("Screen {}", index + 1)
                },
                application: None,
                width: u32::from(monitor.width),
                height: u32::from(monitor.height),
                has_thumbnail: false,
            },
            Preview::Monitor(monitor.clone()),
        ));
    }

    for application in &apps {
        candidates.push((
            CaptureSource {
                id: SourceId::new(SourceKind::Application, application.token.clone()).encode(),
                kind: SourceKind::Application,
                name: application.name.clone(),
                application: None,
                width: application.width,
                height: application.height,
                has_thumbnail: false,
            },
            Preview::Window(application.primary_window),
        ));
    }

    for window in &listed {
        candidates.push((
            CaptureSource {
                id: SourceId::new(SourceKind::Window, window.window.to_string()).encode(),
                kind: SourceKind::Window,
                name: window.title.clone(),
                application: Some(window.app_name.clone()),
                width: window.width,
                height: window.height,
                has_thumbnail: false,
            },
            Preview::Window(window.window),
        ));
    }

    if candidates.is_empty() {
        return Err(NativeError::failed(
            "nothing on this computer can be captured",
        ));
    }

    let mut grabber = Grabber::new(&display);
    let mut window_previews: HashMap<Window, Option<Vec<u8>>> = HashMap::new();
    let mut thumbnails = HashMap::new();

    for (source, preview) in candidates.iter_mut().take(MAX_THUMBNAILS) {
        let png = match preview {
            Preview::Monitor(monitor) => monitor_thumbnail(&display, &mut grabber, monitor),
            Preview::Window(window) => window_previews
                .entry(*window)
                .or_insert_with(|| {
                    window_thumbnail(&display, &mut grabber, *window).or_else(|| {
                        display.icon(*window).map(|(width, height, pixels)| {
                            thumbnail_from_icon(width, height, &pixels)
                        })
                    })
                })
                .clone(),
        };

        if let Some(png) = png {
            thumbnails.insert(source.id.clone(), png);
            source.has_thumbnail = true;
        }
    }

    grabber.release(&display);

    Ok((
        candidates.into_iter().map(|(source, _)| source).collect(),
        thumbnails,
    ))
}

enum Target {
    Monitor(Monitor),
    Window(Window),
}

fn resolve(display: &Display, source: &SourceId) -> Result<(Target, Option<u32>), NativeError> {
    match source.kind {
        SourceKind::Display => {
            let wanted: u32 = source
                .native
                .parse()
                .map_err(|_| NativeError::invalid_request("that screen id is not a number"))?;
            let monitor = monitors(display)
                .into_iter()
                .find(|monitor| monitor.name == wanted)
                .ok_or_else(|| {
                    NativeError::invalid_request("that screen is no longer connected")
                })?;
            Ok((Target::Monitor(monitor), None))
        }
        SourceKind::Window => {
            let wanted: u32 = source
                .native
                .parse()
                .map_err(|_| NativeError::invalid_request("that window id is not a number"))?;
            if reply(display.connection.get_geometry(wanted)).is_none() {
                return Err(NativeError::invalid_request(
                    "that window has closed since you picked it",
                ));
            }
            Ok((Target::Window(wanted), display.process(wanted)))
        }
        SourceKind::Application => {
            let listed = windows(display);
            let application = applications(&listed)
                .into_iter()
                .find(|candidate| candidate.token == source.native)
                .ok_or_else(|| {
                    NativeError::invalid_request("that app has quit since you picked it")
                })?;
            let process = listed
                .iter()
                .find(|window| window.window == application.primary_window)
                .and_then(|window| window.process);
            Ok((Target::Window(application.primary_window), process))
        }
    }
}

struct Grabbed {
    pixels: Vec<u8>,
    width: u32,
    height: u32,
    origin: (i32, i32),
}

struct Pump {
    display: Display,
    grabber: Grabber,
    encoder: Encoder,
    target: Target,
    named: Option<NamedPixmap>,
}

impl Pump {
    fn window_frame(&mut self, window: Window) -> Result<Option<Grabbed>, ()> {
        let geometry = reply(self.display.connection.get_geometry(window)).ok_or(())?;
        let stale = self.named.as_ref().is_none_or(|named| {
            named.width != geometry.width
                || named.height != geometry.height
                || named.border != geometry.border_width
        });
        if stale {
            if let Some(named) = self.named.take() {
                free_pixmap(&self.display, named);
            }
            if self.display.viewable(window) {
                self.named = name_pixmap(&self.display, window);
            }
        }

        let Some(named) = self.named.as_ref() else {
            return Ok(None);
        };
        let Some(pixels) = grab_window(&self.display, &mut self.grabber, named) else {
            return Ok(None);
        };
        let origin = reply(self.display.connection.translate_coordinates(
            window,
            self.display.root,
            0,
            0,
        ))
        .map(|position| (i32::from(position.dst_x), i32::from(position.dst_y)))
        .unwrap_or((0, 0));

        Ok(Some(Grabbed {
            pixels,
            width: u32::from(named.width),
            height: u32::from(named.height),
            origin,
        }))
    }

    fn frame(&mut self) -> Result<Option<Grabbed>, ()> {
        match &self.target {
            Target::Monitor(monitor) => {
                let area = (monitor.x, monitor.y, monitor.width, monitor.height);
                let origin = (i32::from(monitor.x), i32::from(monitor.y));
                let size = (u32::from(monitor.width), u32::from(monitor.height));
                Ok(self
                    .grabber
                    .grab(&self.display, self.display.root, area)
                    .map(|pixels| Grabbed {
                        pixels,
                        width: size.0,
                        height: size.1,
                        origin,
                    }))
            }
            Target::Window(window) => {
                let window = *window;
                self.window_frame(window)
            }
        }
    }

    fn run(mut self, running: Arc<AtomicBool>) {
        if let Target::Window(window) = self.target {
            let _ = self
                .display
                .connection
                .composite_redirect_window(window, Redirect::AUTOMATIC);
        }

        let interval = Duration::from_micros(self.encoder.interval_micros().max(1) as u64);
        let mut next = Instant::now();

        while running.load(Ordering::Acquire) && !self.encoder.closed() {
            match self.frame() {
                Err(()) => break,
                Ok(Some(mut grabbed)) => {
                    overlay_cursor(
                        &self.display,
                        &mut grabbed.pixels,
                        (grabbed.width, grabbed.height),
                        grabbed.origin,
                    );
                    let delivered = self.encoder.encode(&Frame {
                        data: &grabbed.pixels,
                        width: grabbed.width,
                        height: grabbed.height,
                        stride: grabbed.width as usize * BYTES_PER_PIXEL,
                        order: PixelOrder::Bgrx,
                    });
                    if !delivered {
                        break;
                    }
                }
                Ok(None) => {}
            }

            next += interval;
            let now = Instant::now();
            if next > now {
                std::thread::sleep(next - now);
            } else {
                next = now;
            }
        }

        if let Some(named) = self.named.take() {
            free_pixmap(&self.display, named);
        }
        if let Target::Window(window) = self.target {
            let _ = self
                .display
                .connection
                .composite_unredirect_window(window, Redirect::AUTOMATIC);
        }
        self.grabber.release(&self.display);
        let _ = self.display.connection.flush();
    }
}

pub fn window_process_id(source: &SourceId) -> Option<u32> {
    let display = open().ok()?;
    resolve(&display, source).ok()?.1
}

pub struct Capture {
    running: Arc<AtomicBool>,
    worker: Option<JoinHandle<()>>,
    audio: Arc<Mutex<Option<audio::Capture>>>,
}

fn stop_audio(audio: &Mutex<Option<audio::Capture>>) {
    if let Ok(mut audio) = audio.lock() {
        if let Some(audio) = audio.take() {
            audio.stop();
        }
    }
}

impl Capture {
    pub fn stop(mut self) {
        self.running.store(false, Ordering::Release);
        if let Some(worker) = self.worker.take() {
            let _ = worker.join();
        }
        stop_audio(&self.audio);
    }
}

pub fn start(
    source: &SourceId,
    options: StartOptions,
    sender: crate::screen_capture::FrameSender,
) -> Result<Capture, NativeError> {
    let display = open()?;
    let (target, window_process) = resolve(&display, source)?;
    let audio = Arc::new(Mutex::new(start_audio(
        &options,
        &audio::Shared::native(source.kind, window_process),
        &sender,
    )));

    let pump = Pump {
        grabber: Grabber::new(&display),
        display,
        encoder: Encoder::new(options.quality, sender),
        target,
        named: None,
    };

    let running = Arc::new(AtomicBool::new(true));
    let flag = running.clone();
    let ended_audio = audio.clone();

    let worker = std::thread::Builder::new()
        .name("colibri-capture-x11".to_string())
        .spawn(move || {
            pump.run(flag);
            stop_audio(&ended_audio);
        })
        .map_err(|error| {
            stop_audio(&audio);
            NativeError::failed(format!("could not start capturing: {error}"))
        })?;

    Ok(Capture {
        running,
        worker: Some(worker),
        audio,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_largest_icon_that_fits_wins() {
        let mut values = vec![2, 2];
        values.extend([0u32; 4]);
        values.extend([512, 1]);
        values.extend(vec![0u32; 512]);
        values.extend([64, 64]);
        values.extend(vec![0u32; 64 * 64]);

        let (width, height, pixels) = largest_icon(&values).expect("an icon");
        assert_eq!((width, height), (64, 64));
        assert_eq!(pixels.len(), 64 * 64);
    }

    #[test]
    fn a_truncated_icon_is_ignored() {
        assert!(largest_icon(&[16, 16, 1, 2, 3]).is_none());
    }

    #[test]
    fn apps_group_by_class_and_keep_the_largest_window() {
        let window = |window, width, height, name: &str| WindowInfo {
            window,
            title: format!("{name} {window}"),
            width,
            height,
            app_token: app_token(name),
            app_name: name.to_string(),
            process: Some(window),
        };
        let grouped = applications(&[
            window(1, 800, 600, "Firefox"),
            window(2, 1600, 900, "Firefox"),
            window(3, 400, 300, "kitty"),
        ]);
        assert_eq!(grouped.len(), 2);
        assert_eq!(grouped[0].primary_window, 2);
        assert_eq!(grouped[0].token, "firefox");
        assert_eq!(grouped[1].name, "kitty");
    }

    #[test]
    fn an_app_token_only_keeps_safe_characters() {
        assert_eq!(app_token("Some App/2"), "some_app_2");
        assert_eq!(app_token(""), "unknown");
    }

    #[test]
    fn a_png_has_a_valid_signature_and_checksums() {
        let encoded = png(&[255, 0, 0, 0, 255, 0], 2, 1, 3);
        assert_eq!(
            &encoded[..8],
            &[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A]
        );
        assert_eq!(&encoded[12..16], b"IHDR");
        let ihdr_crc = u32::from_be_bytes(encoded[29..33].try_into().expect("four bytes"));
        assert_eq!(ihdr_crc, crc32(&encoded[16..29], crc32(b"IHDR", 0)));
        assert_eq!(&encoded[encoded.len() - 8..encoded.len() - 4], b"IEND");
    }

    #[test]
    fn the_crc_matches_the_reference_value() {
        assert_eq!(crc32(b"123456789", 0), 0xCBF4_3926);
    }

    #[test]
    fn the_adler_checksum_matches_the_reference_value() {
        assert_eq!(adler32(b"Wikipedia"), 0x11E6_0398);
    }

    #[test]
    fn a_thumbnail_keeps_its_aspect_ratio_and_never_grows() {
        assert_eq!(thumbnail_size(3840, 2160), (400, 225));
        assert_eq!(thumbnail_size(120, 80), (120, 80));
    }
}
