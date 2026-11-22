import "../../app.css";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext } from "../../data/store";
import { setVoiceSoundPlayer } from "../../data/voice";
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
let pointerSeed = 1900;

beforeEach(() => {
	originalPath = location.pathname + location.search;
});

afterEach(() => {
	stop?.();
	host?.remove();
	for (const dialog of document.body.querySelectorAll('[role="dialog"]')) {
		dialog.remove();
	}
	history.replaceState(null, "", originalPath);
});

const channelButton = (name: string) =>
	Array.from(
		document.querySelectorAll<HTMLElement>(
			'[data-pane-index="0"] [data-channel-row]',
		),
	)
		.find(
			(row) => row.querySelector("[data-channel-name]")?.textContent === name,
		)
		?.querySelector<HTMLElement>("a, button") ?? undefined;

const dialogNamed = (name: string) =>
	Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).find(
		(element) => element.getAttribute("aria-label") === name,
	);

const hold = async (element: HTMLElement) => {
	const box = element.getBoundingClientRect();
	const init = {
		bubbles: true,
		pointerType: "touch",
		pointerId: ++pointerSeed,
		isPrimary: true,
		button: 0,
		clientX: box.left + Math.min(40, box.width / 2),
		clientY: box.top + box.height / 2,
	};
	element.dispatchEvent(new PointerEvent("pointerdown", init));
	await wait(500);
	element.dispatchEvent(new PointerEvent("pointerup", init));
	element.click();
};

describe("channel mark as read", () => {
	it("reaches the server for a channel that was never opened", async () => {
		setLatency(0);
		setVoiceSoundPlayer(() => {});
		history.replaceState(null, "", `/app/c/${HQ}`);
		const source = createMockSource({ live: false });
		const marked: string[] = [];
		const markRead = source.markRead;
		source.markRead = (channel) => {
			marked.push(channel);
			return markRead(channel);
		};
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
		await until(() => !!channelButton("design"));
		await hold(channelButton("design") as HTMLElement);
		await until(() => !!dialogNamed("design options"));
		await wait(400);
		const menu = dialogNamed("design options") as HTMLElement;
		const button = Array.from(menu.querySelectorAll("button")).find(
			(element) => element.textContent?.trim() === "Mark as read",
		);
		expect(button).toBeDefined();
		button?.click();
		await until(() => marked.length > 0);
		expect(marked).toHaveLength(1);
		expect(marked[0]).toContain("design");
		const statuses = await source.listUnreadStatus(HQ);
		const design = statuses.find((entry) => entry.channel === marked[0]);
		expect(design?.hasUnread ?? false).toBe(false);
	});
});
