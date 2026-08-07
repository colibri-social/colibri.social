use std::mem::ManuallyDrop;
use std::sync::{Arc, Mutex};

use windows::core::BOOL;
use windows::core::{Interface, Result as WindowsResult};
use windows::Foundation::TypedEventHandler;
use windows::Graphics::Capture::{
    Direct3D11CaptureFramePool, GraphicsCaptureItem, GraphicsCaptureSession,
};
use windows::Graphics::DirectX::Direct3D11::IDirect3DDevice;
use windows::Graphics::DirectX::DirectXPixelFormat;
use windows::Graphics::SizeInt32;
use windows::Win32::Foundation::RECT;
use windows::Win32::Graphics::Direct3D::{D3D_DRIVER_TYPE_HARDWARE, D3D_DRIVER_TYPE_WARP};
use windows::Win32::Graphics::Direct3D11::{
    D3D11CreateDevice, ID3D11Device, ID3D11DeviceContext, ID3D11Multithread, ID3D11Texture2D,
    ID3D11VideoContext, ID3D11VideoContext1, ID3D11VideoDevice, ID3D11VideoProcessor,
    ID3D11VideoProcessorEnumerator, ID3D11VideoProcessorInputView, ID3D11VideoProcessorOutputView,
    D3D11_BIND_RENDER_TARGET, D3D11_BIND_SHADER_RESOURCE, D3D11_CPU_ACCESS_READ,
    D3D11_CREATE_DEVICE_BGRA_SUPPORT, D3D11_CREATE_DEVICE_VIDEO_SUPPORT, D3D11_MAPPED_SUBRESOURCE,
    D3D11_MAP_READ, D3D11_SDK_VERSION, D3D11_TEX2D_VPIV, D3D11_TEX2D_VPOV, D3D11_TEXTURE2D_DESC,
    D3D11_USAGE_DEFAULT, D3D11_USAGE_STAGING, D3D11_VIDEO_COLOR, D3D11_VIDEO_COLOR_RGBA,
    D3D11_VIDEO_FRAME_FORMAT_PROGRESSIVE, D3D11_VIDEO_PROCESSOR_CONTENT_DESC,
    D3D11_VIDEO_PROCESSOR_INPUT_VIEW_DESC, D3D11_VIDEO_PROCESSOR_INPUT_VIEW_DESC_0,
    D3D11_VIDEO_PROCESSOR_OUTPUT_VIEW_DESC, D3D11_VIDEO_PROCESSOR_OUTPUT_VIEW_DESC_0,
    D3D11_VIDEO_PROCESSOR_STREAM, D3D11_VIDEO_USAGE_PLAYBACK_NORMAL,
    D3D11_VPIV_DIMENSION_TEXTURE2D, D3D11_VPOV_DIMENSION_TEXTURE2D,
};
use windows::Win32::Graphics::Dxgi::Common::{
    DXGI_COLOR_SPACE_RGB_FULL_G22_NONE_P709, DXGI_COLOR_SPACE_YCBCR_STUDIO_G22_LEFT_P709,
    DXGI_FORMAT_B8G8R8A8_UNORM, DXGI_FORMAT_NV12, DXGI_RATIONAL, DXGI_SAMPLE_DESC,
};
use windows::Win32::Graphics::Dxgi::IDXGIDevice;
use windows::Win32::System::WinRT::Direct3D11::{
    CreateDirect3D11DeviceFromDXGIDevice, IDirect3DDxgiInterfaceAccess,
};

use super::audio;
use super::encoder::Encoder;
use crate::native_error::NativeError;
use crate::screen_capture::{CaptureQuality, FrameSender};

const FRAME_POOL_BUFFERS: i32 = 2;
const MICROS_PER_SECOND: i64 = 1_000_000;
const HUNDRED_NANOS_PER_MICRO: i64 = 10;

fn fit(source: (u32, u32), target: (u32, u32)) -> RECT {
    let source_width = f64::from(source.0.max(1));
    let source_height = f64::from(source.1.max(1));
    let target_width = f64::from(target.0.max(2));
    let target_height = f64::from(target.1.max(2));

    let scale = (target_width / source_width).min(target_height / source_height);
    let width = (((source_width * scale).round() as i32).max(2) & !1).min(target.0 as i32);
    let height = (((source_height * scale).round() as i32).max(2) & !1).min(target.1 as i32);

    let left = ((target.0 as i32 - width) / 2).max(0) & !1;
    let top = ((target.1 as i32 - height) / 2).max(0) & !1;

    RECT {
        left,
        top,
        right: left + width,
        bottom: top + height,
    }
}

