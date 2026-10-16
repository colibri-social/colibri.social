import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { assetsDir } from "@colibri-social/assets/node";
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

export default defineConfig({
	plugins: [launchScreen(), worklets(), solid(), tailwindcss()],
	resolve: { dedupe: ["solid-js"] },
	server: { port: 5173, strictPort: true, host: true },
	build: { target: "es2022" },
});
