import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { expectNoLayoutIssues } from "../../../../ui/src/foundations/layout-test";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext } from "../../data/store";
import { Providers } from "../../providers";
import { MobileShell } from "../../shell/MobileShell";

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

const mount = async () => {
	setLatency(0);
	history.replaceState(null, "", "/app/inbox");
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
	await until(() => !!host?.querySelector("[data-inbox-row]"));
	return { store, host };
};

const rows = (root: HTMLElement) =>
	Array.from(root.querySelectorAll<HTMLElement>("[data-inbox-row]"));

describe("inbox tab", () => {
	it("groups notifications by Space and marks rows and groups read", async () => {
		const { store, host: root } = await mount();
		const tab = root.querySelector<HTMLElement>(
			'[role="tab"][aria-label*="Inbox"], [data-value="inbox"]',
		);
		expect(store.notifications.unreadCount()).toBeGreaterThan(0);
		expect(root.textContent).toContain("unread");
		expect(tab === null || tab instanceof HTMLElement).toBe(true);
		const groups = root.querySelectorAll("[data-inbox-list]");
		expect(groups.length).toBe(3);
		await expectNoLayoutIssues(root);

		const unread = rows(root).find((row) => !row.hasAttribute("data-read"));
		const id = unread?.dataset.inboxId ?? "";
		unread
			?.querySelector<HTMLElement>('button[aria-label="Mark as read"]')
			?.click();
		await until(
			() => !root.querySelector(`[data-inbox-id="${CSS.escape(id)}"]`),
		);

		const before = store.notifications.unreadCount();
		const groupButton = root.querySelector<HTMLElement>(
			"[data-inbox-group-actions] button",
		);
		groupButton?.click();
		await until(() => store.notifications.unreadCount() < before);

		root.querySelector<HTMLElement>("[data-inbox-mark-filter-read]")?.click();
		await until(() => store.notifications.unreadCount() === 0);
		await until(() => rows(root).length === 0);
		expect(root.querySelector("[data-inbox-group-actions] button")).toBeNull();
		expect(root.querySelector("[data-inbox-mark-filter-read]")).toBeNull();
	});

	it("marks only the current tab read from inside the tab", async () => {
		const { store, host: root } = await mount();
		const markAll = root.querySelector<HTMLElement>(
			"[data-inbox-mark-filter-read]",
		);
		expect(markAll?.textContent).toBe("Mark all as read");
		expect(markAll?.closest("[data-inbox-group]")).toBeNull();
		const replies = Array.from(
			root.querySelectorAll<HTMLElement>('[role="radio"], button, label'),
		).find((element) => element.textContent?.trim().startsWith("Replies"));
		replies?.click();
		await until(
			() =>
				root.querySelector("[data-inbox-mark-filter-read]")?.textContent ===
				"Mark replies as read",
		);
		const unreadMentions = () =>
			store.notifications
				.items()
				.filter((entry) => !entry.seenAt && entry.kind !== "reply").length;
		const mentionsBefore = unreadMentions();
		expect(mentionsBefore).toBeGreaterThan(0);
		root.querySelector<HTMLElement>("[data-inbox-mark-filter-read]")?.click();
		await until(() => rows(root).length === 0);
		expect(root.querySelector("[data-inbox-mark-filter-read]")).toBeNull();
		expect(unreadMentions()).toBe(mentionsBefore);
	});

	it("clears the Space mention pill when a mention is marked read", async () => {
		const { store, host: root } = await mount();
		const mention = store.notifications
			.items()
			.find(
				(entry) => !entry.seenAt && !entry.thread && entry.kind === "mention",
			);
		if (!mention) throw new Error("no unread channel mention");
		const community = store.communities
			.value()
			?.find((entry) => entry.did === mention.community);
		if (!community) throw new Error("community missing");
		const space = store.space(community);
		await until(() => space.totals().mentions > 0);
		const before = space.totals().mentions;
		root
			.querySelector<HTMLElement>(
				`[data-inbox-id="${CSS.escape(mention.id)}"] button[aria-label="Mark as read"]`,
			)
			?.click();
		await until(() => space.totals().mentions === before - 1);
		await wait(50);
		expect(space.totals().mentions).toBe(before - 1);
	});

	it("filters to replies", async () => {
		const { host: root } = await mount();
		const replies = Array.from(
			root.querySelectorAll<HTMLElement>('[role="radio"], button, label'),
		).find((element) => element.textContent?.trim().startsWith("Replies"));
		replies?.click();
		await until(() =>
			rows(root).every((row) => row.dataset.inboxKind === "reply"),
		);
		expect(rows(root).length).toBeGreaterThan(0);
	});

	it("opens the chat in its Space, marks it read and backs out to the channel list", async () => {
		const { store, host: root } = await mount();
		const target = store.notifications
			.items()
			.filter((entry) => !entry.thread && !entry.seenAt)
			.at(-1);
		if (!target?.message) throw new Error("no channel notification");
		const row = root.querySelector<HTMLElement>(
			`[data-inbox-id="${CSS.escape(target.id)}"] [data-inbox-open]`,
		);
		row?.click();
		const channel = target.channel.slice(target.channel.lastIndexOf("/") + 1);
		await until(() =>
			location.pathname.endsWith(`/${encodeURIComponent(channel)}`),
		);
		expect(location.pathname.startsWith(`/app/c/${target.community}/`)).toBe(
			true,
		);
		expect(
			store.notifications.items().find((entry) => entry.id === target.id)
				?.seenAt,
		).toBeTruthy();
		const key = CSS.escape(target.message.rkey);
		await until(
			() =>
				!!root.querySelector(
					`[data-pane-index="1"] [data-message-key="${key}"][data-highlight]`,
				),
		);
		await wait(400);
		history.back();
		await until(() => location.pathname === `/app/c/${target.community}`);
	});

	it("opens a thread notification on top of its channel", async () => {
		const { store, host: root } = await mount();
		const target = store.notifications
			.items()
			.find((entry) => !!entry.thread && !entry.seenAt);
		if (!target?.thread) throw new Error("no thread notification");
		root
			.querySelector<HTMLElement>(
				`[data-inbox-id="${CSS.escape(target.id)}"] [data-inbox-open]`,
			)
			?.click();
		const thread = target.thread.slice(target.thread.lastIndexOf("/") + 1);
		await until(() => location.pathname.endsWith(`/t/${thread}`));
		await wait(400);
		history.back();
		const channel = target.channel.slice(target.channel.lastIndexOf("/") + 1);
		await until(() => location.pathname.endsWith(`/${channel}`));
	});

	it("clears every rail pill after marking everything read", async () => {
		const { store, host: root } = await mount();
		const spaces = store.communities.value() ?? [];
		await until(() =>
			spaces.some((community) => store.space(community).totals().mentions > 0),
		);
		root.querySelector<HTMLElement>("[data-inbox-mark-filter-read]")?.click();
		await until(() => store.notifications.unreadCount() === 0);
		await wait(100);
		const left = spaces.map(
			(community) =>
				`${community.name}:${store.space(community).totals().mentions}`,
		);
		expect(left.join(",")).toBe(
			spaces.map((community) => `${community.name}:0`).join(","),
		);
	});
});
