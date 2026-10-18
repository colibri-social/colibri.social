import "../../app.css";
import { ColibriError } from "@colibri-social/lib";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import {
	emulateWindowChrome,
	windowChromeIssues,
} from "../../../../ui/src/foundations/layout-test";
import { Providers } from "../../providers";
import { dismissDocumentLaunchScreen, LaunchScreen } from "./LaunchScreen";
import {
	LAUNCH_SCREEN_ID,
	LAUNCH_SCREEN_LABEL,
	LAUNCH_STYLE_ID,
	launchScreenDocumentHtml,
	launchScreenDocumentStyle,
} from "./launch-markup";
import { LAUNCH_TIPS, launchTips } from "./launch-tips";
import { StartupError } from "./StartupError";

let dispose: (() => void) | undefined;
let restoreChrome: (() => void) | undefined;

afterEach(() => {
	dispose?.();
	dispose = undefined;
	restoreChrome?.();
	restoreChrome = undefined;
	document.body.replaceChildren();
	document.documentElement.setAttribute("data-theme", "dark");
	delete document.documentElement.dataset.reducedMotion;
});

const mountHost = () => {
	const host = document.createElement("div");
	document.body.append(host);
	return host;
};

const insertDocumentLaunchScreen = () => {
	document.body.insertAdjacentHTML("afterbegin", launchScreenDocumentHtml());
	return document.getElementById(LAUNCH_SCREEN_ID);
};

