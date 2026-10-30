import { render } from "solid-js/web";
import { afterEach, expect, it } from "vitest";
import "../../../app.css";
import { createMockSource, setLatency } from "../../../data/mock/source";
import {
	createDataStore,
	DataContext,
	type DataStore,
} from "../../../data/store";
import { Providers } from "../../../providers";
import { MobileShell } from "../../../shell/MobileShell";

const HQ = "did:plc:colibrihqspace2a4b6c8d";
const DEV_PATH = `/app/c/${HQ}/social.colibri.beta.channel.text/dev`;

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let stop: (() => void) | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
	stop?.();
	host?.remove();
	history.replaceState(null, "", "/");
	setLatency(80, 260);
});

const pane = () => host?.querySelector('[data-pane-index="1"]') as HTMLElement;

const articleWith = (text: string) =>
	Array.from(pane().querySelectorAll<HTMLElement>("article")).find((entry) =>
		entry.textContent?.includes(text),
	);

const composerEditor = () =>
	pane().querySelector<HTMLElement>("[data-composer] [contenteditable='true']");

const composerFocused = () =>
	!!composerEditor()?.contains(document.activeElement);

const buttonNamed = (scope: ParentNode, name: string) =>
	Array.from(scope.querySelectorAll<HTMLElement>("button")).find(
		(element) =>
			(element.getAttribute("aria-label") ?? element.textContent?.trim()) ===
			name,
	);

const actionsDrawer = () =>
	Array.from(document.querySelectorAll<HTMLElement>("[role='dialog']")).find(
		(dialog) => dialog.getAttribute("aria-label") === "Message actions",
	);

const forwardSheet = () =>
	document.querySelector<HTMLElement>(
		'[role="dialog"][data-full-screen-sheet]',
	);

const hold = async (element: HTMLElement) => {
	const box = element.getBoundingClientRect();
	const init = {
		bubbles: true,
		pointerType: "touch",
		pointerId: 703,
		isPrimary: true,
		button: 0,
		clientX: box.left + box.width / 2,
		clientY: box.top + Math.min(20, box.height / 2),
	};
	element.dispatchEvent(new PointerEvent("pointerdown", init));
	await wait(500);
	element.dispatchEvent(new PointerEvent("pointerup", init));
	element.click();
};

const openActions = async (text: string) => {
	await hold(articleWith(text) as HTMLElement);
	await until(() => !!actionsDrawer());
	await wait(300);
	return actionsDrawer() as HTMLElement;
};

const mountWith = async (text: string) => {
	setLatency(0);
	history.replaceState(null, "", DEV_PATH);
	const store: DataStore = createDataStore(createMockSource({ live: false }));
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
	await until(
		() => (pane()?.querySelectorAll("[data-message]").length ?? 0) > 3,
	);
	const community = store.communities
		.value()
		?.find((entry) => entry.did === HQ);
	const dev = community
		? store.space(community).channelBySlug("dev")
		: undefined;
	if (!dev) throw new Error("dev missing");
	await store.channel(dev.space).send({ text });
	await until(() => !!articleWith(text) && !!composerEditor());
	await wait(400);
};

it("focuses the composer when Reply is picked from the hold drawer", async () => {
	const text = "Reply to me from the drawer";
	await mountWith(text);
	expect(composerFocused()).toBe(false);
	const drawer = await openActions(text);
	const reply = buttonNamed(drawer, "Reply");
	if (!reply) throw new Error("reply missing");
	reply.click();
	await until(() => composerFocused());
	await until(() => !actionsDrawer());
	await wait(400);
	expect(composerFocused()).toBe(true);
	const bars = Array.from(
		pane().querySelectorAll<HTMLElement>("[data-composer-bar]"),
	).map((bar) => bar.textContent ?? "");
	expect(bars.join("|")).toContain("Replying to");
});

it("blurs the composer when the forward sheet opens", async () => {
	const text = "Forward me from the drawer";
	await mountWith(text);
	composerEditor()?.focus();
	await until(() => composerFocused());
	const drawer = await openActions(text);
	const forward = buttonNamed(drawer, "Forward");
	if (!forward) throw new Error("forward missing");
	forward.click();
	await until(() => !!forwardSheet());
	await wait(800);
	expect(composerFocused()).toBe(false);
	expect(forwardSheet()?.contains(document.activeElement)).toBe(true);
	const search = forwardSheet()?.querySelector<HTMLInputElement>("input");
	if (!search) throw new Error("search missing");
	search.focus();
	expect(document.activeElement).toBe(search);
});
