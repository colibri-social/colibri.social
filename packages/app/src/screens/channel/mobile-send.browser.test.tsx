import "../../app.css";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import {
	createMockSource,
	type MockSource,
	setLatency,
} from "../../data/mock/source";
import { createDataStore, DataContext, type DataStore } from "../../data/store";
import { Providers } from "../../providers";
import { MobileShell } from "../../shell/MobileShell";

const HQ = "did:plc:colibrihqspace2a4b6c8d";
const TEXT = "social.colibri.beta.channel.text";
const GENERAL = `/app/c/${HQ}/${TEXT}/general`;

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

const frame = () =>
	new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

let stop: (() => void) | undefined;
let host: HTMLDivElement | undefined;
let originalPath = "/";
let safeArea: HTMLStyleElement | undefined;

beforeEach(() => {
	originalPath = location.pathname + location.search;
});

afterEach(() => {
	stop?.();
	safeArea?.remove();
	safeArea = undefined;
	window.dispatchEvent(
		new CustomEvent("colibri-keyboard-inset", { detail: 0 }),
	);
	host?.remove();
	history.replaceState(null, "", originalPath);
	document.documentElement.style.removeProperty("--keyboard-inset");
	setLatency(80, 260);
});

const mount = async () => {
	setLatency(0);
	history.replaceState(null, "", GENERAL);
	const source = createMockSource({ live: false });
	const store = createDataStore(source);
	host = document.createElement("div");
	host.style.cssText = "position:fixed;inset:0;width:402px;height:874px";
	document.body.append(host);
	stop = render(
		() => (
			<DataContext.Provider value={store}>
				<Providers>
					<MobileShell />
				</Providers>
			</DataContext.Provider>
		),
		host,
	);
	return { source, store, root: host };
};

const chat = (root: HTMLElement) =>
	root.querySelector<HTMLElement>('[data-pane-index="1"]') as HTMLElement;

const scroller = (root: HTMLElement) =>
	chat(root).querySelector<HTMLElement>(
		"[data-message-list-scroller]",
	) as HTMLElement;

const composer = (root: HTMLElement) =>
	chat(root).querySelector<HTMLElement>("[data-composer]") as HTMLElement;

const composerBox = (root: HTMLElement) =>
	chat(root).querySelector<HTMLElement>("[data-composer-box]") as HTMLElement;

const listBottom = (root: HTMLElement) =>
	chat(root).querySelector<HTMLElement>(
		"[data-message-list-bottom]",
	) as HTMLElement;

const lastRow = (root: HTMLElement) => {
	const rows = chat(root).querySelectorAll<HTMLElement>("[data-message]");
	return rows[rows.length - 1] as HTMLElement;
};

const distance = (root: HTMLElement) => {
	const element = scroller(root);
	return element.scrollHeight - element.scrollTop - element.clientHeight;
};

const gapBelowLast = (root: HTMLElement) =>
	composerBox(root).getBoundingClientRect().top -
	lastRow(root).getBoundingClientRect().bottom;

const paddingBottom = (element: HTMLElement) =>
	Number.parseFloat(getComputedStyle(element).paddingBottom);

const settle = async () => {
	for (let index = 0; index < 6; index++) await frame();
};

const generalRef = (store: DataStore) => {
	const hq = store.communities.value()?.find((entry) => entry.did === HQ);
	return hq ? store.space(hq).channelBySlug("general")?.space : undefined;
};

const openGeneral = async () => {
	const mounted = await mount();
	const { store, root } = mounted;
	await until(() => !!generalRef(store));
	const ref = generalRef(store);
	if (!ref) throw new Error("no general");
	const feed = store.channel(ref);
	await until(() => feed.ready());
	await until(() => {
		const element = chat(root)?.querySelector<HTMLElement>(
			"[data-message-list-scroller]",
		);
		return !!element && element.scrollHeight > element.clientHeight * 2;
	});
	await until(() => composer(root) !== null);
	await new Promise((resolve) => setTimeout(resolve, 400));
	const element = scroller(root);
	element.scrollTop = element.scrollHeight;
	await settle();
	return { ...mounted, ref, feed };
};

const otherMember = (store: DataStore) => {
	const hq = store.communities.value()?.find((entry) => entry.did === HQ);
	const members = hq ? (store.space(hq).members.value() ?? []) : [];
	return members.find((member) => member.actor.did !== store.viewer.did)?.actor
		.did;
};

const startTyping = (source: MockSource, ref: string, did: string) =>
	source.emit({
		$type: "typingEvent",
		channel: ref,
		did,
	} as Parameters<MockSource["emit"]>[0]);

