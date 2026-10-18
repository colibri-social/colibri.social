import "../../app.css";
import {
	SpaceRail,
	SpaceRailItem,
	spaceRailPanelClass,
} from "@colibri-social/ui";
import { createSignal, Show } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext } from "../../data/store";
import { Providers } from "../../providers";
import { DesktopShell } from "../../shell/desktop/DesktopShell";

const HQ = "did:plc:colibrihqspace2a4b6c8d";
const TEXT = "social.colibri.beta.channel.text";

let dispose: (() => void) | undefined;

afterEach(() => {
	dispose?.();
	setLatency(0);
	document.body.replaceChildren();
});

const mount = async () => {
	setLatency(0);
	await page.viewport(1440, 900);
	history.replaceState(null, "", `/app/c/${HQ}/${TEXT}/general`);
	const store = createDataStore(createMockSource({ live: false }));
	const host = document.createElement("div");
	host.style.cssText = "position:fixed;inset:0";
	document.body.append(host);
	dispose = render(
		() => (
			<DataContext.Provider value={store}>
				<Providers>
					<DesktopShell />
				</Providers>
			</DataContext.Provider>
		),
		host,
	);
	return store;
};

const headerText = () =>
	document.querySelector("[data-channel-list-header]")?.textContent ?? "";

const railDuration = () =>
	document
		.querySelector<HTMLElement>("[data-shell-sidebar]")
		?.style.getPropertyValue("--rail-tab-duration") || "0ms";

it("moves the rail indicator in the click task and swaps the Space content after the rail animation", async () => {
	await mount();
	await expect.poll(() => headerText()).not.toBe("");
	await expect
		.poll(() => document.querySelector("[data-rail-item][data-state=active]"))
		.toBeTruthy();
	await expect.poll(railDuration).not.toBe("0ms");

	const rail = document.querySelector("[data-space-rail]") as HTMLElement;
	const tab = rail.querySelector("[data-rail-tab]") as HTMLElement;
	const target = Array.from(
		rail.querySelectorAll<HTMLElement>("[data-rail-item]"),
	).find((item) => item.dataset.state !== "active") as HTMLElement;
	const header = headerText();
	const path = location.pathname;
	const transform = tab.style.transform;
	setLatency(4000);

	target.querySelector("button")?.click();

	expect(target.dataset.state).toBe("active");
	expect(target.querySelector("button")?.getAttribute("aria-current")).toBe(
		"page",
	);
	expect(tab.style.transform).not.toBe(transform);
	expect(headerText()).toBe(header);
	expect(location.pathname).toBe(path);

	await expect.poll(() => location.pathname, { timeout: 5000 }).not.toBe(path);
	await expect.poll(() => headerText(), { timeout: 5000 }).not.toBe(header);
	expect(document.querySelector("[data-space-rail]")).toBe(rail);
	expect(rail.isConnected).toBe(true);
	expect(target.dataset.state).toBe("active");
});

it("keeps Space switch work off the main thread until the rail animation finishes", async () => {
	await mount();
	await expect.poll(() => headerText()).not.toBe("");
	await expect.poll(railDuration).not.toBe("0ms");
	await expect
		.poll(() => document.querySelector("article[data-message-key]"))
		.toBeTruthy();

	const rail = document.querySelector("[data-space-rail]") as HTMLElement;
	const tab = rail.querySelector("[data-rail-tab]") as HTMLElement;
	const target = Array.from(
		rail.querySelectorAll<HTMLElement>("[data-rail-item]"),
	).find((item) => item.dataset.state !== "active") as HTMLElement;
	const path = location.pathname;
	const header = headerText();

	target.querySelector("button")?.click();
	const motion = tab.getAnimations();
	expect(motion.length).toBeGreaterThan(0);

	await Promise.allSettled(motion.map((animation) => animation.finished));
	expect(location.pathname).toBe(path);
	expect(headerText()).toBe(header);
	await expect.poll(() => location.pathname, { timeout: 5000 }).not.toBe(path);
	await expect.poll(() => headerText(), { timeout: 5000 }).not.toBe(header);
});

