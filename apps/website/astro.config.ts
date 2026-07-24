import node from "@astrojs/node";
import solidJs from "@astrojs/solid-js";
import starlight from "@astrojs/starlight";
import { verbatimNoiseAssets } from "@colibri-social/assets/vite-verbatim-noise";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, envField, fontProviders } from "astro/config";
import starlightThemeRapide from "starlight-theme-rapide";
import { vite as vidstack } from "vidstack/plugins";
import { loadEnv } from "vite";
import { colibriDark, colibriLight } from "./src/ec-theme.ts";
import { serverPortIntegration } from "./src/integrations/server-port";

const { SENTRY_AUTH_TOKEN, SENTRY_RELEASE } = loadEnv(
	process.env.NODE_ENV!,
	process.cwd(),
	"",
);

// https://astro.build/config
export default defineConfig({
	// TODO(release): Change before release
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
			verbatimNoiseAssets(),
			tailwindcss(),
			vidstack(),
			sentryVitePlugin({
				authToken: SENTRY_AUTH_TOKEN,
				org: "colibri-social",
				project: "javascript-astro",
				release: SENTRY_RELEASE
					? {
							name: SENTRY_RELEASE,
							setCommits: {
								repo: "colibri-social/colibri.social",
								commit: SENTRY_RELEASE,
								auto: false,
								ignoreMissing: true,
							},
							deploy: { env: "production" },
						}
					: undefined,
				sourcemaps: {
					filesToDeleteAfterUpload: ["./dist/**/*.map"],
				},
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
			components: {
				Head: "./src/components/docs/Head.astro",
			},
			customCss: [
				"@fontsource-variable/hanken-grotesk/wght.css",
				"./src/styles/docs.css",
			],
			expressiveCode: {
				themes: [colibriLight, colibriDark],
			},
			sidebar: [
				{ slug: "docs", label: "Start here" },
				{
					label: "Architecture",
					items: [{ autogenerate: { directory: "docs/architecture" } }],
				},
				{
					label: "Specification",
					items: [{ autogenerate: { directory: "docs/specification" } }],
				},
				{
					label: "Contributing",
					items: [{ autogenerate: { directory: "docs/contributing" } }],
				},
				{
					label: "Self-Hosting",
					items: [{ autogenerate: { directory: "docs/self-hosting" } }],
				},
				{
					label: "Help",
					items: [{ autogenerate: { directory: "docs/help" } }],
				},
			],
			disable404Route: true,
			favicon: "/logo.png",
		}),
	],
	env: {
		schema: {
			SAME_TLD_DID: envField.string({
				context: "server",
				access: "public",
				optional: true,
			}),
			GITHUB_TOKEN: envField.string({
				context: "server",
				access: "secret",
				optional: true,
			}),
			TURSO_DATABASE_URL: envField.string({
				context: "server",
				access: "secret",
				optional: false,
			}),
			TURSO_AUTH_TOKEN: envField.string({
				context: "server",
				access: "secret",
				optional: false,
			}),
			SENTRY_DSN: envField.string({
				context: "client",
				access: "public",
				optional: true,
			}),
			SENTRY_RELEASE: envField.string({
				context: "client",
				access: "public",
				optional: true,
			}),
			PUBLIC_VAPID_KEY: envField.string({
				context: "client",
				access: "public",
				optional: true,
			}),
		},
	},
	security: {
		allowedDomains: [
			{ hostname: "colibri.social", protocol: "https" },
			// TODO(release): drop this staging domain once colibri.social is primary
			{ hostname: "next.colibri.social", protocol: "https" },
		],
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
