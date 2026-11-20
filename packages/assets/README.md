# @colibri-social/assets

Shared static assets used across Colibri: fonts, sounds, logos, emoji, and the login screen imagery.

The website copies them into place at dev and build time with its `sync-assets` script.

## Getting started

Import assets from another workspace package:

```ts
import {} from /* ... */ "@colibri-social/assets";
```

The entry points are `.`, `./node`, `./fonts.css` and `./files/*`, defined under `exports` in `package.json`.

## Scripts

- `build-worklets`: bundles the RNNoise noise-suppression worklet into `files/worklets/`.
- `fetch-emoji`: downloads the Twemoji assets into `files/twemoji/`.
- `fetch-all`: runs both of the above.
