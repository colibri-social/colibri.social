---
"@colibri-social/client": patch
---

Fixes Homebrew installs failing to launch on macOS with "the application is damaged and can't be opened".

The Homebrew cask wrote an install-channel marker into `Colibri Social.app/Contents/Resources/`, which invalidated the app bundle's code signature. Since Homebrew quarantines the app, Gatekeeper rejected it on first launch. Homebrew installs are now detected via the Caskroom directory instead, so nothing touches the signed bundle.
