use std::ffi::{c_int, c_longlong, c_uchar, c_uint, c_ulong};
use std::ptr::NonNull;
use std::sync::Mutex;
use std::time::Instant;

use crate::screen_capture::{CaptureMessage, CaptureQuality, EncodedConfig, FrameSender};

pub const VP8_CODEC: &str = "vp8";
const MICROS_PER_SECOND: i64 = 1_000_000;
const KEYFRAME_INTERVAL_SECONDS: u32 = 2;
const REALTIME_SPEED: i32 = 10;
const MAX_ENCODER_THREADS: u32 = 8;
const BYTES_PER_PIXEL: usize = 4;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PixelOrder {
    Bgrx,
    Rgbx,
}

pub struct Frame<'a> {
    pub data: &'a [u8],
    pub width: u32,
    pub height: u32,
    pub stride: usize,
    pub order: PixelOrder,
}

impl Frame<'_> {
    fn is_complete(&self) -> bool {
        if self.width == 0 || self.height == 0 {
            return false;
        }
        let row = self.width as usize * BYTES_PER_PIXEL;
        if self.stride < row {
            return false;
        }
        let needed = self.stride * (self.height as usize - 1) + row;
        self.data.len() >= needed
    }

    fn channels(&self) -> (usize, usize, usize) {
        match self.order {
            PixelOrder::Bgrx => (2, 1, 0),
            PixelOrder::Rgbx => (0, 1, 2),
        }
    }
}

pub fn output_size(source: (u32, u32), limit: (u32, u32)) -> (u32, u32) {
    let source_width = f64::from(source.0.max(1));
    let source_height = f64::from(source.1.max(1));
    let scale = (f64::from(limit.0.max(2)) / source_width)
        .min(f64::from(limit.1.max(2)) / source_height)
        .min(1.0);

    let even = |value: f64| (((value * scale).round() as u32) & !1).max(2);
    (even(source_width), even(source_height))
}

fn spans(source: u32, target: u32) -> Vec<(usize, usize)> {
    let source = source as usize;
    let target = target as usize;
    (0..target)
        .map(|index| {
            let start = (index * source / target).min(source - 1);
            let end = ((index + 1) * source / target).clamp(start + 1, source);
            (start, end)
        })
        .collect()
}

pub fn scale_rgb(frame: &Frame, width: u32, height: u32) -> Option<Vec<u8>> {
    if !frame.is_complete() || width == 0 || height == 0 {
        return None;
    }

    let (red, green, blue) = frame.channels();
    let columns = spans(frame.width, width);
    let rows = spans(frame.height, height);
    let mut rgb = vec![0u8; width as usize * height as usize * 3];

    if frame.width == width && frame.height == height {
        for (y, line) in rgb.chunks_exact_mut(width as usize * 3).enumerate() {
            let source = &frame.data[y * frame.stride..];
            for (x, pixel) in line.chunks_exact_mut(3).enumerate() {
                let offset = x * BYTES_PER_PIXEL;
                pixel[0] = source[offset + red];
                pixel[1] = source[offset + green];
                pixel[2] = source[offset + blue];
            }
        }
        return Some(rgb);
    }

    let mut sums = vec![0u32; width as usize * 3];
    for (y, &(top, bottom)) in rows.iter().enumerate() {
        sums.fill(0);
        for source_row in top..bottom {
            let source = &frame.data[source_row * frame.stride..];
            for (x, &(left, right)) in columns.iter().enumerate() {
                let sum = &mut sums[x * 3..x * 3 + 3];
                for column in left..right {
                    let offset = column * BYTES_PER_PIXEL;
                    sum[0] += u32::from(source[offset + red]);
                    sum[1] += u32::from(source[offset + green]);
                    sum[2] += u32::from(source[offset + blue]);
                }
            }
        }

        let line = &mut rgb[y * width as usize * 3..(y + 1) * width as usize * 3];
        let height_span = (bottom - top) as u32;
        for (x, &(left, right)) in columns.iter().enumerate() {
            let count = height_span * (right - left) as u32;
            let half = count / 2;
            for channel in 0..3 {
                line[x * 3 + channel] = ((sums[x * 3 + channel] + half) / count) as u8;
            }
        }
    }

    Some(rgb)
}

