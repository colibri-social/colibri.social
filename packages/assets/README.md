# @colibri-social/assets

Shared static assets used across Colibri. Fonts, sounds, logos, emoji, and the login screen imagery.

The website copies them into place at dev/build time via the `sync-assets` script.

## Getting started

Import assets from another workspace package:

```ts
import {} from /* ... */ "@colibri-social/assets";
```

Available entry points (see `package.json` → `exports`): `.`, `./node`, `./fonts.css`, and `./files/*`.

## Scripts

- `fetch-models`: download the noise-suppression model assets into `files/`.
- `fetch-emoji`: download the twemoji assets into `files/`.
- `fetch-all`: both of the above.
