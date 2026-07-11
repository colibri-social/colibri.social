import { fileURLToPath } from "node:url";
import { assetsDir } from "@colibri-social/assets/node";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

const host = process.env.TAURI_DEV_HOST;

// The client library externalizes `@sentry/solid`, so it gets re-bundled here.
// When DISABLE_SENTRY is set, alias it to local no-op stubs so the Sentry SDK
// is excluded from the wrapper bundle entirely (e.g. for F-Droid).
const disableSentry =
	process.env.DISABLE_SENTRY !== undefined && process.env.DISABLE_SENTRY !== "";

const stub = (relative: string) =>
	fileURLToPath(new URL(relative, import.meta.url));

const sentryAlias = disableSentry
	? [
			{
				find: /^@sentry\/solid\/solidrouter$/,
				replacement: stub("./src/stubs/sentry-solidrouter.ts"),
			},
			{
				find: /^@sentry\/solid$/,
				replacement: stub("./src/stubs/sentry-solid.ts"),
			},
		]
	: [];

// https://vite.dev/config/
export default defineConfig(async () => ({
	plugins: [solid()],

	// Serve the shared @colibri-social/assets files at the dev/build root so the
	// embedded client app's root-absolute asset URLs (/twemoji.woff2, /login/*.svg,
	// /logo.png, ...) resolve.
	publicDir: assetsDir,

	// The client library externalizes solid-js, so the wrapper must share a single
	// instance with it — otherwise render() and the library run on different copies.
	// Only the reactive runtime is deduped; the client's other externalized deps
	// resolve importer-relative from its own node_modules.
	resolve: {
		dedupe: ["solid-js", "solid-js/web"],
		alias: sentryAlias,
	},

	build: {
		target: "esnext",
	},

	// Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
	//
	// 1. prevent Vite from obscuring rust errors
	clearScreen: false,
	// 2. tauri expects a fixed port, fail if that port is not available
	server: {
		port: 1420,
		strictPort: true,
		host: host || false,
		hmr: host
			? {
					protocol: "ws",
					host,
					port: 1421,
				}
			: undefined,
		watch: {
			// 3. tell Vite to ignore watching `src-tauri`
			ignored: ["**/src-tauri/**"],
		},
	},
}));
