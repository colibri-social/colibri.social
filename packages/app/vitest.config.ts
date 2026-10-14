import tailwindcss from "@tailwindcss/vite";
import { playwright } from "@vitest/browser-playwright";
import solid from "vite-plugin-solid";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
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
