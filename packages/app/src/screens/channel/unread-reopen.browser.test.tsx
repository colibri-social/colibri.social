import "../../app.css";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { skeyOf } from "../../data/ids";
import {
	createMockSource,
	type MockSource,
	setLatency,
} from "../../data/mock/source";
import { createDataStore, DataContext } from "../../data/store";
import { Providers } from "../../providers";
import { MobileShell } from "../../shell/MobileShell";

const HQ = "did:plc:colibrihqspace2a4b6c8d";

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
let originalPath = "/";

beforeEach(() => {
	originalPath = location.pathname + location.search;
});

afterEach(() => {
	stop?.();
	host?.remove();
	history.replaceState(null, "", originalPath);
});

const mount = async (
	options: { prepare?: (source: MockSource) => Promise<void> } = {},
) => {
	setLatency(0);
	history.replaceState(null, "", "/");
	const source = createMockSource({ live: false });
	await options.prepare?.(source);
	const [epoch] = createSignal<number | undefined>(1);
	const store = createDataStore(
		source,
		options.prepare ? { live: { epoch } } : {},
	);
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

const channelButton = (root: HTMLElement, name: string) =>
	Array.from(root.querySelectorAll<HTMLElement>("button")).find(
		(element) => element.textContent?.trim().startsWith(name) ?? false,
	);

const divider = (root: HTMLElement) =>
	Array.from(root.querySelectorAll<HTMLElement>("*")).find(
		(element) =>
			element.childElementCount === 0 &&
			/new messages/i.test(element.textContent ?? ""),
	);

const chatOpen = () => location.pathname.endsWith("/general");

describe("unread marker", () => {
	it("opens at the marker again after new messages arrive while away", async () => {
		const { source, root } = await mount();
		const space = source.world.spaces.find((entry) => entry.did === HQ);
		const general = space?.channels.find(
			(entry) => skeyOf(entry.view.space) === "general",
		);
		const author = space?.members.find(
			(member) => member.actor.did !== source.world.viewerDid,
		)?.actor.did;
		if (!general || !author) throw new Error("Seed changed");

		await until(() => !!channelButton(root, "general"));
		await wait(300);
		channelButton(root, "general")?.click();
		await until(() => chatOpen() && !!divider(root));
		await wait(600);

		history.back();
		await until(() => !chatOpen());
		await wait(600);

		const arrived = source.simulateMessage({
			author,
			channel: general.view.space,
			text: "Fresh news from while you were away",
		});
		await wait(100);

		channelButton(root, "general")?.click();
		await until(() => chatOpen());
		await until(() => !!divider(root));
		await wait(300);
		const marker = divider(root);
		expect(marker).toBeTruthy();
		const fresh = Array.from(root.querySelectorAll<HTMLElement>("*")).find(
			(element) =>
				element.childElementCount === 0 && element.textContent === arrived.text,
		);
		expect(fresh).toBeTruthy();
		const markerTop = marker?.getBoundingClientRect().top ?? 0;
		const freshTop = fresh?.getBoundingClientRect().top ?? 0;
		expect(freshTop).toBeGreaterThan(markerTop);
		expect(freshTop - markerTop).toBeLessThan(200);
	});

	it("opens a never-opened channel at the marker from the live tail", async () => {
		const seed = createMockSource({ live: false });
		const generalRef = seed.world.spaces
			.find((entry) => entry.did === HQ)
			?.channels.find((entry) => skeyOf(entry.view.space) === "general")
			?.view.space;
		if (!generalRef) throw new Error("Seed changed");
		const { source, root, store } = await mount({
			prepare: (mock) => mock.markRead(generalRef),
		});
		const author = source.world.spaces
			.find((entry) => entry.did === HQ)
			?.members.find((member) => member.actor.did !== source.world.viewerDid)
			?.actor.did;
		if (!author) throw new Error("Seed changed");
		await until(() => !!channelButton(root, "general"));
		await until(() => !!store.lastMessage(generalRef));
		await wait(300);
		const arrived = source.simulateMessage({
			author,
			channel: generalRef,
			text: "Live news for a channel you never opened",
		});
		channelButton(root, "general")?.click();
		await until(() => chatOpen());
		await until(() => !!divider(root));
		await wait(300);
		const marker = divider(root);
		const fresh = Array.from(root.querySelectorAll<HTMLElement>("*")).find(
			(element) =>
				element.childElementCount === 0 && element.textContent === arrived.text,
		);
		expect(fresh).toBeTruthy();
		const markerTop = marker?.getBoundingClientRect().top ?? 0;
		const freshTop = fresh?.getBoundingClientRect().top ?? 0;
		expect(freshTop).toBeGreaterThan(markerTop);
		expect(freshTop - markerTop).toBeLessThan(200);
	});
});