const keyboard = (inset: number) =>
	window.dispatchEvent(
		new CustomEvent("colibri-keyboard-inset", { detail: inset }),
	);

const button = (scope: ParentNode, name: string) =>
	Array.from(scope.querySelectorAll<HTMLElement>("button")).find(
		(element) => element.getAttribute("aria-label") === name,
	);

describe("mobile channel bottom", () => {
	it("keeps the list padding plus the typing room below the last message", async () => {
		const { root } = await openGeneral();
		expect(distance(root)).toBeLessThanOrEqual(1);
		expect(Math.round(gapBelowLast(root))).toBe(32);
	});

	it("keeps the typing room fixed while someone types", async () => {
		const { root, source, store, ref } = await openGeneral();
		expect(paddingBottom(listBottom(root))).toBe(32);
		await until(() => !!otherMember(store));
		startTyping(source, ref, otherMember(store) as string);
		await until(
			() => !!chat(root).querySelector("[data-composer-typing] [data-active]"),
		);
		expect(paddingBottom(listBottom(root))).toBe(32);
		await settle();
		expect(distance(root)).toBeLessThanOrEqual(1);
		const indicator = chat(root)
			.querySelector("[data-composer-typing]")
			?.getBoundingClientRect();
		expect(lastRow(root).getBoundingClientRect().bottom).toBeLessThanOrEqual(
			(indicator?.top ?? 0) + 0.5,
		);
	});

	it("drops the bottom safe area under the composer while the keyboard is open", async () => {
		safeArea = document.createElement("style");
		safeArea.textContent = ":root { --safe-area-bottom: 34px; }";
		document.head.append(safeArea);
		const { root } = await openGeneral();
		await settle();
		expect(paddingBottom(composer(root))).toBe(42);
		expect(Math.round(gapBelowLast(root))).toBe(32);

		keyboard(300);
		await until(() =>
			document.documentElement.hasAttribute("data-keyboard-open"),
		);
		await settle();
		expect(paddingBottom(composer(root))).toBe(8);
		const shell = root
			.querySelector("[data-mobile-shell]")
			?.getBoundingClientRect();
		expect(
			Math.round(
				(shell?.bottom ?? 0) - composerBox(root).getBoundingClientRect().bottom,
			),
		).toBe(8);
		expect(distance(root)).toBeLessThanOrEqual(1);
		expect(Math.round(gapBelowLast(root))).toBe(32);
	});

	it("shows a sent message as pending from its first frame, pinned above the composer", async () => {
		const { root, feed } = await openGeneral();
		setLatency(400);
		const text = "Pinned from the first frame";
		const editor = chat(root).querySelector<HTMLElement>('[role="textbox"]');
		if (!editor) throw new Error("no composer");
		editor.focus();
		await userEvent.keyboard(text);
		const send = button(chat(root), "Send message");
		if (!send) throw new Error("no send button");

		type Sample = {
			state?: string;
			dimmed: boolean;
			below: number;
			distance: number;
		};
		const samples: Sample[] = [];
		let sampling = true;
		const sample = () => {
			if (!sampling) return;
			const row = lastRow(root);
			if (!row.textContent?.includes(text)) return;
			samples.push({
				state: row.dataset.state,
				dimmed: row.hasAttribute("data-dimmed"),
				below:
					row.getBoundingClientRect().bottom -
					composerBox(root).getBoundingClientRect().top,
				distance: distance(root),
			});
		};
		const loop = () => {
			if (!sampling) return;
			requestAnimationFrame(() => {
				setTimeout(() => {
					sample();
					loop();
				});
			});
		};
		loop();
		send.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
		send.click();
		sample();
		await until(() => feed.messages().some((message) => message.text === text));
		await settle();
		sampling = false;

		expect(samples.length).toBeGreaterThan(2);
		expect(samples[0]).toMatchObject({ state: "pending", dimmed: true });
		const firstSent = samples.findIndex((entry) => entry.state === "sent");
		expect(firstSent).toBeGreaterThan(0);
		for (const entry of samples.slice(0, firstSent))
			expect(entry).toMatchObject({ state: "pending", dimmed: true });
		for (const entry of samples.slice(firstSent))
			expect(entry).toMatchObject({ state: "sent", dimmed: false });
		for (const entry of samples) {
			expect(entry.below).toBeLessThanOrEqual(-7.5);
			expect(entry.distance).toBeLessThanOrEqual(1);
		}
	});
});
