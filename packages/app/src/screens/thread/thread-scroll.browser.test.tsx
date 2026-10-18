import "../../app.css";
import { render } from "solid-js/web";
import { afterEach, expect, it } from "vitest";
import { page } from "vitest/browser";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext, type Load } from "../../data/store";
import type { SpaceRef, ThreadView } from "../../data/types";
import { Providers } from "../../providers";
import { DesktopShell } from "../../shell/desktop/DesktopShell";
import { DEV_PATH, HQ, TEXT, until, wait } from "../channel/desktop-test-kit";

const DEV_REF = `at://${HQ}/space/${TEXT}/dev` as SpaceRef;

let dispose: (() => void) | undefined;

afterEach(() => {
	dispose?.();
	dispose = undefined;
});

const scroller = () =>
	document.querySelector<HTMLElement>(
		"[data-thread-full] [data-message-list-scroller]",
	);

const mountWithDistantAnchor = async () => {
	setLatency(0);
	await page.viewport(1440, 900);
	history.replaceState(null, "", `${DEV_PATH}/t/spring-tuning/full`);
	const source = createMockSource({ live: false });
	const record = source.world.spaces
		.flatMap((space) => space.threads)
		.find((entry) => entry.view.name === "Spring tuning");
	if (!record?.view.anchor) throw new Error("Seed changed");
	record.view = {
		...record.view,
		anchor: { ...record.view.anchor, rkey: "3zzzzzzzzzzzz" },
	} as ThreadView;
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
	await until(() => !!scroller());
	return { store, source, record };
};

it("keeps the thread scroll position while the parent thread list refreshes", async () => {
	const { store, source, record } = await mountWithDistantAnchor();
	const feed = store.channel(record.view.space);
	await until(() => feed.ready());
	for (let index = 0; index < 30; index++) {
		await feed.send({ text: `Filler ${index}` });
	}
	await until(() => !!document.querySelector("[data-thread-anchor]"));
	await wait(800);
	const element = scroller() as HTMLElement;
	element.scrollTop = 400;
	await wait(500);
	const before = element.scrollTop;
	expect(before).toBeGreaterThan(0);

	record.view = {
		...record.view,
		lastActivityAt: new Date().toISOString(),
	} as ThreadView;
	const threads = store.channel(DEV_REF).threads as Load<ThreadView[]> & {
		refresh: () => Promise<void>;
	};
	await threads.refresh();
	await wait(500);
	expect(scroller()).toBe(element);
	expect(element.scrollTop).toBe(before);

	source.emit({
		$type: "threadEvent",
		event: "update",
		thread: { ...record.view, messageCount: 99 } as ThreadView,
	});
	await wait(500);
	expect(scroller()).toBe(element);
	expect(element.scrollTop).toBe(before);
});
