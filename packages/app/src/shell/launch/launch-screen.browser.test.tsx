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
	LAUNCH_MARK_SIZE,
	LAUNCH_SCREEN_ID,
	launchScreenDocumentHtml,
} from "./launch-markup";
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

const centerOf = (element: Element) => {
	const rect = element.getBoundingClientRect();
	return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
};

describe("launch screen", () => {
	it("takes over the launch screen from the page without replacing it", () => {
		const fromPage = insertDocumentLaunchScreen();
		const host = mountHost();
		dispose = render(() => <LaunchScreen />, host);
		expect(fromPage).not.toBeNull();
		expect(host.firstElementChild).toBe(fromPage);
		expect(fromPage?.hasAttribute("id")).toBe(false);
		expect(document.querySelectorAll("[data-launch-screen]")).toHaveLength(1);
	});

	it("removes the launch screen from the page when nothing takes it over", () => {
		insertDocumentLaunchScreen();
		dismissDocumentLaunchScreen();
		expect(document.querySelector("[data-launch-screen]")).toBeNull();
	});

	it("centers the mark on the theme background at the native splash size", () => {
		const host = mountHost();
		dispose = render(() => <LaunchScreen />, host);
		const screen = host.querySelector<HTMLElement>("[data-launch-screen]");
		const mark = host.querySelector("[data-launch-mark]");
		if (!screen || !mark) throw new Error("launch screen missing");
		expect(getComputedStyle(screen).backgroundColor).toBe("rgb(8, 8, 8)");
		const box = mark.getBoundingClientRect();
		expect(box.width).toBe(LAUNCH_MARK_SIZE);
		expect(box.height).toBe(LAUNCH_MARK_SIZE);
		const center = centerOf(mark);
		expect(Math.abs(center.x - window.innerWidth / 2)).toBeLessThan(1);
		expect(Math.abs(center.y - window.innerHeight / 2)).toBeLessThan(1);
		const screenBox = screen.getBoundingClientRect();
		expect(screenBox.width).toBe(window.innerWidth);
		expect(screenBox.height).toBe(window.innerHeight);
	});

	it("follows the light theme", () => {
		document.documentElement.setAttribute("data-theme", "light");
		const host = mountHost();
		dispose = render(() => <LaunchScreen />, host);
		const screen = host.querySelector<HTMLElement>("[data-launch-screen]");
		const stop = host.querySelector("stop");
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
