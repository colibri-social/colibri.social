import "../../app.css";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { expectNoLayoutIssues } from "../../../../ui/src/foundations/layout-test";
import { skeyOf } from "../../data/ids";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext } from "../../data/store";
import type { SpaceRef } from "../../data/types";
import { Providers } from "../../providers";
import { MobileShell } from "../../shell/MobileShell";

const HQ = "did:plc:colibrihqspace2a4b6c8d";
const TEXT = "social.colibri.beta.channel.text";
const DEV = `/app/c/${HQ}/${TEXT}/dev`;
const DEV_REF = `at://${HQ}/space/${TEXT}/dev` as SpaceRef;

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

let stop: (() => void) | undefined;
let host: HTMLDivElement | undefined;
let originalPath = "/";

beforeEach(() => {
	originalPath = location.pathname + location.search;
});

afterEach(() => {
	stop?.();
	host?.remove();
	history.replaceState(null, "", originalPath);
});

const createStore = () => {
	setLatency(0);
	return createDataStore(createMockSource({ live: false }));
};

const mount = (path: string, store = createStore()) => {
	history.replaceState(null, "", path);
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
	return host;
};

const articleWith = (root: ParentNode, text: string) =>
	Array.from(root.querySelectorAll<HTMLElement>("article")).find((element) =>
		element.textContent?.includes(text),
	);

const hold = async (element: HTMLElement) => {
	const box = element.getBoundingClientRect();
	const init = {
		bubbles: true,
		pointerType: "touch",
		pointerId: 900,
		isPrimary: true,
		button: 0,
		clientX: box.left + box.width / 2,
		clientY: box.top + box.height / 2,
	};
	element.dispatchEvent(new PointerEvent("pointerdown", init));
	await new Promise((resolve) => setTimeout(resolve, 500));
	element.dispatchEvent(new PointerEvent("pointerup", init));
	element.click();
};

const buttonLabels = (scope: ParentNode) =>
	Array.from(scope.querySelectorAll<HTMLElement>("button")).map(
		(element) =>
			element.getAttribute("aria-label") ?? element.textContent?.trim() ?? "",
	);

const precedes = (first: Node, second: Node) =>
	!!(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);

describe("conversation start", () => {
	it("shows the parent message above the start of the thread", async () => {
		const root = mount(`${DEV}/t/spring-tuning`);
		await until(() => !!root.querySelector("[data-thread-anchor]"));
		const anchor = root.querySelector<HTMLElement>("[data-thread-anchor]");
		if (!anchor) throw new Error("No anchor");
		const parent = articleWith(anchor, "Here's the stack driver I mentioned");
		expect(parent).toBeDefined();
		const divider = anchor.querySelector<HTMLElement>("[data-thread-start]");
		expect(divider?.textContent).toContain("Start of thread");
		await until(() => !!articleWith(root, "Starting with"));
		const first = articleWith(root, "Starting with");
		if (!parent || !divider || !first) throw new Error("Missing rows");
		expect(precedes(parent, divider)).toBe(true);
		expect(precedes(divider, first)).toBe(true);
		expect(root.querySelector('[data-conversation-start="thread"]')).toBeNull();
		parent.click();
		await new Promise((resolve) => setTimeout(resolve, 300));
		expect(location.pathname).toBe(`${DEV}/t/spring-tuning`);
		await expectNoLayoutIssues(anchor);
		await hold(parent);
		await until(() =>
			Array.from(document.querySelectorAll('[role="dialog"]')).some((dialog) =>
				buttonLabels(dialog).includes("Copy text"),
			),
		);
		const drawer = Array.from(
			document.querySelectorAll<HTMLElement>('[role="dialog"]'),
		).find((dialog) => buttonLabels(dialog).includes("Copy text"));
		const labels = buttonLabels(drawer as HTMLElement);
		expect(labels).not.toContain("Reply");
		expect(labels).not.toContain("Open thread");
		expect(labels).not.toContain("Select messages");
		expect(labels).not.toContain("Edit message");
		expect(labels).toContain("Forward");
		expect(labels).not.toContain("Delete message");
		expect(labels).not.toContain("Hide message");
	});

	it("shows only the start indicator for a thread without a parent", async () => {
		const store = createStore();
		await until(() => store.channel(DEV_REF).ready());
		const created = await store
			.channel(DEV_REF)
			.createThread({ name: "Release checklist" });
		const root = mount(`${DEV}/t/${skeyOf(created.space)}`, store);
		await until(
			() => !!root.querySelector('[data-conversation-start="thread"]'),
		);
		const start = root.querySelector<HTMLElement>(
			'[data-conversation-start="thread"]',
		);
		expect(start?.textContent).toContain("Release checklist");
		expect(start?.textContent).toContain("This is the start of this thread.");
		expect(root.querySelector("[data-thread-anchor]")).toBeNull();
	});

	it("shows the start of the channel once the oldest message is loaded", async () => {
		const root = mount(DEV);
		await until(() => !!root.querySelector("[data-message-list-scroller]"));
		await until(() => !!root.querySelector("article"));
		const scroller = root.querySelector<HTMLElement>(
			"[data-message-list-scroller]",
		);
		if (!scroller) throw new Error("No scroller");
		await until(() => {
			scroller.scrollTop = 0;
			scroller.dispatchEvent(new Event("scroll"));
			return !!root.querySelector('[data-conversation-start="channel"]');
		}, 20000);
		const start = root.querySelector<HTMLElement>(
			'[data-conversation-start="channel"]',
		);
		expect(start?.querySelector("h2")?.textContent).toBe("Welcome to #dev");
		expect(start?.textContent).toContain("This is the start of #dev.");
		await expectNoLayoutIssues(start as HTMLElement);
	}, 30000);
});
