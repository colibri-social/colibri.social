import { render } from "solid-js/web";
import { afterEach, expect, it } from "vitest";
import "../../../app.css";
import { createMockSource, setLatency } from "../../../data/mock/source";
import { createDataStore, DataContext } from "../../../data/store";
import { Providers } from "../../../providers";
import { MobileShell } from "../../../shell/MobileShell";

const HQ = "did:plc:colibrihqspace2a4b6c8d";
const DEV_PATH = `/app/c/${HQ}/social.colibri.beta.channel.text/dev`;
const TEXT = "Hold me for reactions";

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
});

const hold = async (element: HTMLElement) => {
	const box = element.getBoundingClientRect();
	const init = {
		bubbles: true,
		pointerType: "touch",
		pointerId: 702,
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

const pane = () => host?.querySelector('[data-pane-index="1"]') as HTMLElement;

const article = () =>
	Array.from(pane().querySelectorAll<HTMLElement>("article")).find((entry) =>
		entry.textContent?.includes(TEXT),
	);

const buttonNamed = (scope: ParentNode, name: string) =>
	Array.from(scope.querySelectorAll<HTMLElement>("button")).find(
		(element) =>
			(element.getAttribute("aria-label") ?? element.textContent?.trim()) ===
			name,
	);

const dialogNamed = (name: string) =>
	Array.from(document.querySelectorAll<HTMLElement>("[role='dialog']")).find(
		(dialog) =>
			dialog.getAttribute("aria-label") === name ||
			document
				.getElementById(dialog.getAttribute("aria-labelledby") ?? "")
				?.textContent?.trim() === name,
	);

const actionsDrawer = () => dialogNamed("Message actions");

const openActions = async () => {
	await hold(article() as HTMLElement);
	await until(() => !!actionsDrawer());
	await wait(300);
	return actionsDrawer() as HTMLElement;
};

it("opens the reactions drawer from the hold drawer once a message has reactions", async () => {
	setLatency(0);
	history.replaceState(null, "", DEV_PATH);
	const store = createDataStore(createMockSource({ live: false }));
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
	await store.channel(dev.space).send({ text: TEXT });
	await until(() => !!article());
	await wait(400);

	const bare = await openActions();
	expect(buttonNamed(bare, "Reactions")).toBeUndefined();
	const quick = Array.from(
		bare.querySelectorAll<HTMLElement>("[data-quick-reactions] button"),
	).find((button) => button.getAttribute("aria-label")?.startsWith("React"));
	if (!quick) throw new Error("quick reaction missing");
	quick.click();
	await until(() => !actionsDrawer());
	await until(() => !!article()?.querySelector("[data-reaction][data-mine]"));
	await wait(300);

	const reacted = await openActions();
	const row = buttonNamed(reacted, "Reactions");
	expect(row).toBeTruthy();
	(row as HTMLElement).click();
	await until(() => !actionsDrawer());
	await until(() => !!dialogNamed("Reactions"));
	expect(dialogNamed("Reactions")?.textContent).toBeTruthy();
});
