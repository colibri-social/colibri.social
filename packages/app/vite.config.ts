import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { assetsDir } from "@colibri-social/assets/node";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";
import solid from "vite-plugin-solid";
import {
	launchScreenDocumentHtml,
	launchScreenDocumentStyle,
} from "./src/shell/launch/launch-markup";

const ROOT_MARKUP = '<div id="root"></div>';

const launchScreen = (): Plugin => ({
	name: "colibri-launch-screen",
	transformIndexHtml: (html) => {
		if (!html.includes(ROOT_MARKUP)) {
			throw new Error("index.html needs an empty #root for the launch screen");
		}
		return html
			.replace("</head>", `${launchScreenDocumentStyle()}</head>`)
			.replace(ROOT_MARKUP, `${launchScreenDocumentHtml()}${ROOT_MARKUP}`);
	},
});

const WORKLETS = ["rnnoise.js"];

const worklets = (): Plugin => {
	const source = (name: string) => readFile(join(assetsDir, "worklets", name));
	return {
		name: "colibri-worklets",
		configureServer: (server) => {
			server.middlewares.use(async (request, response, next) => {
				const name = request.url?.match(/^\/worklets\/([^?]+)/)?.[1];
				if (!name || !WORKLETS.includes(name)) return next();
				try {
					response.setHeader("Content-Type", "text/javascript");
					response.end(await source(name));
				} catch (error) {
					next(error);
				}
			});
		},
		generateBundle: async function () {
			for (const name of WORKLETS) {
				this.emitFile({
					type: "asset",
					fileName: `worklets/${name}`,
					source: await source(name),
				});
			}
		},
	};
};

const disableSentry =
	process.env.DISABLE_SENTRY !== undefined && process.env.DISABLE_SENTRY !== "";

const sentryStub = disableSentry
	? [
			{
				find: /^@sentry\/solid$/,
				replacement: fileURLToPath(
					new URL("./src/sentry/stub.ts", import.meta.url),
				),
			},
		]
	: [];

const appVersion = process.env.VITE_APP_VERSION;
const uploadSentryRelease = process.env.SENTRY_RELEASE_UPLOAD === "1";

const sentryUpload =
	!disableSentry && appVersion && process.env.SENTRY_AUTH_TOKEN
		? [
				sentryVitePlugin({
					authToken: process.env.SENTRY_AUTH_TOKEN,
					org: "colibri-social",
					project: "javascript-solid",
					release: {
						name: appVersion,
						create: uploadSentryRelease,
						finalize: uploadSentryRelease,
						setCommits:
							uploadSentryRelease && process.env.GITHUB_SHA
								? {
										repo: "colibri-social/colibri.social",
										commit: process.env.GITHUB_SHA,
										auto: false,
										ignoreMissing: true,
									}
								: false,
						deploy: uploadSentryRelease ? { env: "production" } : false,
					},
					sourcemaps: {
						disable: uploadSentryRelease ? undefined : "disable-upload",
						filesToDeleteAfterUpload: ["./dist/**/*.map"],
					},
				}),
			]
		: [];

export default defineConfig({
	plugins: [
		launchScreen(),
		worklets(),
		solid(),
		tailwindcss(),
		...sentryUpload,
	],
	envPrefix: ["VITE_", "PUBLIC_VAPID_KEY"],
	resolve: { dedupe: ["solid-js"], alias: sentryStub },
	server: { port: 5173, strictPort: true, host: true },
	build: { target: "es2022", sourcemap: sentryUpload.length > 0 },
});
