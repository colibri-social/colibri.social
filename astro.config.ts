import { defineConfig, envField, fontProviders } from "astro/config";

import node from "@astrojs/node";
import tailwindcss from "@tailwindcss/vite";
import solidJs from "@astrojs/solid-js";

// https://astro.build/config
export default defineConfig({
	site: "https://colibri.social",
	session: {
		options: {},
	},
	adapter: node({
		mode: "standalone",
	}),
	output: "server",
	vite: {
		plugins: [tailwindcss()],
	},
	integrations: [solidJs()],
	env: {
		schema: {
			PRIVATE_KEY_1: envField.string({ context: "server", access: "secret" }),
			PRIVATE_KEY_2: envField.string({ context: "server", access: "secret" }),
			APPVIEW_DOMAIN: envField.string({ context: "client", access: "public" }),
			SAME_TLD_DID: envField.string({ context: "server", access: "public" }),
			REDIS_PASSWORD: envField.string({ context: "server", access: "secret" }),
		},
	},
	security: {
		allowedDomains: [
			{ hostname: "colibri.social", protocol: "https" },
			{ hostname: "example.com", protocol: "https" }, // Temporary until Astro 5.18
		],
		actionBodySizeLimit: 10 * 1024 * 1024,
	},
	experimental: {
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
	},
});
