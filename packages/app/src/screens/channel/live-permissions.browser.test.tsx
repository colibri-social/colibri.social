import "../../app.css";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { createMockSource, setLatency } from "../../data/mock/source";
import type { LiveEvent } from "../../data/source";
import { createDataStore, DataContext } from "../../data/store";
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
	setLatency(80, 260);
});

const mount = async () => {
	setLatency(0);
	history.replaceState(null, "", GENERAL);

	const base = createMockSource({ live: false });
	const listeners = new Set<(event: LiveEvent) => void>();
	const source = {
		...base,
		subscribe: (listener: (event: LiveEvent) => void) => {
			listeners.add(listener);
			const release = base.subscribe(listener);

			return () => {
				listeners.delete(listener);
				release();
			};
		},
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

	await until(() => !!store.communities.value());

	const hq = store.communities.value()?.find((entry) => entry.did === HQ);
	if (!hq) throw new Error("hq missing");

	const emit = (event: LiveEvent) => {
		for (const listener of listeners) listener(event);
	};

	return { root: host, space: store.space(hq), emit };
};

const chat = (root: HTMLElement) =>
	root.querySelector<HTMLElement>('[data-pane-index="1"]') as HTMLElement;

const editable = (root: HTMLElement) =>
	chat(root)?.querySelector<HTMLElement>("[data-composer] [contenteditable]");

describe("live channel permissions", () => {
	it("locks the composer when a channel update takes posting away and keeps the draft", async () => {
		const { root, space, emit } = await mount();

		await until(() => !!editable(root));

		const input = editable(root) as HTMLElement;

		input.focus();
		await userEvent.keyboard("half a thought");
		await until(() => input.textContent?.includes("half a thought") ?? false);

		const view = space.channelBySlug("general");
		if (!view) throw new Error("general missing");

		emit({
			$type: "channelEvent",
			event: "update",
			community: HQ,
			channel: {
				...view,
				viewer: {
					...view.viewer,
					canPost: false,
					permissions: (view.viewer.permissions ?? []).filter(
						(permission) => permission !== "message.send",
					),
				},
			},
		});

		await until(() => !editable(root));
		expect(chat(root).textContent).toContain("You can't post in this channel.");

		emit({
			$type: "channelEvent",
			event: "update",
			community: HQ,
			channel: view,
		});

		await until(() => !!editable(root));
		await until(
			() => editable(root)?.textContent?.includes("half a thought") ?? false,
		);
	});
});
