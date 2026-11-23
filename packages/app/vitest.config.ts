import tailwindcss from "@tailwindcss/vite";
import { playwright } from "@vitest/browser-playwright";
import solid from "vite-plugin-solid";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		maxWorkers: process.env.CI ? 2 : undefined,
		projects: [
			{
				test: {
					name: "unit",
					include: ["src/**/*.test.ts"],
					environment: "node",
				},
			},
			{
				plugins: [solid(), tailwindcss()],
				resolve: { dedupe: ["solid-js"] },
				test: {
					name: "browser",
					retry: process.env.CI ? 2 : 0,
					include: ["src/**/*.browser.test.tsx"],
					setupFiles: ["src/test-setup.ts"],
					browser: {
						enabled: true,
						headless: true,
						provider: playwright({
							contextOptions: {
								hasTouch: true,
								isMobile: true,
								viewport: { width: 402, height: 874 },
							},
						}),
						instances: [{ browser: "chromium" }],
					},
				},
			},
		],
	},
});
