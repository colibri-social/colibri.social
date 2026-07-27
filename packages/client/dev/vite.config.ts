import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { assetsDir } from "@colibri-social/assets/node";
import { verbatimNoiseAssets } from "@colibri-social/assets/vite-verbatim-noise";
import tailwindcss from "@tailwindcss/vite";
import devtools from "solid-devtools/vite";
import Icons from "unplugin-icons/vite";
import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";

const clientVersion = JSON.parse(
	readFileSync(
		fileURLToPath(new URL("../package.json", import.meta.url)),
		"utf8",
	),
).version as string;

const clientCommit = (() => {
	if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
	try {
		return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
			encoding: "utf8",
		}).trim();
	} catch {
		return "unknown";
	}
})();

export default defineConfig({
	plugins: [
		verbatimNoiseAssets(),
		devtools(),
		solidPlugin(),
		tailwindcss(),
		Icons({ compiler: "solid" }),
	],
	// Serve the shared @colibri-social/assets files at the dev server root so the
	// app's root-absolute asset URLs (/twemoji.woff2, /login/*.svg, /logo.png, ...) resolve.
	publicDir: assetsDir,
	define: {
		__CLIENT_VERSION__: JSON.stringify(clientVersion),
		__CLIENT_COMMIT__: JSON.stringify(clientCommit),
	},
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
