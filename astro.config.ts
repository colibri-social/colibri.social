import { defineConfig, envField, fontProviders } from 'astro/config';

import node from "@astrojs/node";
import tailwindcss from "@tailwindcss/vite";
import solidJs from "@astrojs/solid-js";

import startupCode from "astro-startup-code";

// https://astro.build/config
export default defineConfig({
	site: 'https://colibri.lou.gg',
	session: {
		options: {}
	},
	adapter: node({
		mode: "standalone"
	}),
	output: "server",
	vite: {
		plugins: [tailwindcss()]
	},
	integrations: [solidJs(), startupCode({ entrypoint: './src/sockets/index.ts' })],
	env: {
		schema: {
			PRIVATE_KEY_1: envField.string({ context: "server", access: "secret" }),
			PRIVATE_KEY_2: envField.string({ context: "server", access: "secret" }),
		}
	},
	experimental: {
		fonts: [
			{
				provider: fontProviders.google(),
				name: "Inter",
				weights: ["100 900"],
				cssVariable: "--font-inter"
			},
			{
				provider: fontProviders.google(),
				name: "Geist Mono",
				weights: ["100 900"],
				cssVariable: "--font-geist-mono"
			},
		]
	}
});
