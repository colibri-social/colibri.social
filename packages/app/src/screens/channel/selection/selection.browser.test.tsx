import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { expectNoLayoutIssues } from "../../../../../ui/src/foundations/layout-test";
import { skeyOf } from "../../../data/ids";
import { createMockSource, setLatency } from "../../../data/mock/source";
import { createDataStore, DataContext } from "../../../data/store";
import type { MessageView, SpaceRef } from "../../../data/types";
import { Providers } from "../../../providers";
import { whenHistoryIdle } from "../../../shell/history-go";
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
let originalPath = "/";
let pointerId = 40;

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

const historyIdle = () =>
	new Promise<void>((resolve) => whenHistoryIdle(resolve));

const mount = async () => {
	setLatency(0);
	await historyIdle();
	history.replaceState(null, "", DEV_PATH);
	const source = createMockSource({ live: false });
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
	await until(
		() =>
			(host?.querySelectorAll('[data-pane-index="1"] [data-message]').length ??
				0) > 3,
	);
	const community = store.communities
		.value()
		?.find((entry) => entry.did === HQ);
	if (!community) throw new Error("hq missing");
	const dev = store.space(community).channelBySlug("dev");
	if (!dev) throw new Error("dev missing");
	const feed = store.channel(dev.space);
	await until(() => feed.ready());
	return { source, store, feed, root: host };
};

const chatPane = (root: HTMLElement, index = 1) =>
	root.querySelector(`[data-pane-index="${index}"]`) as HTMLElement;

const rowFor = (root: HTMLElement, message: MessageView, pane = 1) =>
	chatPane(root, pane).querySelector<HTMLElement>(
		`[data-message-key="${CSS.escape(message.rkey)}"]`,
	);

const hold = async (element: HTMLElement) => {
	const box = element.getBoundingClientRect();
	const init = {
		bubbles: true,
		cancelable: true,
		pointerType: "touch",
		isPrimary: true,
		pointerId: ++pointerId,
		clientX: box.left + box.width / 2,
		clientY: box.top + Math.min(20, box.height / 2),
	};
	element.dispatchEvent(new PointerEvent("pointerdown", init));
	await wait(550);
	element.dispatchEvent(new PointerEvent("pointerup", init));
	element.click();
};

const buttonNamed = (name: string | RegExp, scope: ParentNode = document) =>
	Array.from(scope.querySelectorAll<HTMLElement>("button")).find((button) => {
		const label =
			button.getAttribute("aria-label") ?? button.textContent?.trim() ?? "";
		return typeof name === "string" ? label === name : name.test(label);
	});

const pickable = (messages: readonly MessageView[], anchors: Set<string>) =>
	messages.filter((message) => !anchors.has(message.rkey)).slice(-3);

const startSelection = async (
	root: HTMLElement,
	first: MessageView,
	pane = 1,
) => {
	const row = rowFor(root, first, pane);
	if (!row) throw new Error("row missing");
	row.scrollIntoView({ block: "center" });
	await wait(50);
	const target = rowFor(root, first, pane) ?? row;
	await hold(target);
	await until(() => !!buttonNamed("Select messages"));
	buttonNamed("Select messages")?.click();
	await until(() => !!buttonNamed("Cancel selection"));
	await until(() => !document.querySelector('[role="dialog"]'));
};

const toggle = (root: HTMLElement, message: MessageView) => {
	const button = rowFor(root, message)
		?.closest("[data-message-select]")
		?.querySelector<HTMLElement>("[data-message-select-toggle]");
	if (!button) throw new Error(`toggle missing for ${message.rkey}`);
	button.click();
};

const setup = async () => {
	const context = await mount();
	const threads = await context.source.listThreads(context.feed.channel);
	const spring = threads.find((thread) => thread.name === "Spring tuning");
	if (!spring) throw new Error("thread missing");
	const anchors = new Set(
		threads
			.map((thread) => (thread.anchor as { rkey?: string } | undefined)?.rkey)
			.filter((rkey): rkey is string => !!rkey),
	);
	const targets = pickable(context.feed.messages(), anchors);
	if (targets.length < 3) throw new Error("not enough messages");
	return { ...context, spring, targets };
};

