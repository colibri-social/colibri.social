import "../app.css";
import { render } from "solid-js/web";
import { afterEach, expect, it } from "vitest";
import { createMockSource, setLatency } from "../data/mock/source";
import { createDataStore, DataContext } from "../data/store";
import { Providers } from "../providers";
import { KEYBOARD_PROGRESS_EVENT } from "./keyboard-inset";
import { MobileShell } from "./MobileShell";

const KEYBOARD = 300;

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("timed out");
		await new Promise((resolve) => setTimeout(resolve, 30));
	}
};

const frame = () =>
	new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

const settle = async () => {
	for (let index = 0; index < 4; index++) await frame();
};

let dispose: (() => void) | undefined;
let host: HTMLDivElement | undefined;
let originalPath = "/";

afterEach(() => {
	dispose?.();
	dispose = undefined;
	host?.remove();
	host = undefined;
	document.documentElement.style.removeProperty("--keyboard-inset");
	history.replaceState(null, "", originalPath);
});

const buttonStarting = (root: HTMLElement, name: string) =>
	Array.from(root.querySelectorAll<HTMLElement>("button")).find((element) =>
		(element.getAttribute("aria-label") ?? element.textContent ?? "")
			.trim()
			.startsWith(name),
	);

const scroller = () =>
	host?.querySelector<HTMLElement>(
		'[data-pane-index="1"] [data-message-list-scroller]',
	) ?? null;

const mount = async () => {
	setLatency(0);
	originalPath = location.pathname + location.search;
	history.replaceState(null, "", "/");
	const store = createDataStore(createMockSource({ live: false }));
	host = document.createElement("div");
	host.style.cssText = "position:fixed;inset:0;width:402px;height:874px";
	document.body.append(host);
	const root = host;
	dispose = render(
		() => (
			<DataContext.Provider value={store}>
				<Providers>
					<MobileShell />
				</Providers>
			</DataContext.Provider>
		),
		host,
	);
	await until(() => !!buttonStarting(root, "Colibri HQ"));
	buttonStarting(root, "Colibri HQ")?.click();
	await until(() => !!buttonStarting(root, "general"));
	buttonStarting(root, "general")?.click();
	await until(() => {
		const element = scroller();
		return !!element && element.scrollHeight > element.clientHeight * 2;
	});
	let still = 0;
	while (still < 3) {
		await frame();
		const pane = root.querySelector<HTMLElement>('[data-pane-index="1"]');
		still = pane && pane.getBoundingClientRect().left === 0 ? still + 1 : 0;
	}
	await new Promise((resolve) => setTimeout(resolve, 400));
	await settle();
};

const shell = () =>
	document.querySelector<HTMLElement>("[data-mobile-shell]") as HTMLElement;

const follower = () =>
	document.querySelector<HTMLElement>(
		'[data-pane-index="1"] [data-keyboard-follow]',
	) as HTMLElement;

const toBottom = async () => {
	const element = scroller() as HTMLElement;
	element.scrollTop = element.scrollHeight;
	await settle();
	element.scrollTop = element.scrollHeight;
	await settle();
};

const distance = () => {
	const element = scroller() as HTMLElement;
	return element.scrollHeight - element.scrollTop - element.clientHeight;
};

const progress = (detail: Record<string, unknown>) =>
	window.dispatchEvent(new CustomEvent(KEYBOARD_PROGRESS_EVENT, { detail }));

const commit = (inset: number) =>
	window.dispatchEvent(
		new CustomEvent("colibri-keyboard-inset", { detail: inset }),
	);

const steps = (from: number, to: number) =>
	Array.from(
		{ length: 10 },
		(_, index) => from + ((to - from) * (index + 1)) / 10,
	);

const animate = async (from: number, to: number) => {
	progress({ phase: "start", from, to });
	await frame();
	const heights: number[] = [];
	for (const inset of steps(from, to)) {
		progress({ phase: "progress", inset });
		await frame();
		heights.push(Math.round(shell().getBoundingClientRect().height));
		const lift = follower().style.transform.match(
			/translate3d\(0(?:px)?, (-?\d+)px/,
		);
		expect(lift ? Number(lift[1]) : 0).toBe(
			0 - Math.round(inset - Math.min(from, to)),
		);
	}
	commit(to);
	await settle();
	return heights;
};

const legacy = async (from: number, to: number) => {
	if (to > from) {
		commit(to);
		commit(0);
	}
	for (const inset of steps(from, to)) {
		commit(inset);
		await frame();
	}
	await settle();
};

it("moves the chat with transforms and resizes the shell only at the edges", async () => {
	await mount();
	const full = Math.round(shell().getBoundingClientRect().height);
	const opening = await animate(0, KEYBOARD);
	expect(new Set(opening)).toEqual(new Set([full]));
	expect(Math.round(shell().getBoundingClientRect().height)).toBe(
		full - KEYBOARD,
	);
	expect(follower().style.transform).toBe("");
	expect(follower().style.willChange).toBe("");
	const closing = await animate(KEYBOARD, 0);
	expect(new Set(closing)).toEqual(new Set([full]));
	expect(Math.round(shell().getBoundingClientRect().height)).toBe(full);
	expect(follower().style.transform).toBe("");
});

it("stays at the bottom through a keyboard open and close", async () => {
	await mount();
	await toBottom();
	expect(distance()).toBeLessThanOrEqual(2);
	await animate(0, KEYBOARD);
	expect(distance()).toBeLessThanOrEqual(2);
	await animate(KEYBOARD, 0);
	expect(distance()).toBeLessThanOrEqual(2);
});

it("keeps the distance from the bottom when scrolled up", async () => {
	await mount();
	const element = scroller() as HTMLElement;
	element.scrollTop -= 600;
	await settle();
	const before = distance();
	expect(before).toBeGreaterThan(400);
	await animate(0, KEYBOARD);
	expect(Math.abs(distance() - before)).toBeLessThanOrEqual(2);
	await animate(KEYBOARD, 0);
	expect(Math.abs(distance() - before)).toBeLessThanOrEqual(2);
});

it("keeps the distance from the bottom with per-frame insets and the opening double dispatch", async () => {
	await mount();
	const element = scroller() as HTMLElement;
	element.scrollTop -= 600;
	await settle();
	const before = distance();
	await legacy(0, KEYBOARD);
	expect(Math.abs(distance() - before)).toBeLessThanOrEqual(2);
	await legacy(KEYBOARD, 0);
	expect(Math.abs(distance() - before)).toBeLessThanOrEqual(2);
});

it("stays at the bottom when a touch on the list dismisses the keyboard", async () => {
	await mount();
	await toBottom();
	await animate(0, KEYBOARD);
	expect(distance()).toBeLessThanOrEqual(2);
	const element = scroller() as HTMLElement;
	element.dispatchEvent(new TouchEvent("touchstart", { bubbles: true }));
	await animate(KEYBOARD, 0);
	element.dispatchEvent(new TouchEvent("touchend", { bubbles: true }));
	await settle();
	expect(distance()).toBeLessThanOrEqual(2);
});
