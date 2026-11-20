# Colibri

![Let your community spread its wings](https://colibri.social/og.png)

Colibri is an open source chat app built on the [AT Protocol](https://atproto.com). People create Spaces, manage members and roles, and talk in text and voice channels, and their messages live in their own repositories. This repository holds the client, its component library, the native shell and the website behind [colibri.social](https://colibri.social). The AppView lives in [colibri-social/api](https://github.com/colibri-social/api).

## Packages

This is a [pnpm](https://pnpm.io) monorepo.

| Package                                                                     | Path                         | Description                                                             |
| --------------------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------- |
| [`@colibri-social/website`](apps/website/README.md)                         | `apps/website`               | The marketing site and the docs. It serves the web client at `/app`.    |
| `@colibri-social/app`                                                       | `packages/app`               | The SolidJS client                                                      |
| `@colibri-social/ui`                                                        | `packages/ui`                | The component library, with its Storybook                               |
| [`@colibri-social/wrapper`](packages/wrapper/README.md)                     | `packages/wrapper`           | The native app shell, built with Tauri                                  |
| [`@colibri-social/lib`](packages/lib/README.md)                             | `packages/lib`               | Shared code: XRPC types, errors, logging, facets and markdown           |
| [`@colibri-social/assets`](packages/assets/README.md)                       | `packages/assets`            | Shared static assets: fonts, sounds, logos and emoji                    |
| [`@colibri-social/standard-renderer`](packages/standard-renderer/README.md) | `packages/standard-renderer` | A renderer for [standard.site](https://standard.site) documents         |

## Quick start

Requires Node.js `^24.22.3` and pnpm `11.17.0`. Run `corepack enable` to get the pinned pnpm version.

```sh
git clone https://github.com/colibri-social/colibri.social.git
cd colibri.social
pnpm install
pnpm dev:app
```

Open `http://127.0.0.1:5173`. The client talks to `https://spaces-api.colibri.social` by default. To use another AppView, copy `packages/app/.env.example` to `packages/app/.env` and set `VITE_COLIBRI_APPVIEW_URL`.

## Documentation

The docs live at [colibri.social/docs](https://colibri.social/docs).

- [Development overview](https://colibri.social/docs/developers/development/overview): run the client, an AppView and a PDS together.
- [Client development](https://colibri.social/docs/developers/development/client): setup, environment variables, tests, the website, linting and changesets.
- [Testing native builds](https://colibri.social/docs/developers/development/native): build and install the desktop, Android and iOS apps.
- [Client architecture](https://colibri.social/docs/developers/architecture/client): how the client talks to an AppView.
- [Contributing](https://colibri.social/docs/developers/contributing/overview): pull requests, checks and conventions.

## License

This project is open source. See the [LICENSE](LICENSE) file for details.
