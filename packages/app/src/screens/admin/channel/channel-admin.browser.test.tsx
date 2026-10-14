import "../../../app.css";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { expectNoLayoutIssues } from "../../../../../ui/src/foundations/layout-test";
import { channelSlug } from "../../../data/ids";
import { createMockSource, setLatency } from "../../../data/mock/source";
import { createDataStore, DataContext } from "../../../data/store";
import { Providers } from "../../../providers";
import { MobileShell } from "../../../shell/MobileShell";

const HQ = "did:plc:colibrihqspace2a4b6c8d";
const OWLS = "did:plc:nightowlsartclub3e5f7g9h";

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
let pointerSeed = 400;

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
	await until(() => !!store.communities.value());
	const community = store.communities
		.value()
		?.find((entry) => entry.did === HQ);
	if (!community) throw new Error("hq missing");
	return { store, root: host, space: store.space(community) };
};

const textOf = (element: Element) =>
	element.getAttribute("aria-label") ?? element.textContent?.trim() ?? "";

const buttonNamed = (scope: ParentNode, name: string | RegExp) =>
	Array.from(scope.querySelectorAll<HTMLElement>("button")).find((element) =>
		typeof name === "string"
			? textOf(element) === name
			: name.test(textOf(element)),
	);

const dialogNamed = (name: string) =>
	Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).find(
		(element) =>
			element.getAttribute("aria-label") === name ||
			element.textContent?.includes(name),
	);

const topPane = (root: HTMLElement) => {
	const panes = Array.from(
		root.querySelectorAll<HTMLElement>("[data-pane-index]"),
	);
	return panes.sort(
		(a, b) => Number(b.dataset.paneIndex) - Number(a.dataset.paneIndex),
	)[0] as HTMLElement;
};

const backFrom = (root: HTMLElement) =>
	root
		.querySelector<HTMLElement>("[data-pane][data-pane-active] header button")
		?.click();

const settledActive = async (root: HTMLElement) => {
	await until(() => {
		const pane = root.querySelector<HTMLElement>(
			"[data-pane][data-pane-active]",
		);
		return !!pane && !pane.style.transform;
	});
	await wait(100);
};

const field = (scope: ParentNode, label: string) => {
	const element = Array.from(
		scope.querySelectorAll<HTMLLabelElement>("label"),
	).find((entry) => entry.textContent?.trim() === label);
	const id = element?.getAttribute("for");
	return (id ? document.getElementById(id) : undefined) as
		| HTMLInputElement
		| HTMLTextAreaElement
		| undefined;
};

const typeInto = (
	input: HTMLInputElement | HTMLTextAreaElement,
	value: string,
) => {
	input.value = value;
	input.dispatchEvent(new InputEvent("input", { bubbles: true }));
};

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
	element.dispatchEvent(new PointerEvent("pointerup", init));
	element.click();
};

const channelRow = (root: HTMLElement, name: string) =>
	Array.from(
		root.querySelectorAll<HTMLElement>(
			'[data-pane-index="0"] [data-channel-row]',
		),
	).find(
		(element) =>
			element.querySelector("[data-channel-name]")?.textContent?.trim() ===
			name,
	);

const categoryHeader = (root: HTMLElement, name: string) =>
	Array.from(
		root.querySelectorAll<HTMLElement>(
			'[data-pane-index="0"] [data-category-header]',
		),
	).find((element) => element.textContent?.trim().startsWith(name));

const openPage = async (root: HTMLElement, title: string) => {
	await until(() => topPane(root)?.textContent?.includes(title) ?? false);
	await until(() => {
		const pane = topPane(root);
		const edge = pane?.querySelector<HTMLElement>("[data-pane-edge]");
		return (
			!!pane &&
			!pane.style.transform &&
			(!edge || edge.style.visibility === "hidden")
		);
	});
	await wait(100);
	return topPane(root).querySelector<HTMLElement>(
		":scope > div:not([data-pane-edge])",
	) as HTMLElement;
};

