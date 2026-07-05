# @colibri-social/website

The [Astro](https://astro.build) app behind [colibri.social](https://colibri.social). It serves the marketing site, the web client, and [Starlight](https://starlight.astro.build)-powered docs.

## Getting started

From the repository root (see the [root README](../../README.md) for prerequisites and `.env` setup):

```bash
pnpm dev:web
```

`dev`, `build` and `preview` all run `sync-assets` first, which copies shared files out of `@colibri-social/assets`.