fn luma(red: i32, green: i32, blue: i32) -> u8 {
    (16 + ((47 * red + 157 * green + 16 * blue + 128) >> 8)).clamp(0, 255) as u8
}

fn chroma(red: i32, green: i32, blue: i32) -> (u8, u8) {
    let u = 128 + ((-26 * red - 87 * green + 113 * blue + 128) >> 8);
    let v = 128 + ((112 * red - 102 * green - 10 * blue + 128) >> 8);
    (u.clamp(0, 255) as u8, v.clamp(0, 255) as u8)
}

pub fn i420_from_rgb(rgb: &[u8], width: u32, height: u32) -> Vec<u8> {
    let width = width as usize;
    let height = height as usize;
    let chroma_width = width.div_ceil(2);
    let chroma_height = height.div_ceil(2);
    let luma_size = width * height;
    let chroma_size = chroma_width * chroma_height;
    let mut planes = vec![0u8; luma_size + chroma_size * 2];
    let (luma_plane, rest) = planes.split_at_mut(luma_size);
    let (u_plane, v_plane) = rest.split_at_mut(chroma_size);

    for (index, pixel) in rgb.chunks_exact(3).take(luma_size).enumerate() {
        luma_plane[index] = luma(
            i32::from(pixel[0]),
            i32::from(pixel[1]),
            i32::from(pixel[2]),
        );
    }

    for chroma_y in 0..chroma_height {
        for chroma_x in 0..chroma_width {
            let mut totals = [0i32; 3];
            let mut count = 0;
            for y in chroma_y * 2..(chroma_y * 2 + 2).min(height) {
                for x in chroma_x * 2..(chroma_x * 2 + 2).min(width) {
                    let offset = (y * width + x) * 3;
                    totals[0] += i32::from(rgb[offset]);
                    totals[1] += i32::from(rgb[offset + 1]);
                    totals[2] += i32::from(rgb[offset + 2]);
                    count += 1;
                }
            }
            let (u, v) = chroma(totals[0] / count, totals[1] / count, totals[2] / count);
            let index = chroma_y * chroma_width + chroma_x;
            u_plane[index] = u;
            v_plane[index] = v;
        }
    }

    planes
}

#[repr(C)]
struct NativeVp8 {
    _private: [u8; 0],
}

extern "C" {
    fn colibri_vp8_open(
        width: c_uint,
        height: c_uint,
        kilobits: c_uint,
        threads: c_uint,
        keyframe_interval: c_uint,
        speed: c_int,
    ) -> *mut NativeVp8;
    fn colibri_vp8_encode(
        encoder: *mut NativeVp8,
        planes: *mut c_uchar,
        timestamp: c_longlong,
        duration: c_ulong,
        keyframe: c_int,
    ) -> c_int;
    fn colibri_vp8_next(
        encoder: *mut NativeVp8,
        data: *mut *const c_uchar,
        size: *mut usize,
        timestamp: *mut c_longlong,
        keyframe: *mut c_int,
    ) -> c_int;
    fn colibri_vp8_close(encoder: *mut NativeVp8);
}

struct Vp8 {
    native: NonNull<NativeVp8>,
    width: u32,
    height: u32,
}

unsafe impl Send for Vp8 {}

struct Packet {
    keyframe: bool,
    timestamp: i64,
    data: Vec<u8>,
}

fn encoder_threads() -> u32 {
    std::thread::available_parallelism()
        .map(|count| (count.get() as u32 / 2).clamp(1, MAX_ENCODER_THREADS))
        .unwrap_or(1)
}

impl Vp8 {
    fn new(width: u32, height: u32, quality: CaptureQuality) -> Option<Self> {
        let native = unsafe {
            colibri_vp8_open(
                width,
                height,
                (quality.max_bitrate / 1000).max(1),
                encoder_threads(),
                quality.framerate.max(1) * KEYFRAME_INTERVAL_SECONDS,
                REALTIME_SPEED,
            )
        };
        Some(Self {
            native: NonNull::new(native)?,
            width,
            height,
        })
    }

