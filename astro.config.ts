import {
	defineConfig,
	envField,
	fontProviders,
	sessionDrivers,
} from "astro/config";

import node from "@astrojs/node";
import tailwindcss from "@tailwindcss/vite";
import solidJs from "@astrojs/solid-js";
import { loadEnv } from "vite";
import { vite as vidstack } from "vidstack/plugins";
import type { AstroIntegration } from "astro";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import starlightThemeRapide from "starlight-theme-rapide";
import starlight from "@astrojs/starlight";
import { colibriDark, colibriLight } from "./src/ec-theme.ts";

const { REDIS_PASSWORD, REDIS_URL, SENTRY_AUTH_TOKEN } = loadEnv(
	process.env.NODE_ENV!,
	process.cwd(),
	"",
);

const serverPortIntegration = (): AstroIntegration => {
	let serverPort: number | undefined;

	return {
		name: "server-port-virtual-module",
		hooks: {
			"astro:config:setup": ({ updateConfig }) => {
				updateConfig({
					vite: {
						plugins: [
							{
								name: "server-port-virtual-module",
								resolveId(id) {
									if (id === "virtual:server-port") {
										return "\0virtual:server-port";
									}
									return null;
								},
								load(id) {
									if (id === "\0virtual:server-port") {
										const port =
											typeof serverPort === "number" ? serverPort : 4321;
										return `export const serverPort = ${port};`;
									}
									return null;
								},
							},
						],
					},
				});
			},
			"astro:server:start": ({ address }) => {
				serverPort = address.port;
			},
		},
	};
};

// https://astro.build/config
export default defineConfig({
	site: "https://colibri.social",
	session: {
		driver: sessionDrivers.redis(
			process.env.NODE_ENV! === "production"
				? {
						url: REDIS_URL,
					}
				: {
						base: "unstorage",
						host: "127.0.0.1",
						port: 6379,
						password: REDIS_PASSWORD,
						tls: false as any,
					},
		),
		cookie: {
			name: "astro-session",
			maxAge: 720 * 60 * 60,
		},
	},
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
			title: "Colibri Social Docs",
			plugins: [starlightThemeRapide()],
			customCss: ["./src/styles/docs.css"],
			expressiveCode: {
				themes: [colibriLight, colibriDark],
			},
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
