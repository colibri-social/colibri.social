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

export default defineConfig({
	plugins: [launchScreen(), solid(), tailwindcss()],
	resolve: { dedupe: ["solid-js"] },
	server: { port: 5173, strictPort: true, host: true },
	build: { target: "es2022" },
});