const sectionsOf = (dialog: HTMLElement) =>
	Array.from(dialog.querySelectorAll("section")).map((group) =>
		Array.from(group.querySelectorAll("button")).map((button) =>
			button.textContent?.trim(),
		),
	);

const openDrawerFor = async (element: HTMLElement, name: string) => {
	await hold(element);
	await until(() => !!dialogNamed(`${name} options`));
	await wait(400);
	return dialogNamed(`${name} options`) as HTMLElement;
};

const toggle = (scope: ParentNode, title: string) =>
	Array.from(scope.querySelectorAll<HTMLElement>('[role="switch"]')).find(
		(element) =>
			element.closest("[data-list-toggle-row]")?.textContent?.includes(title) ??
			false,
	);

const pick = (scope: ParentNode, name: string) =>
	(
		scope.querySelector<HTMLElement>(
			`[role="checkbox"][aria-label="${name}"]`,
		) ??
		Array.from(
			scope.querySelectorAll<HTMLElement>("[data-selectable-row]"),
		).find((element) => element.textContent?.includes(name))
	)?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

const openSpaceMenuEntry = async (root: HTMLElement, entry: string) => {
	await until(() => !!buttonNamed(root, "Colibri HQ, Space options"));
	buttonNamed(root, "Colibri HQ, Space options")?.click();
	await until(() => !!dialogNamed("Colibri HQ"));
	await until(
		() => !!buttonNamed(dialogNamed("Colibri HQ") as HTMLElement, entry),
	);
	await wait(400);
	buttonNamed(dialogNamed("Colibri HQ") as HTMLElement, entry)?.click();
};

describe("channel drawer", () => {
	it("groups its actions like the design and opens channel settings", async () => {
		const { root } = await mount(`/app/c/${HQ}`);
		await until(() => !!channelRow(root, "design"));
		const drawer = await openDrawerFor(
			channelRow(root, "design") as HTMLElement,
			"design",
		);
		await expectNoLayoutIssues(drawer);
		expect(sectionsOf(drawer).slice(0, 2)).toEqual([
			[
				"Mark as read",
				"Mute channel",
				"Start a thread",
				"Show all threads",
				"Copy channel link",
			],
			["Duplicate", "Edit channel"],
		]);
		expect(buttonNamed(drawer, "Delete channel")).toBeDefined();
		buttonNamed(drawer, "Edit channel")?.click();
		await openPage(root, "Channel settings");
		await until(
			() => location.pathname === `/app/c/${HQ}/manage/channel/design`,
		);
	});
});