fn create_device() -> Result<(ID3D11Device, ID3D11DeviceContext), NativeError> {
    for driver in [D3D_DRIVER_TYPE_HARDWARE, D3D_DRIVER_TYPE_WARP] {
        let mut device: Option<ID3D11Device> = None;
        let mut context: Option<ID3D11DeviceContext> = None;

        let outcome = unsafe {
            D3D11CreateDevice(
                None,
                driver,
                windows::Win32::Foundation::HMODULE::default(),
                D3D11_CREATE_DEVICE_BGRA_SUPPORT | D3D11_CREATE_DEVICE_VIDEO_SUPPORT,
                None,
                D3D11_SDK_VERSION,
                Some(&mut device),
                None,
                Some(&mut context),
            )
        };

        if outcome.is_ok() {
            if let (Some(device), Some(context)) = (device, context) {
                if let Ok(guard) = device.cast::<ID3D11Multithread>() {
                    let _ = unsafe { guard.SetMultithreadProtected(true) };
                }
                return Ok((device, context));
            }
        }
    }

    Err(NativeError::failed(
        "this PC has no graphics device that can capture a screen",
    ))
}

fn texture(
    device: &ID3D11Device,
    width: u32,
    height: u32,
    format: windows::Win32::Graphics::Dxgi::Common::DXGI_FORMAT,
    staging: bool,
) -> WindowsResult<ID3D11Texture2D> {
    let description = D3D11_TEXTURE2D_DESC {
        Width: width,
        Height: height,
        MipLevels: 1,
        ArraySize: 1,
        Format: format,
        SampleDesc: DXGI_SAMPLE_DESC {
            Count: 1,
            Quality: 0,
        },
        Usage: if staging {
            D3D11_USAGE_STAGING
        } else {
            D3D11_USAGE_DEFAULT
        },
        BindFlags: if staging {
            0
        } else {
            (D3D11_BIND_RENDER_TARGET.0 | D3D11_BIND_SHADER_RESOURCE.0) as u32
        },
        CPUAccessFlags: if staging {
            D3D11_CPU_ACCESS_READ.0 as u32
        } else {
            0
        },
        MiscFlags: 0,
    };

    let mut created = None;
    unsafe { device.CreateTexture2D(&description, None, Some(&mut created))? };
    created.ok_or_else(windows::core::Error::empty)
}

struct Converter {
    video_context: ID3D11VideoContext,
    _enumerator: ID3D11VideoProcessorEnumerator,
    processor: ID3D11VideoProcessor,
    source: ID3D11Texture2D,
    input_view: ID3D11VideoProcessorInputView,
    output_view: ID3D11VideoProcessorOutputView,
    output: ID3D11Texture2D,
    staging: ID3D11Texture2D,
    source_size: (u32, u32),
    target_size: (u32, u32),
}

