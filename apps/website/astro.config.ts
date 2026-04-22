import { defineConfig, envField, fontProviders } from "astro/config";
import node from "@astrojs/node";
import tailwindcss from "@tailwindcss/vite";
import solidJs from "@astrojs/solid-js";
import { loadEnv } from "vite";
import { vite as vidstack } from "vidstack/plugins";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import starlightThemeRapide from "starlight-theme-rapide";
import starlight from "@astrojs/starlight";
import { colibriDark, colibriLight } from "./src/ec-theme.ts";
import { serverPortIntegration } from "./src/integrations/server-port";

const { REDIS_PASSWORD, REDIS_URL, REDIS_PORT, SENTRY_AUTH_TOKEN } = loadEnv(
	process.env.NODE_ENV!,
	process.cwd(),
	"",
);

// https://astro.build/config
export default defineConfig({
	site: "https://colibri.social",
	adapter: node({
		mode: "standalone",
	}),
	output: "server",
	vite: {
		build: {
			sourcemap: true,
		},
		plugins: [
			tailwindcss(),
			vidstack(),
			sentryVitePlugin({
				authToken: SENTRY_AUTH_TOKEN,
				org: "colibri-social",
				project: "javascript-astro",
			}),
		],
		optimizeDeps: {
			exclude: ["solid-phosphor"], // Vite thinks the JSX here is React
		},
	},
	integrations: [
		solidJs(),
		serverPortIntegration(),
		starlight({
			title: "Colibri Social Documentation",
			plugins: [starlightThemeRapide()],
			customCss: [
				"@fontsource-variable/hanken-grotesk/wght.css",
				"./src/styles/docs.css",
			],
			expressiveCode: {
				themes: [colibriLight, colibriDark],
			},
			sidebar: [
				{ slug: "docs" },
				{
					label: "Architecture",
					autogenerate: { directory: "docs/architecture" },
				},
				{
					label: "Specification",
					autogenerate: { directory: "docs/specification" },
				},
				{
					label: "Contributing",
					autogenerate: { directory: "docs/contributing" },
				},
			],
			disable404Route: true,
			favicon: "/logo.png",
		}),
	],
	env: {
		schema: {
			PRIVATE_KEY_1: envField.string({ context: "server", access: "secret" }),
			PRIVATE_KEY_2: envField.string({ context: "server", access: "secret" }),
			INVITE_API_KEY: envField.string({ context: "server", access: "secret" }),
			LIVEKIT_API_KEY: envField.string({ context: "server", access: "secret" }),
			LIVEKIT_API_SECRET: envField.string({
				context: "server",
				access: "secret",
			}),
			LIVEKIT_SERVER_URL: envField.string({
				context: "client",
				access: "public",
				optional: true,
				default: "wss://livekit.colibri.social",
			}),
			APPVIEW_DOMAIN: envField.string({ context: "client", access: "public" }),
			SAME_TLD_DID: envField.string({
				context: "server",
				access: "public",
				optional: true,
			}),
			REDIS_URL: envField.string({
				context: "server",
				access: "secret",
				optional: true,
			}),
			REDIS_PASSWORD: envField.string({ context: "server", access: "secret" }),
			SENTRY_DSN: envField.string({
				context: "client",
				access: "public",
				optional: true,
			}),
		},
	},
	security: {
		allowedDomains: [
			{ hostname: "colibri.social", protocol: "https" },
			{ hostname: "example.com", protocol: "https" }, // Temporary until Astro 5.18
		],
		actionBodySizeLimit: 10 * 1024 * 1024,
	},
	fonts: [
		{
			provider: fontProviders.google(),
			name: "Hanken Grotesk",
			weights: ["100 900"],
			cssVariable: "--font-hanken-grotesk",
		},
		{
			provider: fontProviders.google(),
			name: "Geist Mono",
			weights: ["100 900"],
			cssVariable: "--font-geist-mono",
		},
		{
			provider: fontProviders.fontshare(),
			name: "Stardom",
			weights: ["400"],
			cssVariable: "--font-stardom",
		},
	],
});
