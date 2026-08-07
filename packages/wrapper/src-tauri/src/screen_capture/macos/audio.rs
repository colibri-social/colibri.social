use std::ptr::NonNull;

use objc2_core_audio_types::{AudioBuffer, AudioBufferList};
use objc2_core_foundation::CFRetained;
use objc2_core_media::{
    kCMSampleBufferFlag_AudioBufferList_Assure16ByteAlignment, CMBlockBuffer, CMSampleBuffer,
};

use crate::screen_capture::CaptureMessage;

pub const MAX_CHANNELS: usize = 2;

pub fn pcm_message(sample: &CMSampleBuffer) -> Option<CaptureMessage> {
    let mut needed: usize = 0;
    unsafe {
        sample.audio_buffer_list_with_retained_block_buffer(
            &mut needed,
            std::ptr::null_mut(),
            0,
            None,
            None,
            0,
            std::ptr::null_mut(),
        );
    }

    if needed == 0 {
        return None;
    }

    let mut storage = vec![0u8; needed];
    let list = storage.as_mut_ptr().cast::<AudioBufferList>();
    let mut block: *mut CMBlockBuffer = std::ptr::null_mut();

    let status = unsafe {
        sample.audio_buffer_list_with_retained_block_buffer(
            std::ptr::null_mut(),
            list,
            needed,
            None,
            None,
            kCMSampleBufferFlag_AudioBufferList_Assure16ByteAlignment,
            &mut block,
        )
    };

    let _owned = NonNull::new(block).map(|ptr| unsafe { CFRetained::from_raw(ptr) });

    if status != 0 {
        return None;
    }

    let count = (unsafe { (*list).mNumberBuffers } as usize).min(MAX_CHANNELS);
    if count == 0 {
        return None;
    }

    let buffers = unsafe {
        std::slice::from_raw_parts(
            std::ptr::addr_of!((*list).mBuffers).cast::<AudioBuffer>(),
            count,
        )
    };

    let planes: Vec<&[u8]> = buffers
        .iter()
        .filter_map(|buffer| {
            let data = buffer.mData;
            if data.is_null() || buffer.mDataByteSize == 0 {
                return None;
            }
            Some(unsafe {
                std::slice::from_raw_parts(data.cast::<u8>(), buffer.mDataByteSize as usize)
            })
        })
        .collect();

    if planes.is_empty() {
        return None;
    }

    let plane_len = planes.iter().map(|plane| plane.len()).min()?;
    let frames = (plane_len / std::mem::size_of::<f32>()) as u32;
    if frames == 0 {
        return None;
    }

    let mut data = Vec::with_capacity(plane_len * planes.len());
    for plane in &planes {
        data.extend_from_slice(&plane[..plane_len]);
    }

    Some(CaptureMessage::Audio {
        channels: planes.len() as u8,
        frames,
        data,
    })
}
