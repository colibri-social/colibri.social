import { render } from "solid-js/web";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext } from "../../data/store";
import type { SpaceRef } from "../../data/types";
import { Providers } from "../../providers";
import { MobileShell } from "../../shell/MobileShell";
import { DEV_PATH, HQ, until } from "../channel/desktop-test-kit";

const THREAD_PATH = `${DEV_PATH}/t/spring-tuning`;
const SPRING =
	`at://${HQ}/space/social.colibri.beta.channel.thread/spring-tuning` as SpaceRef;

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

const TRIGGER = "Spring tuning, show members";

const threadHeader = (root: HTMLElement) =>
	Array.from(
		root.querySelectorAll<HTMLElement>('[data-channel-header="mobile"]'),
	).find((header) => !!buttonIn(header, TRIGGER));

const buttonIn = (scope: ParentNode | null | undefined, name: string) =>
	Array.from(scope?.querySelectorAll<HTMLElement>("button") ?? []).find(
		(button) => button.getAttribute("aria-label") === name,
	);

const infoBar = (root: HTMLElement) =>
	root.querySelector<HTMLElement>("[data-channel-info-bar]");

const mount = async (
	prepare?: (source: ReturnType<typeof createMockSource>) => void,
	path = THREAD_PATH,
) => {
	setLatency(0);
	history.replaceState(null, "", path);
	const source = createMockSource({ live: false });
	prepare?.(source);
	const store = createDataStore(source);
	const root = document.createElement("div");
	host = root;
	root.style.cssText = "position:fixed;inset:0;width:402px;height:874px";
	document.body.append(root);
	stop = render(
		() => (
			<DataContext.Provider value={store}>
				<Providers>
					<MobileShell />
				</Providers>
			</DataContext.Provider>
		),
		root,
	);
	await until(() => !!threadHeader(root) || !!infoBar(root));
	return { root, store };
};

it("opens the thread's info from the thread name and keeps the thread options", async () => {
	const { root, store } = await mount();
	const header = threadHeader(root);
	expect(buttonIn(header, "Thread options")).toBeDefined();
	buttonIn(header, TRIGGER)?.click();
	await until(() => location.pathname === `${THREAD_PATH}/members`);
	await until(() => !!buttonIn(infoBar(root), "Mute thread"));
	const bar = infoBar(root);
	expect(buttonIn(bar, "Back to Spring tuning")).toBeDefined();
	expect(buttonIn(bar, "Channel settings")).toBeUndefined();
	const summary = root.querySelector("[data-channel-info-summary]");
	expect(summary?.querySelector("[data-channel-info-name]")?.textContent).toBe(
		"Spring tuning",
	);
	expect(summary?.textContent).toContain("in #dev");
	buttonIn(bar, "Mute thread")?.click();
	await until(() => !!buttonIn(infoBar(root), "Unmute thread"));
	expect(store.isMuted(SPRING)).toBe(true);
	buttonIn(infoBar(root), "Thread options")?.click();
	await until(
		() => !!document.querySelector('[aria-label="Spring tuning options"]'),
	);
});

it("restores the thread's info from its path and hides the options without manage rights", async () => {
	const { root } = await mount((source) => {
		const record = source.world.spaces
			.flatMap((space) => space.threads)
			.find((entry) => entry.view.space === SPRING);
		if (!record) throw new Error("Seed changed");
		record.view = {
			...record.view,
			viewer: {
				...record.view.viewer,
				canManage: false,
				canEdit: false,
				canClose: false,
				canLock: false,
				canDelete: false,
			},
		};
	}, `${THREAD_PATH}/members`);
	await until(() => !!buttonIn(infoBar(root), "Mute thread"));
	const bar = infoBar(root);
	expect(buttonIn(bar, "Thread options")).toBeUndefined();
	expect(buttonIn(bar, "Back to Spring tuning")).toBeDefined();
	buttonIn(bar, "Back to Spring tuning")?.click();
	await until(() => location.pathname === THREAD_PATH);
});
