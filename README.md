# Colibri

![Let your community spread it's wings](https://github.com/colibri.social/og.png)

Colibri is an open source chat platform built on the [AT Protocol](https://atproto.com) for communities big and small. It gives you the ability to create communities, manage members, and communicate through text, voice, and forum channels, all while maintaining true ownership of your data.

Visit us at [colibri.social](https://colibri.social). You can learn more on our [about page](https://colibri.social/about).

## Repository layout

This is a [pnpm](https://pnpm.io) monorepo. The deployable app lives in `apps/`, and the code it shares lives in `packages/`.

| Package                                               | Path              | Description                                                             |
| ----------------------------------------------------- | ----------------- | ----------------------------------------------------------------------- |
| [`@colibri-social/website`](apps/website/README.md)   | `apps/website`    | Marketing site, docs, and host for the web client.                      |
| [`@colibri-social/client`](packages/client/README.md) | `packages/client` | The SolidJS client                                                      |
| [`@colibri-social/lib`](packages/lib/README.md)       | `packages/lib`    | Shared code: helpers, XRPC types, events, facets, and markdown          |
| [`@colibri-social/assets`](packages/assets/README.md) | `packages/assets` | Shared static assets (fonts, sounds, logos, emoji) and their manifests. |

## Getting started

### Prerequisites

- Node.js `^24.13.0`
- pnpm `10.33.0` (run `corepack enable` to have the right one picked up automatically)

### Setup

1. Clone and install:

   ```bash
   git clone https://github.com/colibri-social/colibri.social.git
   cd colibri.social
   pnpm install
   ```

2. Create a `.env` file in the repo root by copying `.env.example`.
3. Start the client dev server:

   ```bash
   pnpm dev:client
   ```

   The app will be available at `http://127.0.0.1:4321`. You must also run the AppView development server alondside this, please see the [AppView repository](https://github.com/colibri-social/appview) for more information.

## Common scripts

Run from the repository root:

- `pnpm lint`: check the whole workspace with [Biome](https://biomejs.dev)
- `pnpm lint:fix`: check and auto-fix
- `pnpm format`: format the whole workspace with Biome

## Contributing

Contributions are welcome! Please feel free to open issues and pull requests.

## License

This project is open source. See the [LICENSE](LICENSE) file for details.
