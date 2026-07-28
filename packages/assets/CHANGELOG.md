# @colibri-social/assets

## 0.0.2-rc.2

### Patch Changes

- c57c2ea: Make `tsc --noEmit` pass on the client: enable `skipLibCheck`, fix the duplicate-key spreads in the voice member-state updates, type the uploaded-files reset as `Set<File>`, return an `ArrayBuffer`-backed `Uint8Array` from the VAPID key decoder, and add type declarations for the assets package's `node` and `vite-verbatim-noise` entries. No runtime behaviour changes.

## 0.0.2-rc.1

### Patch Changes

- 32fd184: Improves emoji handling by serving images locally instead of relying on CDN
- b3c9635: Moves twemoji to tauri bundled resources

## 0.0.2-rc.0

### Patch Changes

- abc0d59: Adds better emoji handling and twemoji fallbacks
