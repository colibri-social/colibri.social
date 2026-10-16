import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { expectNoLayoutIssues } from "../../../../ui/src/foundations/layout-test";
import { skeyOf } from "../../data/ids";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext } from "../../data/store";
import { Providers } from "../../providers";
import { MobileShell } from "../../shell/MobileShell";

const HQ = "did:plc:colibrihqspace2a4b6c8d";
const TEXT = "social.colibri.beta.channel.text";
const DEV_THREADS = `/app/c/${HQ}/${TEXT}/dev/threads`;

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
let pointerSeed = 100;

beforeEach(() => {
	originalPath = location.pathname + location.search;
});

afterEach(() => {
	stop?.();
	host?.remove();
	history.replaceState(null, "", originalPath);
});

const mount = async (path: string) => {
	setLatency(0);
	history.replaceState(null, "", path);
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
	return { store, root: host };
};

const buttonNamed = (scope: ParentNode, name: string | RegExp) =>
	Array.from(scope.querySelectorAll<HTMLElement>("button")).find((element) => {
		const label =
			element.getAttribute("aria-label") ?? element.textContent?.trim() ?? "";
		return typeof name === "string" ? label === name : name.test(label);
	});

const dialogNamed = (name: string) =>
	Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).find(
		(element) =>
			element.getAttribute("aria-label") === name ||
			element.textContent?.includes(name),
	);

const hold = async (element: HTMLElement) => {
	const box = element.getBoundingClientRect();
	const init = {
		bubbles: true,
		pointerType: "touch",
		pointerId: ++pointerSeed,
		isPrimary: true,
		button: 0,
		clientX: box.left + box.width / 2,
		clientY: box.top + box.height / 2,
	};
	element.dispatchEvent(new PointerEvent("pointerdown", init));
	await wait(500);
	element.dispatchEvent(
		new PointerEvent("pointermove", {
			...init,
			clientX: init.clientX + 2,
			clientY: init.clientY + 2,
		}),
	);
	element.dispatchEvent(new PointerEvent("pointerup", init));
	element.click();
};

const pickFilter = (root: HTMLElement, label: string) =>
	Array.from(root.querySelectorAll<HTMLElement>("label"))
		.find((element) => element.textContent?.trim() === label)
		?.click();

const threadRow = (root: HTMLElement, name: string) =>
	Array.from(
		root.querySelectorAll<HTMLElement>("[data-thread-list] button"),
	).find((element) => element.textContent?.includes(name));

const openListMenu = async (root: HTMLElement, name: string) => {
	await until(() => !!threadRow(root, name));
	const row = threadRow(root, name) as HTMLElement;
	await hold(row);
	await until(() => !!dialogNamed(`${name} options`));
	await wait(400);
	return dialogNamed(`${name} options`) as HTMLElement;
};

const closedDialogs = () =>
	until(() => !document.querySelector('[role="dialog"]'), 4000);

describe("thread chip menu", () => {
	it("opens the thread drawer from a hold on a thread card in the chat", async () => {
		const { root } = await mount(`/app/c/${HQ}/${TEXT}/dev`);
		const card = () =>
			Array.from(root.querySelectorAll<HTMLElement>("[data-thread]")).find(
				(element) => element.textContent?.includes("Spring tuning"),
			);
		await until(() => !!card());
		await wait(400);
		await hold(card() as HTMLElement);
		await until(() => !!dialogNamed("Spring tuning options"));
		await wait(400);
		expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
		expect(location.pathname.endsWith("/dev")).toBe(true);
		await expectNoLayoutIssues(
			dialogNamed("Spring tuning options") as HTMLElement,
		);
	});
});