it("mounts a message's hover toolbar only once the row is hovered or focused", async () => {
	await mount();
	await expect
		.poll(() => document.querySelectorAll("article[data-message-key]").length)
		.toBeGreaterThan(3);
	const articles = Array.from(
		document.querySelectorAll<HTMLElement>("article[data-message-key]"),
	);
	expect(
		articles.filter((article) =>
			article.querySelector("[data-message-toolbar] [role='toolbar']"),
		),
	).toEqual([]);

	const [first, second] = articles as [HTMLElement, HTMLElement];
	first.dispatchEvent(new PointerEvent("pointerenter"));
	await expect
		.poll(() => first.querySelector("[data-message-toolbar] [role='toolbar']"))
		.toBeTruthy();
	second.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
	await expect
		.poll(() => second.querySelector("[data-message-toolbar] [role='toolbar']"))
		.toBeTruthy();
});

it("animates the rail join with a compositor transform instead of a custom property", async () => {
	await mount();
	await expect.poll(() => headerText()).not.toBe("");
	await expect.poll(railDuration).not.toBe("0ms");

	const sidebar = document.querySelector("[data-shell-sidebar]") as HTMLElement;
	const target = Array.from(
		document.querySelectorAll<HTMLElement>("[data-rail-item]"),
	).find((item) => item.dataset.state !== "active") as HTMLElement;
	target.querySelector("button")?.click();

	const transitions = sidebar
		.getAnimations({ subtree: true })
		.filter((animation) => animation instanceof CSSTransition)
		.map((animation) => ({
			property: (animation as CSSTransition).transitionProperty,
			pseudo: (animation.effect as KeyframeEffect | null)?.pseudoElement,
		}));
	expect(transitions).toContainEqual({
		property: "transform",
		pseudo: "::before",
	});
	expect(
		transitions.filter((transition) => transition.property.startsWith("--")),
	).toEqual([]);
});

const RAIL_TAB_PROPERTIES = [
	"--rail-tab-offset",
	"--rail-tab-height",
	"--rail-tab-visible",
	"--rail-tab-duration",
	"--rail-fade-top",
];

const customProperties = (element: Element) => {
	const style = getComputedStyle(element);
	const names = new Set(RAIL_TAB_PROPERTIES);
	for (let index = 0; index < style.length; index++) {
		const name = style.item(index);
		if (name.startsWith("--")) names.add(name);
	}
	return new Map(
		Array.from(names, (name) => [name, style.getPropertyValue(name)]),
	);
};

const snapshotSubtree = (root: Element) =>
	Array.from(root.querySelectorAll("*"), (element) => ({
		element,
		properties: customProperties(element),
	}));

const restyledProperties = (before: ReturnType<typeof snapshotSubtree>) => {
	const changed = new Set<string>();
	for (const { element, properties } of before) {
		const after = customProperties(element);
		for (const name of new Set([...properties.keys(), ...after.keys()]))
			if (properties.get(name) !== after.get(name)) changed.add(name);
	}
	return Array.from(changed).sort();
};

const nextFrame = () =>
	new Promise<void>((resolve) =>
		requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
	);

const joinGap = (sidebar: HTMLElement, tab: HTMLElement) => {
	const box = sidebar.getBoundingClientRect();
	const border = Number.parseFloat(getComputedStyle(sidebar).borderTopWidth);
	const join = getComputedStyle(sidebar, "::before");
	const offset = new DOMMatrixReadOnly(join.transform).m42;
	const joinBottom =
		box.top +
		border +
		Number.parseFloat(join.top) +
		offset +
		Number.parseFloat(join.height);
	return joinBottom - 11 - tab.getBoundingClientRect().bottom;
};

