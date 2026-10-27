# Vendored crates

## wry

`wry/` is wry 0.55.1 from crates.io, the version `Cargo.lock` resolves, with the changes below. `Cargo.toml` points at it through `[patch.crates-io]`.

`src/android/kotlin/RustWebView.kt` overrides `onCreateInputConnection`. The override advertises the MIME types registered with `ViewCompat.setOnReceiveContentListener` through `EditorInfoCompat.setContentMimeTypes`, and wraps the connection with `InputConnectionCompat.createWrapper`, so keyboard content such as Gboard's clipboard images reaches `performReceiveContent`. Chromium's WebView doesn't do this on its own, so the keyboard otherwise hides image suggestions in the composer.

`src/webview2/mod.rs` and `src/lib.rs` strip WebView2's browser features so the Windows app behaves like a native one:

- Browser accelerator keys are off by default, which removes print, find, reload, zoom, caret browsing and the other Edge shortcuts. Text editing shortcuts keep working.
- The context menu keeps only editing, emoji and spelling items, plus Inspect when devtools are enabled.
- A download with no app handler opens the native Save dialog instead of the Edge download flyout.
- Password autosave, SmartScreen reputation checks and the built-in error page are off.
- Microphone, camera and notification requests from `tauri.localhost` are allowed without the Edge permission prompt.

To update wry, copy the new release from the cargo registry into `wry/`, reapply these changes, and bump the version here and in `Cargo.lock`.

## tauri-runtime-cef

`tauri-runtime-cef/` is the SableClient fork at rev `b83d02a135781b8d73d8d12d70a590d5063180a1`, the rev `Cargo.toml` names, without `examples/` and the Nix flake. `Cargo.toml` points at it through `[patch."https://github.com/SableClient/tauri-runtime-cef"]`.

The Wayland backend sets the window icon. `WindowBuilder::icon` keeps the RGBA data on `AppWindowAttrs`, and `src/wayland/window.rs` turns it into a CEF `Image` for `set_window_icon` and `set_window_app_icon` when the window is created and on `WindowMessage::SetIcon`. Without it, Chromium sends its own logo through `xdg-toplevel-icon-v1`, and KDE Plasma shows that logo for the window.

The Wayland backend sets the Wayland app ID to the executable name, so it matches the `StartupWMClass` of the installed `.desktop` file and the desktop shows the app's name and icon. It writes the ID as a string that CEF owns, because cef-rs turns an owned `CefString` into an empty string when it writes `LinuxWindowProperties` back.

`src/wayland/window.rs` reads the window size from `Window::bounds` and applies `set_size` through `Window::set_size`, so `tauri-plugin-window-state` saves and restores the size. Window positions stay unsupported on Wayland.

The fork also strips Chrome's browser features from the Linux app:

- `src/cef_impl/client/command.rs` adds a `CommandHandler` that swallows every Chrome command except clipboard, editing, spelling and emoji commands, plus devtools commands when devtools are enabled. It also hides the Chrome app menu, page action icons and toolbar buttons.
- `src/cef_impl/client/keyboard.rs` marks more Chrome accelerators as browser shortcuts, such as F1, F3, F7, F10, Ctrl+U, Ctrl+D, Ctrl+E, Ctrl+K, the zoom keys, Ctrl+Shift+Delete/Q/A/M/B, Alt+Home and Alt+F/E. The page still receives these keys.
- `src/cef_impl/client/context_menu.rs` keeps only the menu items that `command.rs` allows.
- `src/cef_impl/client/download.rs` opens the native Save dialog when the app has no download handler.
- `src/cef_impl/request_context.rs` turns off printing, autofill, the password manager, translation and the download bubble through Chrome preferences.
- `src/webview.rs` injects a script that cancels Ctrl+wheel zoom when zoom hotkeys are disabled.

The Chrome command IDs come from Chromium's `chrome/app/chrome_command_ids.h`. Check them against the Chromium version of a new CEF release.

To update the fork, copy the new rev from `~/.cargo/git/checkouts/` into `tauri-runtime-cef/`, reapply these changes, the icon change and the app ID and size changes, and bump the rev here and in `Cargo.toml`.
