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
const OWLS = "did:plc:nightowlsartclub3e5f7g9h";
const PROMPTS = `/app/c/${OWLS}/${TEXT}/prompts`;

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

const mount = async (path = GENERAL, did = HQ) => {
	setLatency(0);
	history.replaceState(null, "", path);

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

	const community = store.communities
		.value()
		?.find((entry) => entry.did === did);
	if (!community) throw new Error("space missing");

	const emit = (event: LiveEvent) => {
		for (const listener of listeners) listener(event);
	};

	return { root: host, space: store.space(community), emit };
};

const chat = (root: HTMLElement) =>
	root.querySelector<HTMLElement>('[data-pane-index="1"]') as HTMLElement;

const reactionButton = (root: HTMLElement) =>
	chat(root)?.querySelector<HTMLButtonElement>(
		"[data-reaction-bar] [data-reaction]",
	);

const addReaction = (root: HTMLElement) =>
	chat(root)?.querySelector("[data-reaction-bar] [aria-label='Add reaction']");

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

	it("keeps reactions in a read-only channel until a channel update takes them away", async () => {
		const { root, space, emit } = await mount(PROMPTS, OWLS);

		await until(() => !!reactionButton(root));
		expect(editable(root)).toBeFalsy();
		expect(reactionButton(root)?.disabled).toBe(false);
		expect(addReaction(root)).toBeTruthy();

		const view = space.channelBySlug("prompts");
		if (!view) throw new Error("prompts missing");

		emit({
			$type: "channelEvent",
			event: "update",
			community: OWLS,
			channel: {
				...view,
				viewer: {
					...view.viewer,
					permissions: (view.viewer.permissions ?? []).filter(
						(permission) => permission !== "message.react",
					),
				},
			},
		});

		await until(() => reactionButton(root)?.disabled === true);
		expect(addReaction(root)).toBeNull();

		emit({
			$type: "channelEvent",
			event: "update",
			community: OWLS,
			channel: view,
		});

		await until(() => reactionButton(root)?.disabled === false);
		expect(addReaction(root)).toBeTruthy();
	});
});
