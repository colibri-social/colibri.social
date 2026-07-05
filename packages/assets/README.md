# @colibri-social/assets

Shared static assets used across Colibri. Fonts, sounds, logos, emoji, and the login screen imagery, and their manifests.

The website copies them into place at dev/build time via the `sync-assets` script.

## Getting started

Import assets from another workspace package:

```ts
import {} from /* ... */ "@colibri-social/assets";
```

Available entry points (see `package.json` → `exports`): `.`, `./node`, `./fonts.css`, and `./files/*`.

## Scripts

- `build`: regenerate the manifest (`node scripts/generate-manifest.mjs`). Run this after adding or renaming files in `files/`.
