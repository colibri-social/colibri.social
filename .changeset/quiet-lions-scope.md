---
"@colibri-social/client": patch
"@colibri-social/lib": patch
---

Scopes What's New entries to the platforms they apply to. Every whatsnew block in a changeset now carries a required `platforms:` key holding a comma-separated list of `web`, `ios`, `android`, `macos`, `windows` and `linux`, with `all`, `mobile` and `desktop` as shorthands. The in-app popup and the What's New settings page render only the entries that name the platform the app is running on, and the App Store and Play release notes are rendered per platform through a new required `--platform` flag, falling back to a generic line when a release has nothing for that store.
