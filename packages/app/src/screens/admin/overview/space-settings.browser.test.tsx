import "../../../app.css";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { expectNoLayoutIssues } from "../../../../../ui/src/foundations/layout-test";
import { createMockSource, setLatency } from "../../../data/mock/source";
import {
	createDataStore,
	DataContext,
	type DataStore,
} from "../../../data/store";
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

const firstSpacePath = (store: DataStore) =>
	`/app/c/${store.communities.value()?.[0]?.did}`;

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

const mount = async (path: string) => {
	setLatency(0);
	history.replaceState(null, "", path);
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
	await until(() => !store.communities.loading());
	return { store, source, root: host };
};

const buttonNamed = (scope: ParentNode, name: string | RegExp) =>
	Array.from(scope.querySelectorAll<HTMLElement>("button")).find((element) => {
		const label =
			element.getAttribute("aria-label") ?? element.textContent?.trim() ?? "";
		return typeof name === "string" ? label === name : name.test(label);
	});

const topPane = (root: HTMLElement) => {
	const top = Math.max(
		...Array.from(root.querySelectorAll<HTMLElement>("[data-pane-index]")).map(
			(element) => Number(element.dataset.paneIndex),
		),
	);
	return root.querySelector(`[data-pane-index="${top}"]`)
		?.lastElementChild as HTMLElement;
};

const dialog = () =>
	document.querySelector<HTMLElement>('[role="dialog"], [role="alertdialog"]');

const typeInto = (
	input: HTMLInputElement | HTMLTextAreaElement,
	value: string,
) => {
	input.value = value;
	input.dispatchEvent(new InputEvent("input", { bubbles: true }));
	input.dispatchEvent(new Event("change", { bubbles: true }));
};

const fieldLabelled = (scope: ParentNode, label: string) => {
	const element = Array.from(scope.querySelectorAll("label")).find((entry) =>
		entry.textContent?.trim().startsWith(label),
	);
	const id = element?.getAttribute("for");
	return (
		id ? document.getElementById(id) : element?.querySelector("input, textarea")
	) as HTMLInputElement | HTMLTextAreaElement;
};

const holdRail = async (root: HTMLElement, name: string) => {
	await until(() =>
		Array.from(
			root.querySelectorAll<HTMLElement>("[data-space-rail] button"),
		).some((element) => element.textContent?.includes(name)),
	);
	await wait(400);
	const item = Array.from(
		root.querySelectorAll<HTMLElement>("[data-space-rail] button"),
	).find((element) => element.textContent?.includes(name)) as HTMLElement;
	item.dispatchEvent(
		new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
	);
	await until(() => !!dialog());
	await wait(400);
};

