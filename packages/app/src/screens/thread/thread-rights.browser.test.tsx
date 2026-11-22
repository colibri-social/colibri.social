import "../../app.css";
import { render } from "solid-js/web";
import { afterEach, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext } from "../../data/store";
import type { MessageView, SpaceRef, ThreadView } from "../../data/types";
import { Providers } from "../../providers";
import { DesktopShell } from "../../shell/desktop/DesktopShell";
import { DEV_PATH, HQ, until } from "../channel/desktop-test-kit";

const THREAD_PATH = `${DEV_PATH}/t/spring-tuning/full`;
const OTHER_THREAD =
	`at://${HQ}/space/social.colibri.beta.channel.thread/bearing-notes` as SpaceRef;

let dispose: (() => void) | undefined;

afterEach(() => {
	dispose?.();
	dispose = undefined;
	document.body.replaceChildren();
	history.replaceState(null, "", "/");
});

const threadPane = () =>
	document.querySelector<HTMLElement>("[data-thread-view]");

const springRecord = (source: ReturnType<typeof createMockSource>) => {
	const record = source.world.spaces
		.flatMap((space) => space.threads)
		.find((entry) => entry.view.name === "Spring tuning");
	if (!record) throw new Error("Seed changed");
	return record;
};

const devRecord = (source: ReturnType<typeof createMockSource>) => {
	const record = springRecord(source);
	const channel = source.world.spaces
		.flatMap((space) => space.channels)
		.find((entry) => entry.view.space === record.view.channel);
	if (!channel) throw new Error("Seed changed");
	return channel;
};

const mountThread = async (
	prepare: (source: ReturnType<typeof createMockSource>) => void,
) => {
	setLatency(0);
	await page.viewport(1440, 900);
	history.replaceState(null, "", THREAD_PATH);
	const source = createMockSource({ live: false });
	prepare(source);
	const store = createDataStore(source);
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
	await until(
		() =>
			!!threadPane()?.querySelector("[data-message-list-scroller]") &&
			!!threadPane()?.querySelector("article[data-message-key]"),
	);
	return { source, store };
};

it("disables the thread composer when the parent channel is read-only", async () => {
	await mountThread((source) => {
		const channel = devRecord(source);
		channel.view = {
			...channel.view,
			viewer: { ...channel.view.viewer, canPost: false },
		};
		expect(springRecord(source).view.viewer.canPost).toBe(true);
	});
	await until(
		() => !!threadPane()?.textContent?.includes("You can't post in this"),
	);
	expect(threadPane()?.querySelector('[contenteditable="true"]')).toBeNull();
});

it("opens a forwarded thread source from inside another thread", async () => {
	await mountThread((source) => {
		const space = source.world.spaces.find((entry) =>
			entry.threads.some((thread) => thread.view.name === "Spring tuning"),
		);
		const spring = springRecord(source);
		if (!space) throw new Error("Seed changed");
		const other: ThreadView = {
			...spring.view,
			space: OTHER_THREAD,
			name: "Bearing notes",
			anchor: undefined,
			anchorMessage: undefined,
		};
		space.threads.push({ view: other, messages: [] });
		const last = spring.messages.at(-1) as MessageView;
		spring.messages.push({
			...last,
			rkey: "3zzzzzzzzzzzy",
			text: "",
			facets: undefined,
			forward: {
				source: { space: OTHER_THREAD, did: last.author.did, rkey: "3aaa" },
				sourceName: "Bearing notes",
				sourceCommunity: HQ,
				createdAt: last.createdAt,
				text: "Grease the outer race",
				attachments: [],
			},
		} as MessageView);
	});
	const chip = () =>
		threadPane()?.querySelector<HTMLElement>("button[data-forward-source]");
	await until(() => !!chip());
	await userEvent.click(chip() as HTMLElement);
	await until(() => location.pathname.includes("/t/bearing-notes"));
	expect(location.pathname).toContain("/t/bearing-notes");
});
