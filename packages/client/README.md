# @colibri-social/client

The application UI, built with [SolidJS](https://www.solidjs.com). It is shipped as a library rather than a standalone app so it can be embedded by more than one host.

## Getting started

Most of the time you work the client by running `pnpm dev:client` from the root.

## Scripts

- `dev` / `start`: serve the app with Vite
- `build`: bundle the library with [tsdown](https://tsdown.dev) and compile Tailwind to `dist/index.css`

## Exports

Consumers import from a few entry points (see `package.json`s `exports`):

- `@colibri-social/client`: the app / components
- `@colibri-social/client/scopes`: AT Protocol OAuth scope definitions
- `@colibri-social/client/index.css`: the compiled stylesheet