impl Converter {
    fn new(
        device: &ID3D11Device,
        source_size: (u32, u32),
        target_size: (u32, u32),
        framerate: u32,
    ) -> Result<Self, NativeError> {
        let build = || -> WindowsResult<Self> {
            let video_device = device.cast::<ID3D11VideoDevice>()?;
            let video_context =
                unsafe { device.GetImmediateContext() }?.cast::<ID3D11VideoContext>()?;

            let rate = DXGI_RATIONAL {
                Numerator: framerate.max(1),
                Denominator: 1,
            };

            let description = D3D11_VIDEO_PROCESSOR_CONTENT_DESC {
                InputFrameFormat: D3D11_VIDEO_FRAME_FORMAT_PROGRESSIVE,
                InputFrameRate: rate,
                InputWidth: source_size.0,
                InputHeight: source_size.1,
                OutputFrameRate: rate,
                OutputWidth: target_size.0,
                OutputHeight: target_size.1,
                Usage: D3D11_VIDEO_USAGE_PLAYBACK_NORMAL,
            };

            let enumerator = unsafe { video_device.CreateVideoProcessorEnumerator(&description) }?;
            let processor = unsafe { video_device.CreateVideoProcessor(&enumerator, 0) }?;

            let source = texture(
                device,
                source_size.0,
                source_size.1,
                DXGI_FORMAT_B8G8R8A8_UNORM,
                false,
            )?;
            let output = texture(
                device,
                target_size.0,
                target_size.1,
                DXGI_FORMAT_NV12,
                false,
            )?;
            let staging = texture(device, target_size.0, target_size.1, DXGI_FORMAT_NV12, true)?;

            let input_description = D3D11_VIDEO_PROCESSOR_INPUT_VIEW_DESC {
                FourCC: 0,
                ViewDimension: D3D11_VPIV_DIMENSION_TEXTURE2D,
                Anonymous: D3D11_VIDEO_PROCESSOR_INPUT_VIEW_DESC_0 {
                    Texture2D: D3D11_TEX2D_VPIV {
                        MipSlice: 0,
                        ArraySlice: 0,
                    },
                },
            };
            let mut input_view = None;
            unsafe {
                video_device.CreateVideoProcessorInputView(
                    &source,
                    &enumerator,
                    &input_description,
                    Some(&mut input_view),
                )?
            };
            let input_view = input_view.ok_or_else(windows::core::Error::empty)?;

            let output_description = D3D11_VIDEO_PROCESSOR_OUTPUT_VIEW_DESC {
                ViewDimension: D3D11_VPOV_DIMENSION_TEXTURE2D,
                Anonymous: D3D11_VIDEO_PROCESSOR_OUTPUT_VIEW_DESC_0 {
                    Texture2D: D3D11_TEX2D_VPOV { MipSlice: 0 },
                },
            };
            let mut output_view = None;
            unsafe {
                video_device.CreateVideoProcessorOutputView(
                    &output,
                    &enumerator,
                    &output_description,
                    Some(&mut output_view),
                )?
            };
            let output_view = output_view.ok_or_else(windows::core::Error::empty)?;

            let source_rect = RECT {
                left: 0,
                top: 0,
                right: source_size.0 as i32,
                bottom: source_size.1 as i32,
            };
            let destination = fit(source_size, target_size);

            unsafe {
                video_context.VideoProcessorSetStreamSourceRect(
                    &processor,
                    0,
                    true,
                    Some(&source_rect),
                );
                video_context.VideoProcessorSetStreamDestRect(
                    &processor,
                    0,
                    true,
                    Some(&destination),
                );
                video_context.VideoProcessorSetOutputTargetRect(&processor, false, None);
                video_context.VideoProcessorSetOutputBackgroundColor(
                    &processor,
                    false,
                    &D3D11_VIDEO_COLOR {
                        Anonymous: windows::Win32::Graphics::Direct3D11::D3D11_VIDEO_COLOR_0 {
                            RGBA: D3D11_VIDEO_COLOR_RGBA {
                                R: 0.0,
                                G: 0.0,
                                B: 0.0,
                                A: 1.0,
                            },
                        },
                    },
                );
            }

            if let Ok(context) = video_context.cast::<ID3D11VideoContext1>() {
                unsafe {
                    context.VideoProcessorSetStreamColorSpace1(
                        &processor,
                        0,
                        DXGI_COLOR_SPACE_RGB_FULL_G22_NONE_P709,
                    );
                    context.VideoProcessorSetOutputColorSpace1(
                        &processor,
                        DXGI_COLOR_SPACE_YCBCR_STUDIO_G22_LEFT_P709,
                    );
                }
            }

            Ok(Self {
                video_context,
                _enumerator: enumerator,
                processor,
                source,
                input_view,
                output_view,
                output,
                staging,
                source_size,
                target_size,
            })
        };

        build().map_err(|error| {
            NativeError::failed(format!("could not prepare the video converter: {error}"))
        })
    }

    fn convert(&self, context: &ID3D11DeviceContext, frame: &ID3D11Texture2D) -> Option<Vec<u8>> {
        unsafe { context.CopyResource(&self.source, frame) };

        let mut stream = D3D11_VIDEO_PROCESSOR_STREAM {
            Enable: BOOL(1),
            pInputSurface: ManuallyDrop::new(Some(self.input_view.clone())),
            ..Default::default()
        };

        let outcome = unsafe {
            self.video_context.VideoProcessorBlt(
                &self.processor,
                &self.output_view,
                0,
                &[stream.clone()],
            )
        };

        unsafe { ManuallyDrop::drop(&mut stream.pInputSurface) };
        outcome.ok()?;

        unsafe { context.CopyResource(&self.staging, &self.output) };

        let mut mapped = D3D11_MAPPED_SUBRESOURCE::default();
        unsafe { context.Map(&self.staging, 0, D3D11_MAP_READ, 0, Some(&mut mapped)) }.ok()?;

        let width = self.target_size.0 as usize;
        let height = self.target_size.1 as usize;
        let pitch = mapped.RowPitch as usize;

        let mut nv12 = vec![0u8; width * height * 3 / 2];
        let source = mapped.pData.cast::<u8>();

        for row in 0..height {
            unsafe {
                std::ptr::copy_nonoverlapping(
                    source.add(row * pitch),
                    nv12.as_mut_ptr().add(row * width),
                    width,
                );
            }
        }

        let chroma_offset = width * height;
        for row in 0..height / 2 {
            unsafe {
                std::ptr::copy_nonoverlapping(
                    source.add((height + row) * pitch),
                    nv12.as_mut_ptr().add(chroma_offset + row * width),
                    width,
                );
            }
        }

        unsafe { context.Unmap(&self.staging, 0) };

        Some(nv12)
    }
}

