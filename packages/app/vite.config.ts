import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
	plugins: [solid(), tailwindcss()],
	resolve: { dedupe: ["solid-js"] },
	server: { port: 5173, strictPort: true, host: true },
	build: { target: "es2022" },
});