    fn encode(
        &mut self,
        planes: &mut [u8],
        timestamp: i64,
        duration: i64,
        keyframe: bool,
    ) -> Option<Vec<Packet>> {
        let expected = self.width as usize * self.height as usize * 3 / 2;
        if planes.len() < expected {
            return None;
        }
        let status = unsafe {
            colibri_vp8_encode(
                self.native.as_ptr(),
                planes.as_mut_ptr(),
                timestamp,
                duration.max(1) as c_ulong,
                c_int::from(keyframe),
            )
        };
        if status != 0 {
            return None;
        }

        let mut packets = Vec::new();
        loop {
            let mut data: *const c_uchar = std::ptr::null();
            let mut size = 0usize;
            let mut stamp: c_longlong = 0;
            let mut key: c_int = 0;
            let found = unsafe {
                colibri_vp8_next(
                    self.native.as_ptr(),
                    &mut data,
                    &mut size,
                    &mut stamp,
                    &mut key,
                )
            };
            if found == 0 {
                break;
            }
            if data.is_null() || size == 0 {
                continue;
            }
            packets.push(Packet {
                keyframe: key != 0,
                timestamp: stamp,
                data: unsafe { std::slice::from_raw_parts(data, size) }.to_vec(),
            });
        }
        Some(packets)
    }
}

impl Drop for Vp8 {
    fn drop(&mut self) {
        unsafe { colibri_vp8_close(self.native.as_ptr()) };
    }
}

#[derive(Default)]
struct State {
    origin: Option<Instant>,
    last_micros: Option<i64>,
    vp8: Option<Vp8>,
}

pub struct Encoder {
    quality: CaptureQuality,
    sender: FrameSender,
    state: Mutex<State>,
}

impl Encoder {
    pub fn new(quality: CaptureQuality, sender: FrameSender) -> Self {
        Self {
            quality,
            sender,
            state: Mutex::new(State::default()),
        }
    }

    pub fn interval_micros(&self) -> i64 {
        MICROS_PER_SECOND / i64::from(self.quality.framerate.max(1))
    }

    pub fn closed(&self) -> bool {
        self.sender.is_closed()
    }

    fn schedule(&self, state: &mut State) -> Option<i64> {
        let now = Instant::now();
        let origin = *state.origin.get_or_insert(now);
        let micros = now.duration_since(origin).as_micros() as i64;

        if let Some(last) = state.last_micros {
            if micros - last < self.interval_micros() * 9 / 10 {
                return None;
            }
        }

        state.last_micros = Some(micros);
        Some(micros)
    }

    pub fn due(&self) -> bool {
        let Ok(state) = self.state.lock() else {
            return false;
        };
        let (Some(origin), Some(last)) = (state.origin, state.last_micros) else {
            return true;
        };
        let micros = Instant::now().duration_since(origin).as_micros() as i64;
        micros - last >= self.interval_micros() * 9 / 10
    }

