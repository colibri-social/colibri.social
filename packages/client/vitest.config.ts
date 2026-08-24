import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: [{ find: /^solid-js$/, replacement: "solid-js/dist/dev.js" }],
	},
	test: {
		environment: "node",
		projects: [
			{
				extends: true,
				test: {
					name: "unit",
					include: ["src/**/*.test.ts"],
				},
			},
			{
				extends: true,
				test: {
					name: "integration",
					include: ["test/integration/**/*.test.ts"],
					testTimeout: 120_000,
					hookTimeout: 180_000,
					fileParallelism: false,
				},
			},
		],
	},
});
