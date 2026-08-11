import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["src/**/*.test.ts"],
		environment: "node",
	},
	resolve: {
		alias: [{ find: /^solid-js$/, replacement: "solid-js/dist/dev.js" }],
	},
});
