import { assetsDir } from "@colibri-social/assets/node";
import tailwindcss from "@tailwindcss/vite";
import devtools from "solid-devtools/vite";
import Icons from "unplugin-icons/vite";
import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";

export default defineConfig({
	plugins: [
		devtools(),
		solidPlugin(),
		tailwindcss(),
		Icons({ compiler: "solid" }),
	],
	// Serve the shared @colibri-social/assets files at the dev server root so the
	// app's root-absolute asset URLs (/twemoji.woff2, /login/*.svg, /logo.png, ...) resolve.
	publicDir: assetsDir,
	resolve: {
		dedupe: ["solid-js", "solid-js/web", "@solidjs/router"],
	},
	server: {
		host: "0.0.0.0",
		port: 4321,
	},
	build: {
		target: "esnext",
	},
});