describe("channel settings", () => {
	it("edits the name, description and category and saves only what changed", async () => {
		const { root, space } = await mount(`/app/c/${HQ}/manage/channel/design`);
		const page = await openPage(root, "Channel settings");
		await expectNoLayoutIssues(page);
		expect(buttonNamed(page, "Save")).toBeUndefined();
		expect(buttonNamed(page, "Close channel settings")).toBeDefined();
		const name = field(page, "Channel name") as HTMLInputElement;
		expect(name.value).toBe("design");
		typeInto(name, "design-review");
		typeInto(
			field(page, "Channel description") as HTMLTextAreaElement,
			"Weekly critique of everything visual",
		);
		const category = () => buttonNamed(page, /^Category/);
		const before = category()?.textContent ?? "";
		category()?.click();
		await until(() => !!dialogNamed("Category"));
		const sheet = dialogNamed("Category") as HTMLElement;
		await wait(400);
		await expectNoLayoutIssues(sheet);
		const staff = Array.from(sheet.querySelectorAll<HTMLElement>("label")).find(
			(element) => element.textContent?.trim() === "Staff",
		);
		staff?.click();
		await until(() => category()?.textContent !== before);
		expect(category()?.textContent).toContain("Staff");
		await until(() => !!buttonNamed(page, "Save"));
		buttonNamed(page, "Save")?.click();
		await until(() => space.channelBySlug("design")?.name === "design-review");
		const view = space.channelBySlug("design");
		expect(view?.description).toBe("Weekly critique of everything visual");
		expect(view?.category).toBe("staff");
		await until(() => location.pathname === `/app/c/${HQ}`);
	});

	it("edits channel permissions on pushed pages that go back one level at a time", async () => {
		const { root, space } = await mount(`/app/c/${HQ}/manage/channel/dev`);
		const page = await openPage(root, "Channel settings");
		buttonNamed(page, /^Channel permissions/)?.click();
		const permissions = await openPage(root, "Channel permissions");
		expect(location.pathname).toBe(
			`/app/c/${HQ}/manage/channel-permissions/dev`,
		);
		expect(document.querySelector("[data-full-screen-sheet]")).toBeNull();
		expect(permissions.textContent).not.toContain("Control who can see");
		await expectNoLayoutIssues(permissions);
		const row = () => buttonNamed(permissions, /^Who can see it/);
		expect(row()?.textContent).toContain("Everyone");
		row()?.click();
		const picker = await openPage(root, "Who can see it");
		expect(location.pathname).toBe(
			`/app/c/${HQ}/manage/channel-audience/dev~visible`,
		);
		await until(() => picker.querySelector("[data-audience-picker]") !== null);
		await expectNoLayoutIssues(picker);
		pick(picker, "Moderators");
		backFrom(root);
		await until(
			() => location.pathname === `/app/c/${HQ}/manage/channel-permissions/dev`,
		);
		await settledActive(root);
		expect(row()?.textContent).toContain("1 role");
		backFrom(root);
		await until(() => location.pathname === `/app/c/${HQ}/manage/channel/dev`);
		await settledActive(root);
		buttonNamed(page, "Save")?.click();
		await until(() => !!space.channelBySlug("dev")?.visibleToRoles?.length);
		expect(space.channelBySlug("dev")?.visibleToRoles).toEqual(["mods"]);
		await until(() => location.pathname === `/app/c/${HQ}`);
	});

	it("opens the channel settings when a permissions link has no settings page under it", async () => {
		const { root } = await mount(`/app/c/${HQ}/manage/channel-permissions/dev`);
		await openPage(root, "Channel settings");
		await until(() => location.pathname.endsWith("/manage/channel/dev"));
	});

	it("deletes a channel after typing its name in the confirmation", async () => {
		const { root, space } = await mount(
			`/app/c/${HQ}/manage/channel/off-topic`,
		);
		const page = await openPage(root, "Channel settings");
		buttonNamed(page, "Delete channel")?.click();
		await until(() => !!dialogNamed("Delete #off-topic?"));
		const dialog = dialogNamed("Delete #off-topic?") as HTMLElement;
		await wait(300);
		await expectNoLayoutIssues(dialog);
		const confirm = () =>
			Array.from(dialog.querySelectorAll<HTMLElement>("button")).filter(
				(element) => textOf(element) === "Delete channel",
			)[0];
		expect(confirm()?.hasAttribute("disabled")).toBe(true);
		typeInto(field(dialog, "Channel name") as HTMLInputElement, "off-topic");
		await until(() => !confirm()?.hasAttribute("disabled"));
		confirm()?.click();
		await until(() => !space.channelBySlug("off-topic"));
		await until(() => location.pathname === `/app/c/${HQ}`);
	});

	it("asks before discarding unsaved edits", async () => {
		const { root } = await mount(`/app/c/${HQ}/manage/channel/general`);
		const page = await openPage(root, "Channel settings");
		typeInto(field(page, "Channel name") as HTMLInputElement, "general-chat");
		buttonNamed(page, "Close channel settings")?.click();
		await until(() => !!dialogNamed("Discard changes?"));
		const dialog = dialogNamed("Discard changes?") as HTMLElement;
		await wait(300);
		await expectNoLayoutIssues(dialog);
		buttonNamed(dialog, "Discard changes")?.click();
		await until(() => location.pathname === `/app/c/${HQ}`);
	});

	it("shows the developer card only in developer mode", async () => {
		const { root, store } = await mount(`/app/c/${HQ}/manage/channel/general`);
		const page = await openPage(root, "Channel settings");
		expect(buttonNamed(page, "Copy AT-URI")).toBeUndefined();
		store.setControls({ developerMode: true });
		await until(() => !!buttonNamed(page, /Copy AT-URI/));
	});

	it("shows a gone screen for a missing channel and a blocked one without permission", async () => {
		const { root } = await mount(`/app/c/${HQ}/manage/channel/nope`);
		await until(
			() =>
				topPane(root)?.textContent?.includes(
					"This channel doesn't exist anymore",
				) ?? false,
		);
		stop?.();
		host?.remove();
		const owls = await mount(`/app/c/${OWLS}/manage/channel/gifs`);
		await until(
			() =>
				topPane(owls.root)?.textContent?.includes(
					"You can't manage this channel",
				) ?? false,
		);
		expect(buttonNamed(topPane(owls.root), "Save")).toBeUndefined();
	});
});