describe("space settings hub", () => {
	it("lists the sections in order with the owner actions", async () => {
		const { root } = await mount(`/app/c/${HQ}/manage/overview`);
		await until(() => !!buttonNamed(root, "Space profile"));
		const rows = Array.from(
			topPane(root).querySelectorAll<HTMLElement>("section button"),
		).map((element) => element.textContent?.trim());
		expect(rows).toEqual([
			"Space profile",
			"Invite links",
			"Roles",
			"Members",
			"Emoji packs",
			"Bridges",
			"Messages",
		]);
		expect(buttonNamed(root, "Close")).toBeTruthy();
		expect(buttonNamed(root, "Transfer ownership")).toBeTruthy();
		expect(buttonNamed(root, "Delete Space")).toBeTruthy();
		expect(buttonNamed(root, "Leave Space")).toBeFalsy();
		expect(root.querySelector("[data-developer-mode]")).toBeNull();
		expect(root.textContent).toContain("Colibri HQ");
		await wait(300);
		await expectNoLayoutIssues(topPane(root));
		buttonNamed(root, "Messages")?.click();
		await until(() => location.pathname.endsWith(`/c/${HQ}/manage/messages`));
	});

	it("shows the developer box when developer mode is on", async () => {
		const { store, root } = await mount(`/app/c/${HQ}/manage/overview`);
		store.setControls({ developerMode: true });
		await until(() => !!root.querySelector("[data-developer-mode]"));
		const box = root.querySelector("[data-developer-mode]") as HTMLElement;
		expect(buttonNamed(box, /Copy AT-URI/)).toBeTruthy();
		expect(box.querySelector("a")?.getAttribute("href")).toBe(
			`https://pdsls.dev/at://${HQ}`,
		);
		await expectNoLayoutIssues(topPane(root));
	});

	it("deletes the Space from a typed-name dialog", async () => {
		const { store, root } = await mount(`/app/c/${HQ}/manage/overview`);
		await until(() => !!buttonNamed(root, "Delete Space"));
		buttonNamed(root, "Delete Space")?.click();
		await until(() => !!dialog()?.textContent?.includes("Delete Colibri HQ?"));
		await wait(300);
		await expectNoLayoutIssues(dialog() as HTMLElement);
		const confirm = buttonNamed(
			dialog() as HTMLElement,
			"Delete Space",
		) as HTMLButtonElement;
		expect(confirm.disabled).toBe(true);
		typeInto(fieldLabelled(dialog() as HTMLElement, "Space name"), "Colibri H");
		expect(confirm.disabled).toBe(true);
		typeInto(
			fieldLabelled(dialog() as HTMLElement, "Space name"),
			"Colibri HQ",
		);
		await until(() => !confirm.disabled);
		confirm.click();
		await until(
			() => !store.communities.value()?.some((entry) => entry.did === HQ),
		);
		await until(() => location.pathname === firstSpacePath(store));
	});

	it("offers a member only Members and Leave Space", async () => {
		const { store, root } = await mount(`/app/c/${OWLS}/manage/overview`);
		await until(() => !!buttonNamed(root, "Leave Space"));
		expect(buttonNamed(root, "Members")).toBeTruthy();
		expect(buttonNamed(root, "Space profile")).toBeFalsy();
		expect(buttonNamed(root, "Transfer ownership")).toBeFalsy();
		expect(buttonNamed(root, "Delete Space")).toBeFalsy();
		buttonNamed(root, "Leave Space")?.click();
		await until(() => !!dialog()?.textContent?.includes("Leave Night Owls"));
		buttonNamed(dialog() as HTMLElement, "Leave Space")?.click();
		await until(
			() => !store.communities.value()?.some((entry) => entry.did === OWLS),
		);
		await until(() => location.pathname === firstSpacePath(store));
	});

	it("opens from the Space drawer's settings tile", async () => {
		const { root } = await mount(`/app/c/${HQ}`);
		await holdRail(root, "Colibri HQ");
		const settings = buttonNamed(dialog() as HTMLElement, "Settings");
		expect(settings).toBeTruthy();
		settings?.click();
		await until(() => location.pathname.endsWith(`/c/${HQ}/manage/overview`));
		await until(() => !dialog());
		await until(() => !!buttonNamed(root, "Space profile"));
	});

	it("lets a member leave from the Space drawer", async () => {
		const { store, root } = await mount(`/app/c/${OWLS}`);
		await holdRail(root, "Night Owls");
		expect(buttonNamed(dialog() as HTMLElement, "Settings")).toBeFalsy();
		buttonNamed(dialog() as HTMLElement, "Leave Space")?.click();
		await until(() => !!dialog()?.textContent?.includes("Leave Night Owls"));
		await wait(400);
		await expectNoLayoutIssues(dialog() as HTMLElement);
		buttonNamed(dialog() as HTMLElement, "Leave Space")?.click();
		await until(
			() => !store.communities.value()?.some((entry) => entry.did === OWLS),
		);
		await until(() => location.pathname === firstSpacePath(store));
		expect(
			store.notifications
				.items()
				.filter((entry) => !entry.seenAt && entry.channel.includes(OWLS)),
		).toHaveLength(0);
	});
});

const unsavedBar = (scope: ParentNode) =>
	scope.querySelector<HTMLElement>("[data-unsaved-changes-bar]");

const barShown = (scope: ParentNode) =>
	unsavedBar(scope)?.dataset.visible !== undefined;

