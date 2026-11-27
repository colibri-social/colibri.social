import path from "node:path";
import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

const CHROMIUM_LOG_ARGS = process.env.CI
	? ["--enable-logging=stderr", "--log-level=2"]
	: [];

export default defineConfig({
	test: {
		maxWorkers: process.env.CI ? 2 : undefined,
		projects: [
			{
				extends: true,
				test: {
					name: "unit",
					include: ["src/**/*.test.ts"],
					environment: "node",
				},
			},
			{
				extends: true,
				plugins: [
					storybookTest({ configDir: path.join(dirname, ".storybook") }),
				],
				test: {
					name: "storybook",
					retry: process.env.CI ? 2 : 0,
					setupFiles: [path.join(dirname, ".storybook/vitest.setup.ts")],
					browser: {
						enabled: true,
						headless: true,
						provider: playwright({
							launchOptions: { args: CHROMIUM_LOG_ARGS },
						}),
						instances: [{ browser: "chromium" }],
					},
				},
			},
		],
	},
});