describe("channel creation", () => {
	it("creates a private channel in two steps and opens it", async () => {
		const { root, space } = await mount(`/app/c/${HQ}`);
		await openSpaceMenuEntry(root, "Create channel");
		const page = await openPage(root, "Create new channel");
		await until(() => location.pathname === `/app/c/${HQ}/manage/channel/new`);
		await expectNoLayoutIssues(page);
		buttonNamed(page, "Create")?.click();
		await until(
			() => page.textContent?.includes("Give the channel a name.") ?? false,
		);
		typeInto(field(page, "Channel name") as HTMLInputElement, "launch-room");
		toggle(page, "Make channel private?")?.click();
		await until(() => !!buttonNamed(page, "Next"));
		buttonNamed(page, "Next")?.click();
		await until(
			() => page.textContent?.includes("Add members and roles") ?? false,
		);
		await expectNoLayoutIssues(page);
		expect(buttonNamed(page, "Skip")).toBeDefined();
		buttonNamed(page, "Back")?.click();
		await until(
			() => page.textContent?.includes("Create new channel") ?? false,
		);
		expect((field(page, "Channel name") as HTMLInputElement).value).toBe(
			"launch-room",
		);
		buttonNamed(page, "Next")?.click();
		await until(() => page.querySelector("[data-audience-picker]") !== null);
		pick(page, "Moderators");
		await until(() => !!buttonNamed(page, "Create"));
		buttonNamed(page, "Create")?.click();
		await until(() =>
			(space.channels.value() ?? []).some(
				(channel) => channel.name === "launch-room",
			),
		);
		const created = (space.channels.value() ?? []).find(
			(channel) => channel.name === "launch-room",
		);
		expect(created?.visibleToRoles).toEqual(["mods"]);
		await until(() =>
			location.pathname.endsWith(
				`/${channelSlug(created ?? { space: "x" as never })}`,
			),
		);
	});

	it("skipping the audience keeps a private channel to yourself", async () => {
		const { root, space, store } = await mount(
			`/app/c/${HQ}/manage/channel/new`,
		);
		const page = await openPage(root, "Create new channel");
		typeInto(field(page, "Channel name") as HTMLInputElement, "secret-plans");
		toggle(page, "Make channel private?")?.click();
		await until(() => !!buttonNamed(page, "Next"));
		buttonNamed(page, "Next")?.click();
		await until(() => !!buttonNamed(page, "Skip"));
		buttonNamed(page, "Skip")?.click();
		await until(() =>
			(space.channels.value() ?? []).some(
				(channel) => channel.name === "secret-plans",
			),
		);
		const created = (space.channels.value() ?? []).find(
			(channel) => channel.name === "secret-plans",
		);
		expect(created?.visibleToMembers).toEqual([store.viewer.did]);
		await until(() =>
			location.pathname.includes("/social.colibri.beta.channel.text/"),
		);
	});

	it("creates a public voice channel and returns to the list", async () => {
		const { root, space } = await mount(`/app/c/${HQ}`);
		await openSpaceMenuEntry(root, "Create channel");
		const page = await openPage(root, "Create new channel");
		typeInto(field(page, "Channel name") as HTMLInputElement, "hangout");
		Array.from(page.querySelectorAll<HTMLElement>("label"))
			.find((element) => element.textContent?.trim().startsWith("Voice"))
			?.click();
		buttonNamed(page, "Create")?.click();
		await until(() =>
			(space.channels.value() ?? []).some(
				(channel) =>
					channel.name === "hangout" &&
					channel.type === "social.colibri.beta.channel.voice",
			),
		);
		await until(() => location.pathname === `/app/c/${HQ}`);
	});
});

