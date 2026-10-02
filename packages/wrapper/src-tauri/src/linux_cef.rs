use std::io::{BufRead, BufReader, ErrorKind, Write};
use std::os::unix::fs::PermissionsExt;
use std::os::unix::net::{UnixListener, UnixStream};
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

use tauri::{AppHandle, Manager};
use tauri_runtime_cef::{CefConfig, DenyReason, PermissionKind, Verdict};

use crate::AppRuntime;

const IDENTIFIER: &str = "social.colibri.app";
const DEEP_LINK_SCHEMES: [&str; 2] = ["social.colibri", "social.colibri.spaces"];
const ACTIVATE: &str = "activate";
const MAIN_WINDOW: &str = "main";

static APP: OnceLock<AppHandle<AppRuntime>> = OnceLock::new();
static PENDING: Mutex<Vec<String>> = Mutex::new(Vec::new());

pub enum Launch {
    Primary,
    Handled,
}

pub fn bootstrap() -> Launch {
    if std::env::var_os("GDK_BACKEND").is_none() {
        std::env::set_var("GDK_BACKEND", "x11");
    }
    expose_cef_library_dir();

    tauri_runtime_cef::configure(CefConfig {
        identifier: IDENTIFIER.into(),
        custom_schemes: vec![
            "tauri".into(),
            "ipc".into(),
            "asset".into(),
            "emoji".into(),
            "capture-thumb".into(),
        ],
        deep_link_schemes: DEEP_LINK_SCHEMES.map(String::from).to_vec(),
        command_line_args: chromium_switches(),
        ..Default::default()
    });

    if std::env::args().any(|arg| arg.starts_with("--type=")) {
        tauri_runtime_cef::run_cef_helper_process();
        return Launch::Handled;
    }

    if forward_to_primary() {
        return Launch::Handled;
    }

    match UnixListener::bind(socket_path()) {
        Ok(listener) => listen(listener),
        Err(error) => {
            if forward_to_primary() {
                return Launch::Handled;
            }
            eprintln!("could not open the single-instance socket: {error}");
        }
    }

    tauri_runtime_cef::set_permission_policy(|request, responder| {
        let trusted = request.webview_label == MAIN_WINDOW
            && request
                .origin
                .as_ref()
                .is_some_and(|origin| origin.is_app_local());
        if !trusted {
            return responder.deny(DenyReason::PolicyDenied);
        }

        let verdicts = request
            .kinds
            .iter()
            .map(|kind| {
                if matches!(
                    kind,
                    PermissionKind::Microphone
                        | PermissionKind::Camera
                        | PermissionKind::ScreenCapture
                        | PermissionKind::Notifications
                        | PermissionKind::ClipboardRead
                ) {
                    Verdict::Allow
                } else {
                    Verdict::Deny
                }
            })
            .collect();
        responder.decide(verdicts);
    });

    Launch::Primary
}

pub fn attach(app: &AppHandle<AppRuntime>) {
    if let Err(error) = gtk::init() {
        eprintln!("could not initialize GTK: {error}");
    }
    tauri_runtime_cef::install_x_error_handlers();

    let pending = {
        let Ok(mut pending) = PENDING.lock() else {
            return;
        };
        let _ = APP.set(app.clone());
        std::mem::take(&mut *pending)
    };
    for message in pending {
        handle(app, message);
    }
}

fn expose_cef_library_dir() {
    let Some(exe_dir) = std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(PathBuf::from))
    else {
        return;
    };
    let Some(dir) = [exe_dir.clone(), exe_dir.join("../lib/colibri-social")]
        .into_iter()
        .find(|dir| dir.join("libcef.so").exists())
    else {
        return;
    };
    let mut paths = vec![dir];
    if let Some(existing) = std::env::var_os("LD_LIBRARY_PATH") {
        paths.extend(std::env::split_paths(&existing));
    }
    if let Ok(joined) = std::env::join_paths(paths) {
        std::env::set_var("LD_LIBRARY_PATH", joined);
    }
}

fn chromium_switches() -> Vec<(String, Option<String>)> {
    let mut switches = vec![
        ("--no-first-run".to_owned(), None),
        (
            "autoplay-policy".to_owned(),
            Some("no-user-gesture-required".to_owned()),
        ),
    ];
    if let Ok(port) = std::env::var("COLIBRI_DEVTOOLS") {
        let port = port
            .parse::<u16>()
            .ok()
            .filter(|port| *port >= 1024)
            .unwrap_or(9222);
        switches.push(("remote-debugging-port".to_owned(), Some(port.to_string())));
    }
    switches
}

fn is_deep_link(arg: &str) -> bool {
    DEEP_LINK_SCHEMES.iter().any(|scheme| {
        arg.strip_prefix(scheme)
            .is_some_and(|rest| rest.starts_with(':'))
    })
}

fn socket_path() -> PathBuf {
    let dir = std::env::var_os("XDG_RUNTIME_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir);
    dir.join(format!("{IDENTIFIER}.instance.sock"))
}

fn launch_messages() -> Vec<String> {
    let links: Vec<String> = std::env::args()
        .skip(1)
        .filter(|arg| is_deep_link(arg))
        .collect();
    if links.is_empty() {
        vec![ACTIVATE.to_owned()]
    } else {
        links
    }
}

fn forward_to_primary() -> bool {
    let path = socket_path();
    match UnixStream::connect(&path) {
        Ok(mut stream) => {
            let payload: String = launch_messages()
                .into_iter()
                .map(|message| message + "\n")
                .collect();
            stream.write_all(payload.as_bytes()).is_ok()
        }
        Err(error) => {
            if error.kind() == ErrorKind::ConnectionRefused {
                let _ = std::fs::remove_file(&path);
            }
            false
        }
    }
}

fn listen(listener: UnixListener) {
    let _ = std::fs::set_permissions(socket_path(), std::fs::Permissions::from_mode(0o600));
    std::thread::spawn(move || {
        for stream in listener.incoming().flatten() {
            for line in BufReader::new(stream).lines().map_while(Result::ok) {
                let line = line.trim();
                if line == ACTIVATE || is_deep_link(line) {
                    deliver(line.to_owned());
                }
            }
        }
    });
}

fn deliver(message: String) {
    let Ok(mut pending) = PENDING.lock() else {
        return;
    };
    match APP.get() {
        Some(app) => {
            let app = app.clone();
            drop(pending);
            let target = app.clone();
            let _ = app.run_on_main_thread(move || handle(&target, message));
        }
        None => pending.push(message),
    }
}

fn handle(app: &AppHandle<AppRuntime>, message: String) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }

    if message != ACTIVATE {
        use tauri_plugin_deep_link::DeepLinkExt;
        app.deep_link()
            .handle_cli_arguments([String::new(), message].into_iter());
    }
}
