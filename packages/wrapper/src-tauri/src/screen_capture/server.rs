use base64::Engine;
use futures_util::SinkExt;
use tokio::net::TcpListener;
use tokio::sync::mpsc::UnboundedReceiver;
use tokio_tungstenite::tungstenite::Message;

use super::{CaptureMessage, CaptureSession, EncodedConfig};
use crate::native_error::NativeError;

pub struct ServerHandle {
    shutdown: tokio::sync::oneshot::Sender<()>,
}

impl ServerHandle {
    pub fn stop(self) {
        let _ = self.shutdown.send(());
    }
}

pub struct Server {
    pub session: CaptureSession,
    pub handle: ServerHandle,
}

fn random_token() -> Result<String, NativeError> {
    let mut bytes = [0u8; 32];
    getrandom::fill(&mut bytes)
        .map_err(|error| NativeError::failed(format!("could not seed a capture token: {error}")))?;
    Ok(base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes))
}

fn config_frame(config: &EncodedConfig) -> Message {
    let description = base64::engine::general_purpose::STANDARD.encode(&config.description);
    Message::Text(
        serde_json::json!({
            "type": "config",
            "codec": config.codec,
            "description": description,
            "codedWidth": config.coded_width,
            "codedHeight": config.coded_height,
        })
        .to_string()
        .into(),
    )
}

const KIND_VIDEO: u8 = 0;
const KIND_AUDIO: u8 = 1;

fn frame_message(keyframe: bool, timestamp_micros: i64, data: &[u8]) -> Message {
    let mut framed = Vec::with_capacity(data.len() + 10);
    framed.push(KIND_VIDEO);
    framed.push(u8::from(keyframe));
    framed.extend_from_slice(&timestamp_micros.to_be_bytes());
    framed.extend_from_slice(data);
    Message::Binary(framed.into())
}

fn audio_message(channels: u8, frames: u32, data: &[u8]) -> Message {
    let mut framed = Vec::with_capacity(data.len() + 6);
    framed.push(KIND_AUDIO);
    framed.push(channels);
    framed.extend_from_slice(&frames.to_be_bytes());
    framed.extend_from_slice(data);
    Message::Binary(framed.into())
}

#[allow(clippy::result_large_err)]
pub async fn spawn(mut receiver: UnboundedReceiver<CaptureMessage>) -> Result<Server, NativeError> {
    let token = random_token()?;
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.map_err(|error| {
        NativeError::failed(format!("could not open a capture socket: {error}"))
    })?;
    let port = listener
        .local_addr()
        .map_err(|error| NativeError::failed(format!("capture socket has no address: {error}")))?
        .port();

    let (shutdown, mut shutdown_rx) = tokio::sync::oneshot::channel();
    let expected = token.clone();

    tauri::async_runtime::spawn(async move {
        let accepted = tokio::select! {
            result = listener.accept() => result.ok(),
            _ = &mut shutdown_rx => None,
        };

        let Some((stream, _)) = accepted else {
            return;
        };

        let Ok(mut socket) = tokio_tungstenite::accept_hdr_async(
            stream,
            |request: &tokio_tungstenite::tungstenite::handshake::server::Request, response| {
                let authorized = request
                    .uri()
                    .query()
                    .and_then(|query| {
                        query
                            .split('&')
                            .find_map(|pair| pair.strip_prefix("token="))
                            .map(str::to_string)
                    })
                    .is_some_and(|candidate| candidate == expected);

                if authorized {
                    Ok(response)
                } else {
                    Err(tokio_tungstenite::tungstenite::http::Response::builder()
                        .status(403)
                        .body(None)
                        .expect("a 403 response is well formed"))
                }
            },
        )
        .await
        else {
            return;
        };

        loop {
            let message = tokio::select! {
                message = receiver.recv() => message,
                _ = &mut shutdown_rx => None,
            };

            let Some(message) = message else {
                break;
            };

            let outgoing = match message {
                CaptureMessage::Config(config) => config_frame(&config),
                CaptureMessage::Frame {
                    keyframe,
                    timestamp_micros,
                    data,
                } => frame_message(keyframe, timestamp_micros, &data),
                CaptureMessage::Audio {
                    channels,
                    frames,
                    data,
                } => audio_message(channels, frames, &data),
            };

            if socket.send(outgoing).await.is_err() {
                break;
            }
        }

        let _ = socket.close(None).await;
    });

    Ok(Server {
        session: CaptureSession {
            url: format!("ws://127.0.0.1:{port}"),
            token,
        },
        handle: ServerHandle { shutdown },
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_frame_carries_its_keyframe_flag_and_timestamp() {
        let Message::Binary(framed) = frame_message(true, 1_234_567, &[7, 8, 9]) else {
            panic!("frames are binary");
        };

        assert_eq!(framed[0], KIND_VIDEO);
        assert_eq!(framed[1], 1);
        assert_eq!(
            i64::from_be_bytes(framed[2..10].try_into().expect("eight bytes")),
            1_234_567
        );
        assert_eq!(&framed[10..], &[7, 8, 9]);
    }

    #[test]
    fn a_delta_frame_is_flagged_as_such() {
        let Message::Binary(framed) = frame_message(false, 0, &[1]) else {
            panic!("frames are binary");
        };

        assert_eq!(framed[0], KIND_VIDEO);
        assert_eq!(framed[1], 0);
    }

    #[test]
    fn audio_carries_its_channel_count_and_frame_count() {
        let payload: Vec<u8> = (0..32).collect();
        let Message::Binary(framed) = audio_message(2, 4, &payload) else {
            panic!("audio is binary");
        };

        assert_eq!(framed[0], KIND_AUDIO);
        assert_eq!(framed[1], 2);
        assert_eq!(
            u32::from_be_bytes(framed[2..6].try_into().expect("four bytes")),
            4
        );
        assert_eq!(&framed[6..], &payload[..]);
    }

    #[test]
    fn audio_and_video_are_told_apart_by_their_first_byte() {
        let Message::Binary(video) = frame_message(true, 0, &[1]) else {
            panic!("frames are binary");
        };
        let Message::Binary(audio) = audio_message(1, 1, &[0, 0, 0, 0]) else {
            panic!("audio is binary");
        };

        assert_ne!(video[0], audio[0]);
    }

    #[test]
    fn the_config_frame_base64s_the_codec_description() {
        let Message::Text(text) = config_frame(&EncodedConfig {
            codec: "avc1.640028".to_string(),
            description: vec![1, 2, 3],
            coded_width: 1920,
            coded_height: 1080,
        }) else {
            panic!("the config frame is text");
        };

        let parsed: serde_json::Value = serde_json::from_str(&text).expect("valid json");
        assert_eq!(parsed["type"], "config");
        assert_eq!(parsed["codec"], "avc1.640028");
        assert_eq!(parsed["description"], "AQID");
        assert_eq!(parsed["codedWidth"], 1920);
    }

    #[test]
    fn tokens_are_unpredictable() {
        let first = random_token().expect("token");
        let second = random_token().expect("token");
        assert_ne!(first, second);
        assert!(first.len() >= 40, "{first}");
    }
}