describe("categories", () => {
	it("groups the category drawer like the design and mutes every channel", async () => {
		const { root, space, store } = await mount(`/app/c/${HQ}`);
		await until(() => !!categoryHeader(root, "Build"));
		const drawer = await openDrawerFor(
			categoryHeader(root, "Build") as HTMLElement,
			"Build",
		);
		await expectNoLayoutIssues(drawer);
		expect(sectionsOf(drawer).slice(0, 2)).toEqual([
			["Mark as read", "Mute category"],
			["Edit category", "Create channel"],
		]);
		expect(buttonNamed(drawer, "Delete category")).toBeDefined();
		buttonNamed(drawer, "Mute category")?.click();
		const build = (space.categories.value() ?? []).find(
			(category) => category.rkey === "build",
		);
		await until(
			() => !!build?.channels.every((channel) => store.isMuted(channel.space)),
		);
	});

	it("renames a category from its drawer", async () => {
		const { root, space } = await mount(`/app/c/${HQ}`);
		await until(() => !!categoryHeader(root, "Build"));
		const drawer = await openDrawerFor(
			categoryHeader(root, "Build") as HTMLElement,
			"Build",
		);
		buttonNamed(drawer, "Edit category")?.click();
		const page = await openPage(root, "Category settings");
		await until(
			() => location.pathname === `/app/c/${HQ}/manage/category/build`,
		);
		await expectNoLayoutIssues(page);
		typeInto(field(page, "Category name") as HTMLInputElement, "Engineering");
		await until(() => !!buttonNamed(page, "Save"));
		buttonNamed(page, "Save")?.click();
		await until(() =>
			(space.categories.value() ?? []).some(
				(category) =>
					category.rkey === "build" && category.name === "Engineering",
			),
		);
		await until(() => !!categoryHeader(root, "Engineering"));
		await until(() => location.pathname === `/app/c/${HQ}`);
	});

	it("applies category see and post permissions to every channel in it", async () => {
		const { root, space } = await mount(`/app/c/${HQ}/manage/category/build`);
		const page = await openPage(root, "Category settings");
		buttonNamed(page, /^Category permissions/)?.click();
		const permissions = await openPage(root, "Category permissions");
		expect(document.querySelector("[data-full-screen-sheet]")).toBeNull();
		await expectNoLayoutIssues(permissions);
		for (const [label, role] of [
			["Who can see it", "Moderators"],
			["Who can post in it", "Core team"],
		] as const) {
			buttonNamed(permissions, new RegExp(`^${label}`))?.click();
			const picker = await openPage(root, label);
			await until(
				() => picker.querySelector("[data-audience-picker]") !== null,
			);
			pick(picker, role);
			backFrom(root);
			await until(() =>
				location.pathname.endsWith("/manage/category-permissions/build"),
			);
			await settledActive(root);
		}
		expect(buttonNamed(permissions, /^Who can see it/)?.textContent).toContain(
			"1 role",
		);
		expect(
			buttonNamed(permissions, /^Who can post in it/)?.textContent,
		).toContain("1 role");
		backFrom(root);
		await until(() => location.pathname.endsWith("/manage/category/build"));
		await settledActive(root);
		buttonNamed(page, "Save")?.click();
		const build = () =>
			(space.categories.value() ?? []).find(
				(category) => category.rkey === "build",
			);
		await until(() => build()?.visibleToRoles?.[0] === "mods");
		expect(build()?.allowedRoles?.length).toBe(1);
		expect(build()?.private).toBe(true);
		await until(
			() =>
				!!build()?.channels.length &&
				!!build()?.channels.every((channel) => {
					const served = space.channelBySlug(channelSlug(channel));
					return served?.private === true && !served.visibleToRoles?.length;
				}),
		);
		await until(() => location.pathname === `/app/c/${HQ}`);
	});

	it("creates a private category whose new channels inherit its audience", async () => {
		const { root, space } = await mount(`/app/c/${HQ}`);
		await openSpaceMenuEntry(root, "Create category");
		const page = await openPage(root, "Create new category");
		await until(() => !dialogNamed("Colibri HQ"));
		await wait(300);
		await expectNoLayoutIssues(page);
		typeInto(field(page, "Category name") as HTMLInputElement, "Events");
		toggle(page, "Make category private?")?.click();
		await until(() => !!buttonNamed(page, "Next"));
		buttonNamed(page, "Next")?.click();
		await until(() => page.querySelector("[data-audience-picker]") !== null);
		pick(page, "Moderators");
		await until(() => !!buttonNamed(page, "Create"));
		buttonNamed(page, "Create")?.click();
		await until(() => !!categoryHeader(root, "Events"));
		await until(() => location.pathname === `/app/c/${HQ}`);
		await wait(600);
		const drawer = await openDrawerFor(
			categoryHeader(root, "Events") as HTMLElement,
			"Events",
		);
		buttonNamed(drawer, "Create channel")?.click();
		const create = await openPage(root, "Create new channel");
		await until(() => !!toggle(create, "Make channel private?"));
		expect(
			toggle(create, "Make channel private?")?.getAttribute("aria-checked"),
		).toBe("false");
		typeInto(field(create, "Channel name") as HTMLInputElement, "schedule");
		await until(() => !!buttonNamed(create, "Create"));
		buttonNamed(create, "Create")?.click();
		await until(() =>
			(space.channels.value() ?? []).some(
				(channel) => channel.name === "schedule",
			),
		);
		const created = (space.channels.value() ?? []).find(
			(channel) => channel.name === "schedule",
		);
		const events = (space.categories.value() ?? []).find(
			(category) => category.name === "Events",
		);
		expect(created?.category).toBe(events?.rkey);
		expect(events?.visibleToRoles).toEqual(["mods"]);
		expect(created?.visibleToRoles ?? []).toEqual([]);
		expect(created?.private).toBe(true);
	});

	it("deletes a category from its settings and keeps its channels", async () => {
		const { root, space } = await mount(`/app/c/${HQ}/manage/category/testing`);
		const page = await openPage(root, "Category settings");
		buttonNamed(page, "Delete category")?.click();
		await until(() => !!dialogNamed("Delete Testing?"));
		const confirm = dialogNamed("Delete Testing?") as HTMLElement;
		await wait(300);
		await expectNoLayoutIssues(confirm);
		buttonNamed(confirm, "Delete category")?.click();
		await until(
			() =>
				!(space.categories.value() ?? []).some(
					(category) => category.rkey === "testing",
				),
		);
		expect(space.channelBySlug("typing")?.category).toBeUndefined();
		await until(() => location.pathname === `/app/c/${HQ}`);
		await until(() => !!channelRow(root, "typing"));
	});
});