it("scrolls the rail without restyling the sidebar subtree and keeps the join on the tab", async () => {
	await mount();
	await expect.poll(() => headerText()).not.toBe("");
	await expect
		.poll(() => document.querySelector("[data-rail-item][data-state=active]"))
		.toBeTruthy();

	const rail = document.querySelector("[data-space-rail]") as HTMLElement;
	const scroller = rail.querySelector("[data-rail-scroll]") as HTMLElement;
	const tab = rail.querySelector("[data-rail-tab]") as HTMLElement;
	const sidebar = document.querySelector("[data-shell-sidebar]") as HTMLElement;
	const content = rail.querySelector("[data-rail-content]") as HTMLElement;
	content.style.paddingBottom = `${window.innerHeight}px`;
	await expect
		.poll(() => scroller.scrollHeight - scroller.clientHeight)
		.toBeGreaterThan(24);
	await expect
		.poll(
			() =>
				tab.getBoundingClientRect().top - scroller.getBoundingClientRect().top,
		)
		.toBeGreaterThan(24);
	await nextFrame();
	await nextFrame();
	await expect
		.poll(() => Math.abs(joinGap(sidebar, tab)))
		.toBeLessThanOrEqual(1);

	const before = snapshotSubtree(sidebar);
	expect(before.length).toBeGreaterThan(10);

	for (const scrollTop of [6, 12, 18, 24]) {
		scroller.scrollTop = scrollTop;
		await nextFrame();
		expect(scroller.scrollTop).toBe(scrollTop);
		expect(Math.abs(joinGap(sidebar, tab))).toBeLessThanOrEqual(1);
	}

	expect(restyledProperties(before)).toEqual([]);
});

it("aligns a join panel that mounts after the rail in the same frame", async () => {
	await page.viewport(1440, 900);
	const [shown, setShown] = createSignal(false);
	const host = document.createElement("div");
	host.style.cssText = "position:fixed;inset:0";
	document.body.append(host);
	dispose = render(
		() => (
			<Providers>
				<div data-space-rail-host="" class="flex h-full">
					<SpaceRail platform="desktop">
						<SpaceRailItem name="First" />
						<SpaceRailItem name="Second" active />
					</SpaceRail>
					<Show when={shown()}>
						<div
							data-rail-panel=""
							class={`${spaceRailPanelClass} min-w-0 flex-1`}
						/>
					</Show>
				</div>
			</Providers>
		),
		host,
	);
	const tab = host.querySelector("[data-rail-tab]") as HTMLElement;
	await expect.poll(() => getComputedStyle(tab).visibility).toBe("visible");
	await nextFrame();
	await nextFrame();

	const sample = await new Promise<{ gap: number; opacity: string }>(
		(resolve) =>
			requestAnimationFrame(() => {
				setShown(true);
				queueMicrotask(() => {
					const panel = host.querySelector("[data-rail-panel]") as HTMLElement;
					resolve({
						gap: joinGap(panel, tab),
						opacity: getComputedStyle(panel, "::before").opacity,
					});
				});
			}),
	);
	expect(sample.opacity).toBe("1");
	expect(Math.abs(sample.gap)).toBeLessThanOrEqual(1);
});

const transformTransition = (element: Element, pseudo: string | null) =>
	element
		.getAnimations({ subtree: pseudo !== null })
		.find(
			(animation) =>
				animation instanceof CSSTransition &&
				animation.transitionProperty === "transform" &&
				((animation.effect as KeyframeEffect | null)?.pseudoElement ?? null) ===
					pseudo,
		) as CSSTransition | undefined;

const targetOffset = (animation: CSSTransition | undefined) => {
	const effect = animation?.effect;
	const frames = effect instanceof KeyframeEffect ? effect.getKeyframes() : [];
	const last = frames[frames.length - 1];
	return last ? new DOMMatrixReadOnly(String(last.transform)).m42 : Number.NaN;
};

const joinOffset = (sidebar: HTMLElement) =>
	new DOMMatrixReadOnly(getComputedStyle(sidebar, "::before").transform).m42;

const tabOffset = (tab: HTMLElement) =>
	new DOMMatrixReadOnly(getComputedStyle(tab).transform).m42;