describe("moving messages", () => {
	it("moves three messages into a thread with a moved line", async () => {
		const { store, feed, root, spring, targets } = await setup();
		const [first, second, third] = targets as [
			MessageView,
			MessageView,
			MessageView,
		];
		await startSelection(root, first);
		toggle(root, second);
		toggle(root, third);
		await until(() => !!root.textContent?.includes("3 messages selected"));
		await wait(200);
		const bar = root.querySelector<HTMLElement>("[data-message-selection-bar]");
		if (!bar) throw new Error("bar missing");
		await expectNoLayoutIssues(bar);
		const paneRight = chatPane(root).getBoundingClientRect().right;
		for (const target of targets) {
			const row = rowFor(root, target);
			expect(row?.getBoundingClientRect().right ?? 0).toBeLessThanOrEqual(
				paneRight + 1,
			);
			expect(
				row?.closest("[data-message-select]")?.hasAttribute("data-selected"),
			).toBe(true);
		}

		buttonNamed("Move to")?.click();
		await until(() => !!buttonNamed(/Spring tuning/));
		const drawer = document.querySelector<HTMLElement>('[role="dialog"]');
		if (!drawer) throw new Error("drawer missing");
		await wait(350);
		await expectNoLayoutIssues(drawer);
		buttonNamed(/Spring tuning/, drawer)?.click();

		const moved = new Set(targets.map((message) => message.rkey));
		await until(
			() => !feed.messages().some((message) => moved.has(message.rkey)),
		);
		await until(() => !buttonNamed("Cancel selection"));
		await until(() => !rowFor(root, first));

		const thread = store.channel(spring.space as SpaceRef);
		await until(() => thread.ready());
		await until(() =>
			targets.every((target) =>
				thread.messages().some((message) => message.rkey === target.rkey),
			),
		);

		const card = buttonNamed(/Spring tuning/, chatPane(root));
		if (!card) throw new Error("thread card missing");
		card.click();
		await until(() => location.pathname.endsWith(`/t/${skeyOf(spring.space)}`));
		await until(
			() =>
				(root.querySelectorAll('[data-pane-index="2"] [data-moved-from]')
					.length ?? 0) >= 3,
		);
		const line = root.querySelector('[data-pane-index="2"] [data-moved-from]');
		expect(line?.textContent).toContain("Moved from #dev");

		await wait(300);
		await startSelection(root, third, 2);
		buttonNamed("Move to")?.click();
		const dialog = () =>
			document.querySelector<HTMLElement>('[role="dialog"]') ?? undefined;
		await until(() => !!dialog() && !!buttonNamed("Back to #dev", dialog()));
		await wait(350);
		buttonNamed("Back to #dev", dialog())?.click();
		await until(() =>
			feed.messages().some((message) => message.rkey === third.rkey),
		);
		await until(
			() => !thread.messages().some((message) => message.rkey === third.rkey),
		);
		expect(
			root.querySelectorAll('[data-pane-index="2"] [data-moved-from]').length,
		).toBe(2);
	});

	const openPicker = async (root: HTMLElement, first: MessageView) => {
		await startSelection(root, first);
		buttonNamed("Move to")?.click();
		await until(() => !!document.querySelector("[data-move-picker]"));
		const picker = document.querySelector<HTMLElement>(
			"[data-move-picker]",
		) as HTMLElement;
		await wait(350);
		return picker;
	};

	const groupNamed = (picker: HTMLElement, name: string) =>
		Array.from(
			picker.querySelectorAll<HTMLElement>("[data-collapsible-group]"),
		).find(
			(group) =>
				group
					.querySelector("[data-collapsible-group-select]")
					?.textContent?.trim()
					.startsWith(name) ?? false,
		);

	it("groups threads under their channel with the current channel open first", async () => {
		const { root, targets } = await setup();
		const picker = await openPicker(root, targets[0] as MessageView);

		const groups = picker.querySelectorAll<HTMLElement>(
			"[data-collapsible-group]",
		);
		const dev = groupNamed(picker, "dev");
		expect(groups[0]).toBe(dev);
		expect(dev?.hasAttribute("data-expanded")).toBe(true);
		expect(dev?.textContent).toContain("this channel");
		expect(buttonNamed(/Spring tuning/, dev)).toBeDefined();
		expect(buttonNamed("New thread in #dev", dev)).toBeDefined();

		const general = groupNamed(picker, "general");
		expect(general?.hasAttribute("data-expanded")).toBe(false);
		expect(buttonNamed("New thread in #general", general)).toBeUndefined();
		general
			?.querySelector<HTMLElement>("[data-collapsible-group-toggle]")
			?.click();
		await until(() => !!buttonNamed("New thread in #general", general));

		const drawer = picker.closest<HTMLElement>('[role="dialog"]');
		if (!drawer) throw new Error("drawer missing");
		await expectNoLayoutIssues(drawer);
	});

	it("searches threads and channels from the mobile drawer", async () => {
		const { root, targets } = await setup();
		const picker = await openPicker(root, targets[0] as MessageView);
		const search = picker.querySelector<HTMLInputElement>(
			'input[aria-label="Search destinations"]',
		);
		if (!search) throw new Error("search missing");
		search.focus();
		await userEvent.type(search, "spring");
		await until(
			() =>
				picker.querySelectorAll("[data-collapsible-group]").length === 1 &&
				!!buttonNamed(/Spring tuning/, picker),
		);
		expect(groupNamed(picker, "dev")).toBeDefined();

		await userEvent.clear(search);
		await userEvent.type(search, "zzz-nothing");
		await until(
			() => !!picker.textContent?.includes("Nothing matches your search."),
		);
	});

	it("starts a new thread in the channel it was picked under", async () => {
		const { source, store, root, targets } = await setup();
		const picker = await openPicker(root, targets[0] as MessageView);
		const general = groupNamed(picker, "general");
		general
			?.querySelector<HTMLElement>("[data-collapsible-group-toggle]")
			?.click();
		await until(() => !!buttonNamed("New thread in #general", general));
		buttonNamed("New thread in #general", general)?.click();
		await until(() => !!document.querySelector('input[maxlength="128"]'));
		const name = document.querySelector<HTMLInputElement>(
			'input[maxlength="128"]',
		) as HTMLInputElement;
		name.value = "Moved here";
		name.dispatchEvent(new InputEvent("input", { bubbles: true }));
		await until(() => {
			const move = buttonNamed("Move");
			return !!move && !move.hasAttribute("disabled");
		});
		buttonNamed("Move")?.click();
		await until(() => !buttonNamed("Cancel selection"));

		const hq = store.communities.value()?.find((entry) => entry.did === HQ);
		const channel = hq ? store.space(hq).channelBySlug("general") : undefined;
		if (!channel) throw new Error("general missing");
		const threads = await source.listThreads(channel.space);
		expect(threads.some((thread) => thread.name === "Moved here")).toBe(true);
	});

	it("explains why threads are missing when a selected message started one", async () => {
		const { store, feed, root, spring } = await setup();
		await until(() => !!feed.threads.value());
		const anchor = (spring.anchor as { rkey?: string } | undefined)?.rkey;
		const message = feed.messages().find((entry) => entry.rkey === anchor);
		if (!message) throw new Error("anchor message missing");
		expect(store).toBeDefined();
		const picker = await openPicker(root, message);
		expect(picker.querySelector("[data-move-anchored]")?.textContent).toContain(
			"can only move to a channel",
		);
		expect(buttonNamed(/Spring tuning/, picker)).toBeUndefined();
	});

	it("exits selection on back without leaving the chat", async () => {
		const { root, targets } = await setup();
		await startSelection(root, targets[0] as MessageView);
		const path = location.pathname;
		await until(
			() =>
				typeof (history.state as Record<string, unknown> | null)
					?.colibriOverlay !== "number",
		);
		await historyIdle();
		history.back();
		await until(() => !buttonNamed("Cancel selection"));
		await wait(300);
		expect(location.pathname).toBe(path);
		expect(path).toBe(DEV_PATH);
		expect(
			chatPane(root).querySelector("[data-message-select-toggle]"),
		).toBeNull();
	});

	it("puts the messages back when the move fails", async () => {
		const { source, feed, root, targets } = await setup();
		source.moveMessages = async () => {
			throw new Error("offline");
		};
		const [first, second] = targets as [MessageView, MessageView];
		await startSelection(root, first);
		toggle(root, second);
		await until(() => !!root.textContent?.includes("2 messages selected"));
		buttonNamed("Move to")?.click();
		await until(() => !!buttonNamed(/Spring tuning/));
		const drawer = document.querySelector<HTMLElement>('[role="dialog"]');
		await wait(350);
		buttonNamed(/Spring tuning/, drawer ?? document)?.click();
		await until(() => !!document.body.textContent?.includes("Couldn't move"));
		expect(feed.messages().some((message) => message.rkey === first.rkey)).toBe(
			true,
		);
		expect(
			feed.messages().some((message) => message.rkey === second.rkey),
		).toBe(true);
		const rkeys = feed.messages().map((message) => message.rkey);
		expect([...rkeys].sort()).toEqual(rkeys);
		expect(buttonNamed("Cancel selection")).toBeDefined();
	});
});
