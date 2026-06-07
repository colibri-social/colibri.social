import node from "@astrojs/node";
import solidJs from "@astrojs/solid-js";
import starlight from "@astrojs/starlight";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, envField, fontProviders } from "astro/config";
import starlightThemeRapide from "starlight-theme-rapide";
import { vite as vidstack } from "vidstack/plugins";
import { loadEnv } from "vite";
import { colibriDark, colibriLight } from "./src/ec-theme.ts";
import { serverPortIntegration } from "./src/integrations/server-port";

const { SENTRY_AUTH_TOKEN } = loadEnv(process.env.NODE_ENV!, process.cwd(), "");

// https://astro.build/config
export default defineConfig({
	// TODO: Change before release
	site: "https://next.colibri.social",
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
			SAME_TLD_DID: envField.string({
				context: "server",
				access: "public",
				optional: true,
			}),
			SENTRY_DSN: envField.string({
				context: "client",
				access: "public",
				optional: true,
			}),
		},
	},
	security: {
		allowedDomains: [{ hostname: "colibri.social", protocol: "https" }],
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
	redirects: {
		"/login": "/app/login",
	},
});
