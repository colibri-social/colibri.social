# Vendored crates

## wry

`wry/` is wry 0.55.1 from crates.io, the version `Cargo.lock` resolves, with one change. `Cargo.toml` points at it through `[patch.crates-io]`.

`src/android/kotlin/RustWebView.kt` overrides `onCreateInputConnection`. The override advertises the MIME types registered with `ViewCompat.setOnReceiveContentListener` through `EditorInfoCompat.setContentMimeTypes`, and wraps the connection with `InputConnectionCompat.createWrapper`, so keyboard content such as Gboard's clipboard images reaches `performReceiveContent`. Chromium's WebView doesn't do this on its own, so the keyboard otherwise hides image suggestions in the composer.

To update wry, copy the new release from the cargo registry into `wry/`, reapply the override, and bump the version here and in `Cargo.lock`.

## tauri-runtime-cef

`tauri-runtime-cef/` is the SableClient fork at rev `b83d02a135781b8d73d8d12d70a590d5063180a1`, the rev `Cargo.toml` names, without `examples/` and the Nix flake. `Cargo.toml` points at it through `[patch."https://github.com/SableClient/tauri-runtime-cef"]`.

The Wayland backend sets the window icon. `WindowBuilder::icon` keeps the RGBA data on `AppWindowAttrs`, and `src/wayland/window.rs` turns it into a CEF `Image` for `set_window_icon` and `set_window_app_icon` when the window is created and on `WindowMessage::SetIcon`. Without it, Chromium sends its own logo through `xdg-toplevel-icon-v1`, and KDE Plasma shows that logo for the window.

To update the fork, copy the new rev from `~/.cargo/git/checkouts/` into `tauri-runtime-cef/`, reapply the icon change, and bump the rev here and in `Cargo.toml`.