struct Pipeline {
    device: ID3D11Device,
    context: ID3D11DeviceContext,
    encoder: Arc<Encoder>,
    converter: Mutex<Converter>,
    quality: CaptureQuality,
    clock: Mutex<Clock>,
}

#[derive(Default)]
struct Clock {
    origin: Option<i64>,
    last_micros: i64,
}

unsafe impl Send for Pipeline {}
unsafe impl Sync for Pipeline {}

unsafe impl Send for Converter {}
unsafe impl Sync for Converter {}

impl Pipeline {
    fn interval_micros(&self) -> i64 {
        MICROS_PER_SECOND / i64::from(self.quality.framerate.max(1))
    }

    fn schedule(&self, system_relative: i64) -> Option<i64> {
        let mut clock = self.clock.lock().ok()?;
        let origin = *clock.origin.get_or_insert(system_relative);
        let micros = (system_relative - origin) / HUNDRED_NANOS_PER_MICRO;

        if clock.last_micros > 0 || micros > 0 {
            let elapsed = micros - clock.last_micros;
            if elapsed < self.interval_micros() * 9 / 10 {
                return None;
            }
        }

        clock.last_micros = micros;
        Some(micros)
    }

    fn resize(&self, size: SizeInt32) {
        let next = (size.Width.max(2) as u32, size.Height.max(2) as u32);
        let Ok(mut converter) = self.converter.lock() else {
            return;
        };

        if converter.source_size == next {
            return;
        }

        if let Ok(replacement) = Converter::new(
            &self.device,
            next,
            converter.target_size,
            self.quality.framerate,
        ) {
            *converter = replacement;
        }
    }

    fn handle(&self, pool: &Direct3D11CaptureFramePool) {
        let Ok(frame) = pool.TryGetNextFrame() else {
            return;
        };

        let content = frame.ContentSize().unwrap_or_default();
        let matches = self
            .converter
            .lock()
            .map(|converter| {
                converter.source_size == (content.Width.max(2) as u32, content.Height.max(2) as u32)
            })
            .unwrap_or(false);

        if !matches {
            self.resize(content);
            if let Ok(device) = winrt_device(&self.device) {
                let _ = pool.Recreate(
                    &device,
                    DirectXPixelFormat::B8G8R8A8UIntNormalized,
                    FRAME_POOL_BUFFERS,
                    content,
                );
            }
            return;
        }

        let Ok(relative) = frame.SystemRelativeTime() else {
            return;
        };
        let Some(timestamp) = self.schedule(relative.Duration) else {
            return;
        };

        let Ok(surface) = frame.Surface() else {
            return;
        };
        let Ok(access) = surface.cast::<IDirect3DDxgiInterfaceAccess>() else {
            return;
        };
        let Ok(texture) = (unsafe { access.GetInterface::<ID3D11Texture2D>() }) else {
            return;
        };

        let Ok(converter) = self.converter.lock() else {
            return;
        };
        let Some(nv12) = converter.convert(&self.context, &texture) else {
            return;
        };
        drop(converter);

        self.encoder
            .encode(&nv12, timestamp, self.interval_micros());
    }
}

fn winrt_device(device: &ID3D11Device) -> WindowsResult<IDirect3DDevice> {
    let dxgi = device.cast::<IDXGIDevice>()?;
    let inspectable = unsafe { CreateDirect3D11DeviceFromDXGIDevice(&dxgi) }?;
    inspectable.cast()
}

pub struct Capture {
    session: GraphicsCaptureSession,
    pool: Direct3D11CaptureFramePool,
    encoder: Arc<Encoder>,
    audio: Option<audio::Capture>,
    _pipeline: Arc<Pipeline>,
}

unsafe impl Send for Capture {}
unsafe impl Sync for Capture {}

impl Capture {
    pub fn stop(self) {
        super::item::join_multithreaded_apartment();
        let _ = self.session.Close();
        let _ = self.pool.Close();
        if let Some(audio) = self.audio {
            audio.stop();
        }
        self.encoder.finish();
    }
}