it("starts the join transition with the tab before the deferred Space switch and holds it through the content swap", async () => {
	await mount();
	await expect.poll(() => headerText()).not.toBe("");
	await expect.poll(railDuration).not.toBe("0ms");
	await nextFrame();

	const rail = document.querySelector("[data-space-rail]") as HTMLElement;
	const tab = rail.querySelector("[data-rail-tab]") as HTMLElement;
	const scroller = rail.querySelector("[data-rail-scroll]") as HTMLElement;
	const sidebar = document.querySelector("[data-shell-sidebar]") as HTMLElement;
	const target = Array.from(
		rail.querySelectorAll<HTMLElement>("[data-rail-item]"),
	).find((item) => item.dataset.state !== "active") as HTMLElement;
	const path = location.pathname;
	const header = headerText();
	await expect
		.poll(() => Math.abs(joinOffset(sidebar) - tabOffset(tab)))
		.toBeLessThanOrEqual(0.5);
	await expect.poll(() => tab.getAnimations().length).toBe(0);
	setLatency(1000);

	target.querySelector("button")?.click();
	await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

	expect(location.pathname).toBe(path);
	expect(headerText()).toBe(header);
	const tabMotion = transformTransition(tab, null);
	const joinMotion = transformTransition(sidebar, "::before");
	expect(tabMotion).toBeDefined();
	expect(joinMotion).toBeDefined();
	expect(targetOffset(joinMotion)).toBeCloseTo(
		targetOffset(tabMotion) - scroller.scrollTop,
		1,
	);
	const tabTiming = tabMotion?.effect?.getComputedTiming();
	const joinTiming = joinMotion?.effect?.getComputedTiming();
	expect(joinTiming?.duration).toBe(tabTiming?.duration);
	expect(joinTiming?.easing).toBe(tabTiming?.easing);
	expect(joinMotion?.startTime).toBe(tabMotion?.startTime);

	const final = targetOffset(joinMotion);
	await Promise.allSettled([tabMotion?.finished, joinMotion?.finished]);
	expect(joinOffset(sidebar)).toBeCloseTo(final, 1);

	const offsets: number[] = [];
	const transitions: (CSSTransition | undefined)[] = [];
	while (headerText() === header || location.pathname === path) {
		await new Promise<void>((resolve) =>
			requestAnimationFrame(() => resolve()),
		);
		offsets.push(joinOffset(sidebar));
		transitions.push(transformTransition(sidebar, "::before"));
	}
	for (let frame = 0; frame < 6; frame++) {
		await new Promise<void>((resolve) =>
			requestAnimationFrame(() => resolve()),
		);
		offsets.push(joinOffset(sidebar));
		transitions.push(transformTransition(sidebar, "::before"));
	}
	expect(offsets.every((offset) => Math.abs(offset - final) <= 0.5)).toBe(true);
	expect(transitions.filter(Boolean)).toEqual([]);
});

it("creates a message's context menu only on its first right-click", async () => {
	await mount();
	await expect
		.poll(() => document.querySelectorAll("article[data-message-key]").length)
		.toBeGreaterThan(3);
	const armed = () =>
		Array.from(
			document.querySelectorAll<HTMLElement>(
				"[data-shell-main] [data-closed], [data-shell-main] [data-expanded]",
			),
		).filter((element) => element.querySelector("article[data-message-key]"));
	expect(armed()).toEqual([]);

	const visibleArticle = () =>
		Array.from(
			document.querySelectorAll<HTMLElement>("article[data-message-key]"),
		).find((candidate) => {
			const rect = candidate.getBoundingClientRect();
			return rect.top >= 0 && rect.bottom <= innerHeight / 2;
		});
	await expect.poll(visibleArticle).toBeTruthy();
	const article = visibleArticle() as HTMLElement;
	const box = article.getBoundingClientRect();
	article.dispatchEvent(
		new MouseEvent("contextmenu", {
			bubbles: true,
			cancelable: true,
			button: 2,
			clientX: box.left + 40,
			clientY: box.top + 10,
		}),
	);
	await expect.poll(() => document.querySelector("[role='menu']")).toBeTruthy();
	expect(armed()).toHaveLength(1);
	expect(armed()[0]?.contains(article)).toBe(true);
	const menu = document.querySelector("[role='menu']") as HTMLElement;
	await expect
		.poll(() => Math.abs(menu.getBoundingClientRect().left - (box.left + 40)))
		.toBeLessThanOrEqual(4);

	await userEvent.keyboard("{Escape}");
	await expect.poll(() => document.querySelector("[role='menu']")).toBeNull();
	article.dispatchEvent(
		new MouseEvent("contextmenu", {
			bubbles: true,
			cancelable: true,
			button: 2,
			clientX: box.left + 60,
			clientY: box.top + 12,
		}),
	);
	await expect.poll(() => document.querySelector("[role='menu']")).toBeTruthy();
	expect(armed()).toHaveLength(1);
	await userEvent.keyboard("{Escape}");
	await expect.poll(() => document.querySelector("[role='menu']")).toBeNull();
});
