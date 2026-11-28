import tailwindcss from "@tailwindcss/vite";
import { playwright } from "@vitest/browser-playwright";
import solid from "vite-plugin-solid";
import { defineConfig } from "vitest/config";
import type { BrowserCommand } from "vitest/node";

const resetPageScale: BrowserCommand<[]> = async ({ page }) => {
	const session = await page.context().newCDPSession(page);

	await session.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });
	await session.detach();
};

export default defineConfig({
	test: {
		maxWorkers: process.env.CI ? 2 : undefined,
		projects: [
			{
				test: {
					name: "unit",
					include: ["src/**/*.test.ts"],
					environment: "node",
					setupFiles: ["src/test-setup-unit.ts"],
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
						commands: { resetPageScale },
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
