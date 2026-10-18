#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
pub enum NativeErrorCode {
    Cancelled,
    Unsupported,
    InvalidRequest,
    Failed,
}

#[derive(Debug, serde::Serialize)]
pub struct NativeError {
    pub code: NativeErrorCode,
    pub message: String,
}

impl NativeError {
    pub fn new(code: NativeErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    pub fn cancelled() -> Self {
        Self::new(NativeErrorCode::Cancelled, "the sign-in window was closed")
    }

    #[cfg_attr(any(target_os = "macos", target_os = "ios"), allow(dead_code))]
    pub fn unsupported() -> Self {
        Self::new(
            NativeErrorCode::Unsupported,
            "native web authentication is not available on this platform",
        )
    }

    pub fn invalid_request(message: impl Into<String>) -> Self {
        Self::new(NativeErrorCode::InvalidRequest, message)
    }

    pub fn failed(message: impl Into<String>) -> Self {
        Self::new(NativeErrorCode::Failed, message)
    }

    pub fn from_platform_message(message: &str) -> Self {
        match message {
            "canceled" => Self::cancelled(),
            "invalid authorization url" => Self::invalid_request(message),
            _ => Self::failed(message),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_closed_window_is_cancelled_rather_than_a_failure() {
        assert_eq!(
            NativeError::from_platform_message("canceled").code,
            NativeErrorCode::Cancelled
        );
    }

    #[test]
    fn a_bad_url_is_the_callers_mistake() {
        assert_eq!(
            NativeError::from_platform_message("invalid authorization url").code,
            NativeErrorCode::InvalidRequest
        );
    }

    #[test]
    fn anything_else_is_a_failure() {
        assert_eq!(
            NativeError::from_platform_message("authentication failed").code,
            NativeErrorCode::Failed
        );
    }

    #[test]
    fn the_code_serializes_as_its_name() {
        let json = serde_json::to_string(&NativeError::cancelled()).expect("serializes");
        assert!(json.contains("\"code\":\"Cancelled\""), "{json}");
    }
}
