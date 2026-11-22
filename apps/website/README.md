# @colibri-social/website

The [Astro](https://astro.build) app behind [colibri.social](https://colibri.social). It serves the marketing site, the web client at `/app`, and the [Starlight](https://starlight.astro.build)-powered docs.

## Getting started

Run these from the repository root. The [root README](../../README.md) lists the prerequisites.

```sh
pnpm build
pnpm dev:web
```

The dev server listens on port `4321`. The website serves the client's built output at `/app`, so build the workspace once before starting it.

`dev`, `build` and `preview` all run `sync-assets` first, which copies shared files out of `@colibri-social/assets`.

The website reads its variables from a `.env` file in the repository root, with `.env.example` as the template. All of them are optional.

[Client development](https://colibri.social/docs/developers/development/client#running-the-website) covers the website in more detail.

## Lexicons

The lexicons rendered on the docs site come from `@colibri-social/lexicons`, published from the [AppView repository](https://github.com/colibri-social/api). Author a protocol change there. After updating the package, run `pnpm lexicons:export` from the repository root to regenerate `src/utils/atproto/lexicons/generated/`.
