import node from "@astrojs/node";
import solidJs from "@astrojs/solid-js";
import starlight from "@astrojs/starlight";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, envField, fontProviders } from "astro/config";
import starlightSidebarTopics from "starlight-sidebar-topics";
import starlightThemeRapide from "starlight-theme-rapide";
import { vite as vidstack } from "vidstack/plugins";
import { loadEnv } from "vite";
import { colibriDark, colibriLight } from "./src/ec-theme.ts";
import { serverPortIntegration } from "./src/integrations/server-port";
import { SITE } from "./src/site.ts";

const { SENTRY_AUTH_TOKEN, SENTRY_RELEASE } = loadEnv(
	process.env.NODE_ENV!,
	process.cwd(),
	"",
);

// https://astro.build/config
export default defineConfig({
	site: SITE,
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
	},
	integrations: [
		solidJs(),
		serverPortIntegration(),
		starlight({
			title: "Colibri Social Documentation",
			logo: {
				light: "../../packages/assets/brand/hummingbird-dark.svg",
				dark: "../../packages/assets/brand/hummingbird-no-background.svg",
				alt: "",
			},
			plugins: [
				starlightThemeRapide(),
				starlightSidebarTopics([
					{
						label: "Users",
						link: "/docs/",
						icon: "open-book",
						items: [
							{ slug: "docs", label: "Start here" },
							{
								label: "Getting started",
								items: [
									{ autogenerate: { directory: "docs/users/getting-started" } },
								],
							},
							{
								label: "Messages",
								items: [
									{ autogenerate: { directory: "docs/users/messaging" } },
								],
							},
							{
								label: "Spaces",
								items: [{ autogenerate: { directory: "docs/users/spaces" } }],
							},
							{
								label: "Using Colibri",
								items: ["docs/users/notifications", "docs/users/voice"],
							},
							{
								label: "Your account",
								items: [{ autogenerate: { directory: "docs/users/account" } }],
							},
							{
								label: "Integrations",
								items: [
									{ autogenerate: { directory: "docs/users/integrations" } },
								],
							},
							{
								label: "Bridges",
								items: [{ autogenerate: { directory: "docs/users/bridges" } }],
							},
						],
					},
					{
						label: "Developers",
						link: "/docs/developers/",
						icon: "laptop",
						items: [
							{ slug: "docs/developers", label: "Start here" },
							{
								label: "Architecture",
								items: [
									{
										autogenerate: { directory: "docs/developers/architecture" },
									},
								],
							},
							{
								label: "Specification",
								items: [
									{
										autogenerate: {
											directory: "docs/developers/specification",
										},
									},
								],
							},
							{
								label: "Bridges",
								items: [
									{ autogenerate: { directory: "docs/developers/bridges" } },
								],
							},
							{
								label: "Development",
								items: [
									{
										autogenerate: { directory: "docs/developers/development" },
									},
								],
							},
							{
								label: "Self-Hosting",
								items: [
									{
										autogenerate: { directory: "docs/developers/self-hosting" },
									},
								],
							},
							{
								label: "Contributing",
								items: [
									{
										autogenerate: { directory: "docs/developers/contributing" },
									},
								],
							},
						],
					},
				]),
			],
			components: {
				Head: "./src/components/docs/Head.astro",
			},
			routeMiddleware: "./src/lib/og/docs-route-data.ts",
			customCss: [
				"@fontsource-variable/hanken-grotesk/wght.css",
				"./src/styles/docs.css",
			],
			expressiveCode: {
				themes: [colibriLight, colibriDark],
			},
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
			GITHUB_SPONSORS_TOKEN: envField.string({
				context: "server",
				access: "secret",
				optional: true,
			}),
			TURSO_DATABASE_URL: envField.string({
				context: "server",
				access: "secret",
				optional: true,
			}),
			TURSO_AUTH_TOKEN: envField.string({
				context: "server",
				access: "secret",
				optional: true,
			}),
			MAINTENANCE: envField.boolean({
				context: "server",
				access: "public",
				default: false,
			}),
		},
	},
	security: {
		allowedDomains: [
			{ hostname: "colibri.social", protocol: "https" },
			{ hostname: "next.colibri.social", protocol: "https" },
			{ hostname: "spaces.colibri.social", protocol: "https" },
		],
	},
	image: {
		remotePatterns: [
			{
				protocol: "https",
			},
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
		"/docs/architecture/appview": "/docs/developers/architecture/appview",
		"/docs/architecture/client": "/docs/developers/architecture/client",
		"/docs/architecture/communities":
			"/docs/developers/architecture/communities",
		"/docs/architecture/moderation": "/docs/developers/architecture/moderation",
		"/docs/architecture/spaces": "/docs/developers/architecture/spaces",
		"/docs/architecture/sync": "/docs/developers/architecture/sync",
		"/docs/bridges/building-a-bridge":
			"/docs/developers/bridges/building-a-bridge",
		"/docs/bridges/overview": "/docs/users/bridges",
		"/docs/bridges/pairing": "/docs/users/bridges/pairing",
		"/docs/bridges/reference": "/docs/developers/bridges/reference",
		"/docs/contributing/overview": "/docs/developers/contributing/overview",
		"/docs/development/appview": "/docs/developers/development/appview",
		"/docs/development/client": "/docs/developers/development/client",
		"/docs/development/errors": "/docs/developers/development/errors",
		"/docs/development/native": "/docs/developers/development/native",
		"/docs/development/overview": "/docs/developers/development/overview",
		"/docs/development/pds": "/docs/developers/development/pds",
		"/docs/development/testing": "/docs/developers/development/testing",
		"/docs/help/delete-account": "/docs/users/account/delete-account",
		"/docs/help/legacy-communities": "/docs/users/spaces/legacy-communities",
		"/docs/help/moderating-across-appviews": "/docs/users/spaces/appviews",
		"/docs/help/spaces-migration": "/docs/users/spaces/moving-to-spaces",
		"/docs/self-hosting/getting-started":
			"/docs/developers/self-hosting/getting-started",
		"/docs/specification/appview": "/docs/developers/specification/appview",
		"/docs/specification/facets": "/docs/developers/specification/facets",
		"/docs/specification/lexicons": "/docs/developers/specification/lexicons",
	},
});