    pub fn encode(&self, frame: &Frame) -> bool {
        if self.closed() {
            eprintln!("screen capture stopped: the app closed the capture connection");
            return false;
        }
        let Ok(mut state) = self.state.lock() else {
            eprintln!("screen capture stopped: the encoder state is poisoned");
            return false;
        };
        let Some(timestamp) = self.schedule(&mut state) else {
            return true;
        };

        let (width, height) = output_size(
            (frame.width, frame.height),
            (self.quality.width, self.quality.height),
        );
        let Some(rgb) = scale_rgb(frame, width, height) else {
            return true;
        };
        let mut planes = i420_from_rgb(&rgb, width, height);

        let reconfigure = state
            .vp8
            .as_ref()
            .is_none_or(|vp8| vp8.width != width || vp8.height != height);
        if reconfigure {
            state.vp8 = None;
            let Some(vp8) = Vp8::new(width, height, self.quality) else {
                eprintln!(
                    "screen capture stopped: could not start the VP8 encoder at {width}x{height}"
                );
                return false;
            };
            state.vp8 = Some(vp8);
            let config = CaptureMessage::Config(EncodedConfig {
                codec: VP8_CODEC.to_string(),
                description: Vec::new(),
                coded_width: width,
                coded_height: height,
            });
            if self.sender.send(config).is_err() {
                eprintln!("screen capture stopped: the app closed the capture connection");
                return false;
            }
        }

        let interval = self.interval_micros();
        let Some(vp8) = state.vp8.as_mut() else {
            return false;
        };
        let Some(packets) = vp8.encode(&mut planes, timestamp, interval, reconfigure) else {
            return true;
        };

        packets.into_iter().all(|packet| {
            self.sender
                .send(CaptureMessage::Frame {
                    keyframe: packet.keyframe,
                    timestamp_micros: packet.timestamp,
                    data: packet.data,
                })
                .is_ok()
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn solid(width: u32, height: u32, pixel: [u8; 4]) -> Vec<u8> {
        pixel
            .iter()
            .copied()
            .cycle()
            .take(width as usize * height as usize * 4)
            .collect()
    }

    #[test]
    fn a_source_smaller_than_the_limit_keeps_its_size() {
        assert_eq!(output_size((1280, 720), (1920, 1080)), (1280, 720));
    }

    #[test]
    fn a_large_source_is_scaled_down_to_fit_the_limit() {
        assert_eq!(output_size((3840, 2160), (1920, 1080)), (1920, 1080));
    }

    #[test]
    fn a_portrait_window_keeps_its_shape() {
        let (width, height) = output_size((1000, 2000), (1920, 1080));
        assert_eq!(height, 1080);
        assert_eq!(width, 540);
    }

    #[test]
    fn output_sizes_are_even() {
        let (width, height) = output_size((1001, 777), (7680, 4320));
        assert_eq!(width % 2, 0);
        assert_eq!(height % 2, 0);
    }

    #[test]
    fn white_becomes_studio_range_white() {
        let data = solid(4, 4, [255, 255, 255, 0]);
        let frame = Frame {
            data: &data,
            width: 4,
            height: 4,
            stride: 16,
            order: PixelOrder::Bgrx,
        };
        let rgb = scale_rgb(&frame, 4, 4).expect("scales");
        let planes = i420_from_rgb(&rgb, 4, 4);
        assert_eq!(planes.len(), 16 + 4 + 4);
        assert!(planes[..16].iter().all(|&y| (234..=236).contains(&y)));
        assert!(planes[16..].iter().all(|&c| (127..=129).contains(&c)));
    }

    #[test]
    fn channel_order_is_respected() {
        let bgrx = solid(2, 2, [0, 0, 255, 0]);
        let rgbx = solid(2, 2, [255, 0, 0, 0]);
        let scale = |data: &[u8], order| {
            scale_rgb(
                &Frame {
                    data,
                    width: 2,
                    height: 2,
                    stride: 8,
                    order,
                },
                2,
                2,
            )
            .expect("scales")
        };
        assert_eq!(
            scale(&bgrx, PixelOrder::Bgrx),
            scale(&rgbx, PixelOrder::Rgbx)
        );
        assert_eq!(&scale(&bgrx, PixelOrder::Bgrx)[..3], &[255, 0, 0]);
    }

    #[test]
    fn downscaling_averages_neighbouring_pixels() {
        let mut data = Vec::new();
        for _ in 0..2 {
            data.extend_from_slice(&[0, 0, 0, 0, 200, 200, 200, 0]);
        }
        let frame = Frame {
            data: &data,
            width: 2,
            height: 2,
            stride: 8,
            order: PixelOrder::Bgrx,
        };
        assert_eq!(
            scale_rgb(&frame, 1, 1).expect("scales"),
            vec![100, 100, 100]
        );
    }

    #[test]
    fn row_padding_is_skipped() {
        let mut data = Vec::new();
        for _ in 0..2 {
            data.extend_from_slice(&[10, 20, 30, 0, 10, 20, 30, 0, 99, 99, 99, 99]);
        }
        let frame = Frame {
            data: &data,
            width: 2,
            height: 2,
            stride: 12,
            order: PixelOrder::Rgbx,
        };
        let rgb = scale_rgb(&frame, 2, 2).expect("scales");
        assert!(rgb.chunks_exact(3).all(|pixel| pixel == [10, 20, 30]));
    }

    #[test]
    fn a_truncated_frame_is_rejected() {
        let data = vec![0u8; 10];
        let frame = Frame {
            data: &data,
            width: 4,
            height: 4,
            stride: 16,
            order: PixelOrder::Bgrx,
        };
        assert!(scale_rgb(&frame, 4, 4).is_none());
    }

    fn quality() -> CaptureQuality {
        CaptureQuality {
            width: 1920,
            height: 1080,
            framerate: 30,
            max_bitrate: 4_500_000,
        }
    }

    fn gradient(width: u32, height: u32) -> Vec<u8> {
        (0..width * height)
            .flat_map(|index| {
                let value = (index % 251) as u8;
                [value, value / 2, 255 - value, 0]
            })
            .collect()
    }

    #[test]
    fn the_first_frame_sends_a_vp8_config_and_a_keyframe() {
        let (sender, mut receiver) = tokio::sync::mpsc::unbounded_channel();
        let encoder = Encoder::new(quality(), sender);
        let data = gradient(64, 48);
        assert!(encoder.encode(&Frame {
            data: &data,
            width: 64,
            height: 48,
            stride: 64 * 4,
            order: PixelOrder::Bgrx,
        }));

        let Ok(CaptureMessage::Config(config)) = receiver.try_recv() else {
            panic!("the config comes first");
        };
        assert_eq!(config.codec, VP8_CODEC);
        assert!(config.description.is_empty());
        assert_eq!((config.coded_width, config.coded_height), (64, 48));

        let Ok(CaptureMessage::Frame { data, keyframe, .. }) = receiver.try_recv() else {
            panic!("a frame follows");
        };
        assert!(keyframe);
        assert!(data.len() > 3);
        assert_eq!(&data[3..6], &[0x9D, 0x01, 0x2A]);
    }

    #[test]
    fn later_frames_are_delta_frames() {
        let mut vp8 = Vp8::new(64, 48, quality()).expect("starts");
        let rgb = vec![90u8; 64 * 48 * 3];
        let mut planes = i420_from_rgb(&rgb, 64, 48);
        let first = vp8.encode(&mut planes, 0, 33_333, false).expect("encodes");
        let second = vp8
            .encode(&mut planes, 33_333, 33_333, false)
            .expect("encodes");
        assert!(first.iter().all(|packet| packet.keyframe));
        assert!(second.iter().all(|packet| !packet.keyframe));
        let forced = vp8
            .encode(&mut planes, 66_666, 33_333, true)
            .expect("encodes");
        assert!(forced.iter().any(|packet| packet.keyframe));
    }

    #[test]
    fn a_new_size_starts_a_new_stream_with_a_keyframe() {
        let (sender, mut receiver) = tokio::sync::mpsc::unbounded_channel();
        let encoder = Encoder::new(
            CaptureQuality {
                framerate: 120,
                ..quality()
            },
            sender,
        );
        for (width, height) in [(64, 48), (80, 48)] {
            let data = gradient(width, height);
            std::thread::sleep(std::time::Duration::from_millis(20));
            assert!(encoder.encode(&Frame {
                data: &data,
                width,
                height,
                stride: width as usize * 4,
                order: PixelOrder::Rgbx,
            }));
        }
        let messages: Vec<CaptureMessage> =
            std::iter::from_fn(|| receiver.try_recv().ok()).collect();
        let configs: Vec<(u32, u32)> = messages
            .iter()
            .filter_map(|message| match message {
                CaptureMessage::Config(config) => Some((config.coded_width, config.coded_height)),
                _ => None,
            })
            .collect();
        assert_eq!(configs, vec![(64, 48), (80, 48)]);
        assert!(matches!(
            messages.last(),
            Some(CaptureMessage::Frame { keyframe: true, .. })
        ));
    }
}