describe("thread list", () => {
	it("lists a channel's threads, filters them and opens one", async () => {
		const { store, root } = await mount(DEV_THREADS);
		await until(() => !!threadRow(root, "Spring tuning"));
		expect(root.textContent).toContain("Threads in #dev");
		await wait(300);
		await expectNoLayoutIssues(
			root.querySelector('[data-pane-index="2"]') as HTMLElement,
		);

		pickFilter(root, "Unread");
		await until(() => !threadRow(root, "Spring tuning"));
		expect(root.textContent).toContain("Nothing matches that filter");
		pickFilter(root, "Following");
		await until(() => !!threadRow(root, "Spring tuning"));
		pickFilter(root, "All");

		(threadRow(root, "Spring tuning") as HTMLElement).click();
		await until(() => /\/dev\/threads\/t\/[^/]+$/.test(location.pathname));
		const view = store
			.channel(`at://${HQ}/space/${TEXT}/dev` as never)
			.threads.value()?.[0];
		expect(location.pathname.endsWith(`/t/${skeyOf(view?.space ?? "")}`)).toBe(
			true,
		);
		await until(
			() =>
				!!root.querySelector(
					'[data-pane-index="3"] [aria-label="Thread options"]',
				),
		);
		history.back();
		await until(() => location.pathname === DEV_THREADS);
	});

	it("renames a thread in place from a hold on its row", async () => {
		const { store, root } = await mount(DEV_THREADS);
		const drawer = await openListMenu(root, "Spring tuning");
		await expectNoLayoutIssues(drawer);
		buttonNamed(drawer, "Rename thread")?.click();
		await until(() => !!drawer.querySelector("input"));
		const input = drawer.querySelector("input") as HTMLInputElement;
		input.value = "Spring tuning, round two";
		input.dispatchEvent(new InputEvent("input", { bubbles: true }));
		(drawer.querySelector("form") as HTMLFormElement).requestSubmit();
		await until(() => !!threadRow(root, "Spring tuning, round two"));
		await closedDialogs();
		const ref = `at://${HQ}/space/${TEXT}/dev` as never;
		expect(store.channel(ref).threads.value()?.[0]?.name).toBe(
			"Spring tuning, round two",
		);
	});

	it("shows the AT-URI developer card in the thread drawer with developer mode on", async () => {
		const { store, root } = await mount(DEV_THREADS);
		store.setControls({ developerMode: true });
		const drawer = await openListMenu(root, "Spring tuning");
		await until(() => !!drawer.querySelector("[data-developer-mode]"));
		const card = drawer.querySelector("[data-developer-mode]") as HTMLElement;
		expect(buttonNamed(card, "Copy AT-URI")).toBeDefined();
		const thread = store
			.channel(`at://${HQ}/space/${TEXT}/dev` as never)
			.threads.value()
			?.find((entry) => entry.name === "Spring tuning");
		expect(card.querySelector("a")?.getAttribute("href")).toBe(
			`https://pdsls.dev/${thread?.space}`,
		);
		await expectNoLayoutIssues(drawer);
	});

	it("hides the developer card in the thread drawer with developer mode off", async () => {
		const { store, root } = await mount(DEV_THREADS);
		store.setControls({ developerMode: false });
		const drawer = await openListMenu(root, "Spring tuning");
		expect(drawer.querySelector("[data-developer-mode]")).toBeNull();
	});

	it("follows and leaves a thread", async () => {
		const { store, root } = await mount(DEV_THREADS);
		const drawer = await openListMenu(root, "Spring tuning");
		const toggle = drawer.querySelector<HTMLInputElement>(
			'input[type="checkbox"]',
		);
		expect(toggle?.checked).toBe(true);
		toggle?.click();
		const ref = `at://${HQ}/space/${TEXT}/dev` as never;
		await until(
			() => store.channel(ref).threads.value()?.[0]?.viewer.following === false,
		);
		await wait(50);
		expect(store.channel(ref).threads.value()?.[0]?.viewer.following).toBe(
			false,
		);
	});

	it("deletes a thread from the list after confirming", async () => {
		const { root } = await mount(DEV_THREADS);
		const drawer = await openListMenu(root, "Spring tuning");
		buttonNamed(drawer, "Delete thread")?.click();
		await until(() => !!dialogNamed("Delete Spring tuning?"));
		const confirm = dialogNamed("Delete Spring tuning?") as HTMLElement;
		await wait(300);
		await expectNoLayoutIssues(confirm);
		buttonNamed(confirm, "Delete thread")?.click();
		await until(() => !threadRow(root, "Spring tuning"));
		await closedDialogs();
		expect(root.textContent).toContain("No threads in this channel yet");
	});

	it("deletes the open thread and pops back to the list", async () => {
		const { root } = await mount(DEV_THREADS);
		await until(() => !!threadRow(root, "Spring tuning"));
		(threadRow(root, "Spring tuning") as HTMLElement).click();
		await until(
			() =>
				!!root.querySelector(
					'[data-pane-index="3"] [aria-label="Thread options"]',
				),
		);
		await wait(500);
		(
			root.querySelector(
				'[data-pane-index="3"] [aria-label="Thread options"]',
			) as HTMLElement
		).click();
		await until(() => !!dialogNamed("Spring tuning options"));
		await wait(400);
		const drawer = dialogNamed("Spring tuning options") as HTMLElement;
		buttonNamed(drawer, "Delete thread")?.click();
		await until(() => !!dialogNamed("Delete Spring tuning?"));
		buttonNamed(
			dialogNamed("Delete Spring tuning?") as HTMLElement,
			"Delete thread",
		)?.click();
		await until(() => location.pathname === DEV_THREADS);
		await until(() => !threadRow(root, "Spring tuning"));
	});
});

describe("channel drawer", () => {
	it("shows an open chat as gone when its channel is deleted", async () => {
		const { store, root } = await mount(`/app/c/${HQ}/${TEXT}/dev`);
		await until(() => !!store.communities.value());
		const community = store.communities
			.value()
			?.find((entry) => entry.did === HQ);
		if (!community) throw new Error("hq missing");
		const space = store.space(community);
		await until(() => !!space.channelBySlug("dev"));
		await store.channels.remove(space.channelBySlug("dev") as never);
		await until(() =>
			(root.querySelector('[data-pane-index="1"]')?.textContent ?? "").includes(
				"doesn't exist anymore",
			),
		);
	});

	it("duplicates a channel", async () => {
		const { store } = await mount(`/app/c/${HQ}`);
		await until(() => !!store.communities.value());
		const community = store.communities
			.value()
			?.find((entry) => entry.did === HQ);
		if (!community) throw new Error("hq missing");
		const space = store.space(community);
		await until(() => !!space.channelBySlug("dev"));
		const created = await store.channels.duplicate(
			space.channelBySlug("dev") as never,
		);
		await until(
			() =>
				!!space.channels
					.value()
					?.some((entry) => entry.space === created.space),
		);
		expect(created.name).toBe("dev-copy");
		const category = space.categories
			.value()
			?.find((entry) => entry.channels.some((c) => c.space === created.space));
		expect(category).toBeDefined();
	});
});