describe("space profile", () => {
	it("saves a new name from the unsaved changes bar and stays", async () => {
		const { store, root } = await mount(`/app/c/${HQ}/manage/profile`);
		await until(() => !!fieldLabelled(root, "Name"));
		await wait(300);
		await expectNoLayoutIssues(topPane(root));
		expect(barShown(root)).toBe(false);
		expect(
			Array.from(topPane(root).querySelectorAll("header button")).some(
				(button) => button.textContent?.trim() === "Save",
			),
		).toBe(false);
		const name = fieldLabelled(root, "Name");
		expect(name.value).toBe("Colibri HQ");
		typeInto(name, "");
		await until(() => barShown(root));
		buttonNamed(unsavedBar(root) as HTMLElement, "Save")?.click();
		await until(() => !!root.textContent?.includes("Give your Space a name."));
		typeInto(name, "Colibri Headquarters");
		const description = fieldLabelled(root, "Description");
		typeInto(description, "Where the hummingbirds meet");
		buttonNamed(unsavedBar(root) as HTMLElement, "Save")?.click();
		await until(
			() =>
				store.spaceByKey(HQ)?.name === "Colibri Headquarters" &&
				store.spaceByKey(HQ)?.description === "Where the hummingbirds meet",
		);
		await until(() => !barShown(root));
		expect(location.pathname.endsWith("/manage/profile")).toBe(true);
	});

	it("keeps the edits when saving fails and blocks going back until cancelled", async () => {
		const { store, root } = await mount(`/app/c/${HQ}/manage/profile`);
		await until(() => !!fieldLabelled(root, "Name"));
		const name = fieldLabelled(root, "Name");
		typeInto(name, "This will fail");
		await until(() => barShown(root));
		buttonNamed(unsavedBar(root) as HTMLElement, "Save")?.click();
		await wait(300);
		expect(store.spaceByKey(HQ)?.name).toBe("Colibri HQ");
		expect(location.pathname.endsWith("/manage/profile")).toBe(true);
		expect(name.value).toBe("This will fail");
		expect(barShown(root)).toBe(true);
		buttonNamed(root, "Back")?.click();
		await until(() => unsavedBar(root)?.dataset.attention !== undefined);
		await wait(300);
		expect(dialog()?.textContent?.includes("Discard changes?") ?? false).toBe(
			false,
		);
		expect(location.pathname.endsWith("/manage/profile")).toBe(true);
		buttonNamed(unsavedBar(root) as HTMLElement, "Cancel")?.click();
		await until(() => !barShown(root));
		expect(name.value).toBe("Colibri HQ");
		buttonNamed(root, "Back")?.click();
		await until(() => location.pathname.endsWith(`/c/${HQ}/manage/overview`));
	});

	it("keeps the unsaved changes bar clear of the last field on mobile", async () => {
		const { root } = await mount(`/app/c/${HQ}/manage/profile`);
		await until(() => !!fieldLabelled(root, "Name"));
		typeInto(fieldLabelled(root, "Name"), "Colibri HQ 2");
		await until(() => barShown(root));
		const pane = topPane(root);
		const scroller = pane.querySelector<HTMLElement>("[data-scroll-y]");
		if (scroller) scroller.scrollTop = scroller.scrollHeight;
		await wait(300);
		const toggle = pane.querySelector<HTMLElement>('[role="switch"]');
		const section = toggle?.closest("section") ?? toggle;
		const card = unsavedBar(pane)?.firstElementChild as HTMLElement;
		expect(section?.getBoundingClientRect().bottom ?? 0).toBeLessThanOrEqual(
			card.getBoundingClientRect().top + 0.5,
		);
		expect(card.getBoundingClientRect().bottom).toBeLessThanOrEqual(
			pane.getBoundingClientRect().bottom,
		);
		await expectNoLayoutIssues(pane);
	});

	it("toggles join approval", async () => {
		const { store, root } = await mount(`/app/c/${HQ}/manage/profile`);
		await until(() => !!root.textContent?.includes("Require join approval"));
		const toggle = root.querySelector<HTMLElement>(
			'[role="switch"], input[type="checkbox"]',
		) as HTMLElement;
		toggle.click();
		await until(() => barShown(root));
		buttonNamed(unsavedBar(root) as HTMLElement, "Save")?.click();
		await until(() => !!store.spaceByKey(HQ)?.requiresApprovalToJoin);
	});
});