describe("launch screen", () => {
	it("draws the bird where the page's launch screen drew it", () => {
		document.documentElement.dataset.reducedMotion = "true";
		if (!document.getElementById(LAUNCH_STYLE_ID)) {
			document.head.insertAdjacentHTML(
				"beforeend",
				launchScreenDocumentStyle(),
			);
		}
		const fromPage = insertDocumentLaunchScreen();
		const paths = Array.from(
			fromPage?.querySelectorAll("[data-launch-mark] path") ?? [],
		);
		expect(paths).toHaveLength(4);
		const pageTail = paths[0].getBoundingClientRect();
		const pageBody = paths[2].getBoundingClientRect();
		const pageBottom = Math.max(pageTail.bottom, pageBody.bottom);
		const pageRight = Math.max(pageTail.right, pageBody.right);
		const pageTop = Math.min(pageTail.top, pageBody.top);
		const pageLeft = Math.min(pageTail.left, pageBody.left);
		dismissDocumentLaunchScreen();
		const host = mountHost();
		dispose = render(() => <LaunchScreen />, host);
		const body = host.querySelector('use[href^="#hb-body-"]');
		if (!body) throw new Error("launch bird missing");
		const box = body.getBoundingClientRect();
		expect(Math.abs(box.bottom - pageBottom)).toBeLessThan(1);
		expect(Math.abs(box.right - pageRight)).toBeLessThan(1);
		expect(Math.abs(box.top - pageTop)).toBeLessThan(1);
		expect(Math.abs(box.left - pageLeft)).toBeLessThan(1);
	});

	it("removes the launch screen from the page when nothing takes it over", () => {
		insertDocumentLaunchScreen();
		dismissDocumentLaunchScreen();
		expect(document.querySelector("[data-launch-screen]")).toBeNull();
	});

	it("fills the window with the theme background", () => {
		const host = mountHost();
		dispose = render(() => <LaunchScreen />, host);
		const screen = host.querySelector<HTMLElement>("[data-loading-screen]");
		if (!screen) throw new Error("launch screen missing");
		expect(getComputedStyle(screen).backgroundColor).toBe("rgb(8, 8, 8)");
		const box = screen.getBoundingClientRect();
		expect(box.width).toBe(window.innerWidth);
		expect(box.height).toBe(window.innerHeight);
		expect(
			page.getByRole("status", { name: LAUNCH_SCREEN_LABEL }).element(),
		).toBe(screen);
	});

	it("follows the light theme", () => {
		document.documentElement.setAttribute("data-theme", "light");
		const host = mountHost();
		dispose = render(() => <LaunchScreen />, host);
		const screen = host.querySelector<HTMLElement>("[data-loading-screen]");
		const stop = host.querySelector("[data-hummingbird] stop");
		if (!screen || !stop) throw new Error("launch screen missing");
		expect(getComputedStyle(screen).backgroundColor).toBe("rgb(247, 247, 248)");
		expect(getComputedStyle(stop).stopColor).toBe("rgb(32, 32, 32)");
	});

	it("gives every copy its own gradients", () => {
		const host = mountHost();
		dispose = render(
			() => (
				<>
					<LaunchScreen />
					<LaunchScreen />
				</>
			),
			host,
		);
		const ids = Array.from(host.querySelectorAll("linearGradient")).map(
			(gradient) => gradient.id,
		);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("shows a tip about a feature once loading takes a moment", async () => {
		const host = mountHost();
		dispose = render(() => <LaunchScreen />, host);
		await expect
			.poll(() => host.querySelector("[data-loading-tip-text]")?.textContent, {
				timeout: 3000,
			})
			.toBeTruthy();
		const text = host.querySelector("[data-loading-tip-text]")?.textContent;
		expect(LAUNCH_TIPS.map((tip) => tip.text)).toContain(text);
	});

	it("keeps platform tips on their own platform", () => {
		const desktop = launchTips("desktop");
		const mobile = launchTips("mobile");
		expect(desktop).toContain(
			"Press Shift and Enter to start a new line without sending.",
		);
		expect(mobile).not.toContain(
			"Press Shift and Enter to start a new line without sending.",
		);
		expect(mobile).toContain(
			"Press and hold a message to see everything you can do with it.",
		);
		expect(desktop).not.toContain(
			"Press and hold a message to see everything you can do with it.",
		);
	});

	it("writes every tip as one plain sentence", () => {
		for (const { text } of LAUNCH_TIPS) {
			expect(text).toMatch(/^[A-Z].*\.$/);
			expect(text).not.toMatch(/[\u2014\u2013\u2026;]/);
			expect(text.slice(0, -1)).not.toMatch(/[.!?]\s/);
			expect(text).not.toMatch(/server|appview|pds|record|protocol|did:/i);
		}
	});

	it("keeps the page's slow start message hidden until it's needed", () => {
		const fromPage = insertDocumentLaunchScreen();
		const stalled = fromPage?.querySelector<HTMLElement>(
			"[data-launch-stalled]",
		);
		expect(stalled?.hidden).toBe(true);
		expect(stalled?.textContent).toContain("Reload");
	});
});

describe("startup error", () => {
	it("always offers a retry, even for errors that usually need a restart", async () => {
		const onRetry = vi.fn();
		const host = mountHost();
		dispose = render(
			() => (
				<Providers>
					<StartupError
						error={new ColibriError({ code: "StorageStalled" })}
						onRetry={onRetry}
					/>
				</Providers>
			),
			host,
		);
		await expect.element(page.getByText("Colibri got stuck")).toBeVisible();
		await userEvent.click(page.getByRole("button", { name: "Try again" }));
		expect(onRetry).toHaveBeenCalledOnce();
	});

	it("explains a slow connection in plain words", async () => {
		const host = mountHost();
		dispose = render(
			() => (
				<Providers>
					<StartupError
						error={new ColibriError({ code: "Timeout" })}
						onRetry={() => {}}
					/>
				</Providers>
			),
			host,
		);
		await expect
			.element(page.getByText("Colibri can't connect right now"))
			.toBeVisible();
		expect(host.textContent).not.toMatch(
			/session|token|server|appview|pds|background/i,
		);
	});

	it("stays clear of the window chrome on desktop", async () => {
		await page.viewport(1200, 800);
		restoreChrome = emulateWindowChrome();
		const host = mountHost();
		dispose = render(
			() => (
				<Providers>
					<StartupError
						error={new ColibriError({ code: "Unexpected" })}
						onRetry={() => {}}
					/>
				</Providers>
			),
			host,
		);
		await expect
			.element(page.getByRole("button", { name: "Try again" }))
			.toBeVisible();
		expect(windowChromeIssues(host)).toEqual([]);
		await page.viewport(402, 874);
	});
});
