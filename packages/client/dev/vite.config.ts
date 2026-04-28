import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import devtools from "solid-devtools/vite";
import tailwindcss from "@tailwindcss/vite";
import Icons from "unplugin-icons/vite";

export default defineConfig({
	plugins: [devtools(), solidPlugin(), tailwindcss(), Icons({ compiler: "solid" })],
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
