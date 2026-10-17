# Vendored crates

## wry

`wry/` is wry 0.55.1 from crates.io, the version `Cargo.lock` resolves, with one change. `Cargo.toml` points at it through `[patch.crates-io]`.

`src/android/kotlin/RustWebView.kt` overrides `onCreateInputConnection`. The override advertises the MIME types registered with `ViewCompat.setOnReceiveContentListener` through `EditorInfoCompat.setContentMimeTypes`, and wraps the connection with `InputConnectionCompat.createWrapper`, so keyboard content such as Gboard's clipboard images reaches `performReceiveContent`. Chromium's WebView doesn't do this on its own, so the keyboard otherwise hides image suggestions in the composer.

To update wry, copy the new release from the cargo registry into `wry/`, reapply the override, and bump the version here and in `Cargo.lock`.
