---
"@colibri-social/client": patch
"@colibri-social/assets": patch
---

Make `tsc --noEmit` pass on the client: enable `skipLibCheck`, fix the duplicate-key spreads in the voice member-state updates, type the uploaded-files reset as `Set<File>`, return an `ArrayBuffer`-backed `Uint8Array` from the VAPID key decoder, and add type declarations for the assets package's `node` and `vite-verbatim-noise` entries. No runtime behaviour changes.