describe("space messages", () => {
	it("turns link previews off for the Space", async () => {
		const { store, root } = await mount(`/app/c/${HQ}/manage/messages`);
		await until(() => !!root.textContent?.includes("Show link previews"));
		await wait(300);
		await expectNoLayoutIssues(topPane(root));
		const toggle = root.querySelector<HTMLElement>(
			'[role="switch"], input[type="checkbox"]',
		) as HTMLElement;
		toggle.click();
		await until(() => store.spaceByKey(HQ)?.linkEmbeds === false);
	});
});

describe("transfer ownership", () => {
	it("hands the Space to the picked member once acknowledged", async () => {
		const { store, root } = await mount(`/app/c/${HQ}/manage/transfer`);
		await until(() => !!root.textContent?.includes("New owner"));
		await wait(300);
		await expectNoLayoutIssues(topPane(root));
		const confirm = buttonNamed(
			topPane(root),
			"Transfer ownership",
		) as HTMLButtonElement;
		expect(confirm.disabled).toBe(true);
		const space = store.space(
			store.spaceByKey(HQ) as NonNullable<ReturnType<typeof store.spaceByKey>>,
		);
		await until(() => !!space.members.value()?.length);
		const target = (space.members.value() ?? []).find(
			(member) => member.actor.did !== store.viewer.did,
		);
		const query = (
			target?.actor.displayName ??
			target?.actor.handle ??
			""
		).slice(0, 4);
		typeInto(
			topPane(root).querySelector('input[type="search"]') as HTMLInputElement,
			query,
		);
		await until(
			() => !!root.querySelector('[role="radio"], input[type="radio"]'),
		);
		await expectNoLayoutIssues(topPane(root));
		const radio = root.querySelector<HTMLElement>(
			'[role="radio"], input[type="radio"]',
		) as HTMLElement;
		radio.click();
		expect(confirm.disabled).toBe(true);
		const acknowledge = Array.from(
			topPane(root).querySelectorAll<HTMLElement>(
				'[role="checkbox"], input[type="checkbox"]',
			),
		).at(-1) as HTMLElement;
		acknowledge.click();
		await until(() => !confirm.disabled);
		confirm.click();
		await until(() => store.spaceByKey(HQ)?.viewer.isOwner === false);
		await until(() => location.pathname.endsWith(`/c/${HQ}/manage/overview`));
		await until(() => !buttonNamed(root, "Transfer ownership"));
	});
});

describe("transfer ownership guard", () => {
	it("asks before dropping a picked member", async () => {
		const { store, root } = await mount(`/app/c/${HQ}/manage/transfer`);
		await until(() => !!root.textContent?.includes("New owner"));
		await wait(300);
		const acknowledge = Array.from(
			topPane(root).querySelectorAll<HTMLElement>(
				'[role="checkbox"], input[type="checkbox"]',
			),
		).at(-1) as HTMLElement;
		acknowledge.click();
		buttonNamed(topPane(root), /^Back/)?.click();
		await until(() => !!dialog()?.textContent?.includes("Discard changes?"));
		expect(dialog()?.textContent).toContain("Ownership stays with you.");
		await wait(300);
		buttonNamed(dialog() as HTMLElement, "Discard changes")?.click();
		await until(() => location.pathname.endsWith(`/c/${HQ}/manage/overview`));
		expect(store.spaceByKey(HQ)?.viewer.isOwner).toBe(true);
	});
});

describe("mark Space as read", () => {
	it("clears every channel and the Space's Inbox entries", async () => {
		const { store } = await mount(`/app/c/${OWLS}`);
		const owls = () => store.spaceByKey(OWLS);
		await until(() => !!owls());
		const space = store.space(owls() as NonNullable<ReturnType<typeof owls>>);
		await until(() => !!space.channels.value());
		await until(() => space.totals().hasUnread);
		await until(() => store.notifications.items().length > 0);
		await store.community.markRead(OWLS);
		await until(
			() => !space.totals().hasUnread && space.totals().mentions === 0,
		);
		const left = store.notifications
			.items()
			.filter((entry) => !entry.seenAt && entry.channel.includes(OWLS));
		expect(left).toHaveLength(0);
	});
});