pub fn start(
    item: GraphicsCaptureItem,
    quality: CaptureQuality,
    capture_audio: bool,
    target: audio::Target,
    sender: FrameSender,
) -> Result<Capture, NativeError> {
    let (device, context) = create_device()?;
    let winrt = winrt_device(&device).map_err(|error| {
        NativeError::failed(format!("could not prepare the capture device: {error}"))
    })?;

    let size = item
        .Size()
        .map_err(|_| NativeError::invalid_request("that source is no longer available"))?;
    let source_size = (size.Width.max(2) as u32, size.Height.max(2) as u32);

    let encoder = Arc::new(Encoder::new(quality, sender.clone())?);
    let converter = Converter::new(
        &device,
        source_size,
        (quality.width, quality.height),
        quality.framerate,
    )?;

    let pool = Direct3D11CaptureFramePool::CreateFreeThreaded(
        &winrt,
        DirectXPixelFormat::B8G8R8A8UIntNormalized,
        FRAME_POOL_BUFFERS,
        SizeInt32 {
            Width: source_size.0 as i32,
            Height: source_size.1 as i32,
        },
    )
    .map_err(|error| NativeError::failed(format!("could not open a capture buffer: {error}")))?;

    let session = pool.CreateCaptureSession(&item).map_err(|error| {
        NativeError::failed(format!("could not start capturing that source: {error}"))
    })?;

    let _ = session.SetIsCursorCaptureEnabled(true);
    let _ = session.SetIsBorderRequired(false);

    let pipeline = Arc::new(Pipeline {
        device,
        context,
        encoder: encoder.clone(),
        converter: Mutex::new(converter),
        quality,
        clock: Mutex::new(Clock::default()),
    });

    let handler = pipeline.clone();
    pool.FrameArrived(&TypedEventHandler::new(
        move |pool: windows::core::Ref<Direct3D11CaptureFramePool>, _| {
            if let Some(pool) = pool.as_ref() {
                handler.handle(pool);
            }
            Ok(())
        },
    ))
    .map_err(|error| NativeError::failed(format!("could not listen for frames: {error}")))?;

    let audio = if capture_audio {
        audio::start(target, sender).ok()
    } else {
        None
    };

    session.StartCapture().map_err(|error| {
        encoder.finish();
        NativeError::failed(format!("the screen capture never started: {error}"))
    })?;

    Ok(Capture {
        session,
        pool,
        encoder,
        audio,
        _pipeline: pipeline,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_matching_aspect_ratio_fills_the_whole_target() {
        let rect = fit((1920, 1080), (1280, 720));
        assert_eq!(rect.left, 0);
        assert_eq!(rect.top, 0);
        assert_eq!(rect.right - rect.left, 1280);
        assert_eq!(rect.bottom - rect.top, 720);
    }

    #[test]
    fn an_ultrawide_source_is_letterboxed_rather_than_squeezed() {
        let rect = fit((5120, 1440), (1920, 1080));
        let width = rect.right - rect.left;
        let height = rect.bottom - rect.top;

        assert_eq!(width, 1920);
        assert!(height < 1080);
        assert!((width as f64 / height as f64 - 5120.0 / 1440.0).abs() < 0.05);
        assert!(rect.top > 0);
    }

    #[test]
    fn a_portrait_source_is_pillarboxed_and_stays_portrait() {
        let rect = fit((600, 1400), (1920, 1080));
        let width = rect.right - rect.left;
        let height = rect.bottom - rect.top;

        assert!(height > width);
        assert!((width as f64 / height as f64 - 600.0 / 1400.0).abs() < 0.05);
        assert!(rect.left > 0);
    }

    #[test]
    fn the_fitted_rectangle_never_leaves_the_target() {
        for source in [(3840, 2160), (1024, 768), (5120, 1440), (600, 1400)] {
            let rect = fit(source, (1280, 720));
            assert!(rect.left >= 0 && rect.top >= 0);
            assert!(rect.right <= 1280 && rect.bottom <= 720);
        }
    }

    #[test]
    fn the_fitted_rectangle_uses_even_offsets_and_sizes_for_chroma() {
        let rect = fit((5120, 1440), (1920, 1080));
        assert_eq!(rect.left % 2, 0);
        assert_eq!(rect.top % 2, 0);
        assert_eq!((rect.right - rect.left) % 2, 0);
        assert_eq!((rect.bottom - rect.top) % 2, 0);
    }

    #[test]
    fn a_degenerate_source_still_produces_a_usable_rectangle() {
        let rect = fit((0, 0), (1280, 720));
        assert!(rect.right > rect.left);
        assert!(rect.bottom > rect.top);
    }
}
