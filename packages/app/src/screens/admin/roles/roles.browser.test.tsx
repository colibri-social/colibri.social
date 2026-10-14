import "../../../app.css";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { expectNoLayoutIssues } from "../../../../../ui/src/foundations/layout-test";
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

const type = (field: HTMLInputElement, value: string) => {
	field.focus();
	field.value = value;
	field.dispatchEvent(new InputEvent("input", { bubbles: true }));
};

const roleRows = (root: HTMLElement) =>
	Array.from(
		root.querySelectorAll<HTMLElement>(
			"[data-space-role-list] [data-role-row]",
		),
	);

const rowNamed = (root: HTMLElement, name: string) =>
	roleRows(root).find((row) => row.textContent?.includes(name));

const activeScreen = (root: HTMLElement) =>
	root.querySelector<HTMLElement>("[data-pane][data-pane-active]") ??
	Array.from(root.querySelectorAll<HTMLElement>("[data-pane]")).at(-1) ??
	root;

const settled = async (root: HTMLElement) => {
	await until(() => activeScreen(root).style.transform === "");
	await new Promise((resolve) => requestAnimationFrame(resolve));
};

const content = (root: HTMLElement) =>
	activeScreen(root).querySelector<HTMLElement>("[data-scroll-y]") ??
	activeScreen(root);

const nameField = (root: HTMLElement) =>
	activeScreen(root).querySelector<HTMLInputElement>('input[type="text"]');

const colorToggle = (root: HTMLElement) =>
	Array.from(
		activeScreen(root).querySelectorAll<HTMLInputElement>(
			"[data-list-toggle-row] input",
		),
	).find((input) =>
		input
			.closest("[data-list-toggle-row]")
			?.textContent?.includes("Override user name colors"),
	);

const sheetMembers = () =>
	document.querySelectorAll("[data-pane][data-pane-active] [data-role-member]");

const hqSpace = (store: ReturnType<typeof createDataStore>) => {
	const community = store.spaceByKey(HQ);
	if (!community) throw new Error("HQ missing");
	return store.space(community);
};

describe("roles", () => {
	it("lists roles in rank order and hides the owner role", async () => {
		const { root } = await mount(`/app/c/${HQ}/manage/roles`);
		await until(() => roleRows(root).length === 4);
		expect(roleRows(root).map((row) => row.textContent)).toEqual([
			expect.stringContaining("Core team"),
			expect.stringContaining("Moderators"),
			expect.stringContaining("Testers"),
			expect.stringContaining("Bots"),
		]);
		expect(rowNamed(root, "Testers")?.textContent).not.toContain("members");
		expect(rowNamed(root, "Owner")).toBeUndefined();
		expect(rowNamed(root, "Core team")?.tagName).toBe("BUTTON");
		expect(buttonNamed(root, "Create role")).toBeTruthy();
		expect(buttonNamed(root, "Reorder")).toBeTruthy();
		await settled(root);
		await expectNoLayoutIssues(content(root));
	});

	it("shows every role locked where the viewer can't manage roles", async () => {
		const { root } = await mount(`/app/c/${OWLS}/manage/roles`);
		await until(() => roleRows(root).length > 0);
		expect(roleRows(root).every((row) => row.hasAttribute("data-locked"))).toBe(
			true,
		);
		expect(buttonNamed(root, "Create role")).toBeUndefined();
		expect(buttonNamed(root, "Reorder")).toBeUndefined();
		expect(colorToggle(root)?.disabled).toBe(true);
	});

	it("overrides user name colors for the Space", async () => {
		const { root, store } = await mount(`/app/c/${HQ}/manage/roles`);
		await until(() => !!colorToggle(root));
		const toggle = colorToggle(root) as HTMLInputElement;
		expect(toggle.checked).toBe(false);
		toggle.click();
		await until(() => !!store.spaceByKey(HQ)?.overrideUserNameColors);
		expect(colorToggle(root)?.checked).toBe(true);
	});

	it("creates a role and lands on it", async () => {
		const { root, store } = await mount(`/app/c/${HQ}/manage/roles`);
		await until(() => roleRows(root).length === 4);
		buttonNamed(root, "Create role")?.click();
		await until(() => location.pathname.endsWith("/manage/role/new"));
		await until(() => !!nameField(root));
		const field = nameField(root) as HTMLInputElement;
		expect(field.value).toBe("New Role");
		type(field, "Night owls with an extraordinarily long role name");
		buttonNamed(activeScreen(root), "Create")?.click();
		await until(
			() =>
				!!activeScreen(root).querySelector('[role="alert"], [data-invalid]') ||
				activeScreen(root).textContent?.includes("at most 32") === true,
		);
		expect(location.pathname.endsWith("/manage/role/new")).toBe(true);
		type(field, "Night crew");
		const mentionable = Array.from(
			activeScreen(root).querySelectorAll<HTMLElement>(
				'[role="switch"], input[type="checkbox"]',
			),
		).find((element) =>
			element
				.closest("label, [data-toggle-row], div")
				?.textContent?.includes("Mentionable"),
		);
		mentionable?.click();
		await settled(root);
		await expectNoLayoutIssues(content(root));
		buttonNamed(activeScreen(root), "Create")?.click();
		await until(
			() =>
				/\/manage\/role\/[a-z0-9]{13}$/.test(location.pathname) &&
				!!hqSpace(store)
					.roles.value()
					?.some((role) => role.name === "Night crew"),
		);
		const created = hqSpace(store)
			.roles.value()
			?.find((role) => role.name === "Night crew");
		expect(created?.position).toBeLessThan(1);
		expect(created?.mentionable).toBe(true);
		await until(() => !!buttonNamed(activeScreen(root), /^Members/));
		buttonNamed(activeScreen(root), "Back to roles")?.click();
		await until(() => location.pathname.endsWith("/manage/roles"));
		await until(() => !!rowNamed(root, "Night crew"));
		expect(roleRows(root).at(-1)?.textContent).toContain("Night crew");
	});

	it("edits a role, asks before discarding, and updates names everywhere", async () => {
		const { root, store } = await mount(`/app/c/${HQ}/manage/roles`);
		await until(() => !!rowNamed(root, "Testers"));
		rowNamed(root, "Testers")?.click();
		await until(() => location.pathname.includes("/manage/role/testers"));
		await until(() => nameField(root)?.value === "Testers");
		type(nameField(root) as HTMLInputElement, "QA crew");
		buttonNamed(activeScreen(root), "Back to roles")?.click();
		await until(() => !!dialogNamed("Discard changes?"));
		await wait(300);
		buttonNamed(
			dialogNamed("Discard changes?") as HTMLElement,
			"Cancel",
		)?.click();
		await until(() => !dialogNamed("Discard changes?"));
		expect(location.pathname.includes("/manage/role/testers")).toBe(true);
		buttonNamed(activeScreen(root), "Save")?.click();
		await until(() => location.pathname.endsWith("/manage/roles"));
		await until(() => !!rowNamed(root, "QA crew"));
		expect(hqSpace(store).roleByKey("testers")?.name).toBe("QA crew");
	});

	it("edits permissions on their own page and shows developer details", async () => {
		const { root, store } = await mount(`/app/c/${HQ}/manage/role/testers`);
		await until(() => nameField(root)?.value === "Testers");
		expect(
			activeScreen(root).querySelector("[data-developer-mode]"),
		).toBeNull();
		store.setControls({ developerMode: true });
		await until(
			() => !!activeScreen(root).querySelector("[data-developer-mode]"),
		);
		expect(
			buttonNamed(activeScreen(root), /Copy AT-URI/)?.textContent,
		).toBeTruthy();
		const pdsls = activeScreen(root).querySelector<HTMLAnchorElement>(
			"[data-developer-mode] a",
		);
		expect(pdsls?.href).toContain(
			`at://${HQ}/social.colibri.beta.role/testers`,
		);
		buttonNamed(activeScreen(root), /^Permissions/)?.click();
		await until(() =>
			location.pathname.endsWith("/manage/role-permissions/testers"),
		);
		await settled(root);
		expect(document.querySelector("[data-full-screen-sheet]")).toBeNull();
		const list = activeScreen(root).querySelector<HTMLElement>(
			"[data-role-permissions]",
		) as HTMLElement;
		expect(list).toBeTruthy();
		await expectNoLayoutIssues(content(root));
		const before = activeScreen(root).querySelectorAll(
			"[role='switch'][aria-checked='true'], input[type='checkbox']:checked",
		).length;
		const toggle = Array.from(
			list.querySelectorAll<HTMLElement>(
				"[role='switch'], input[type='checkbox']",
			),
		).find(
			(element) =>
				!element.hasAttribute("disabled") &&
				element.getAttribute("aria-checked") !== "true" &&
				!(element as HTMLInputElement).checked,
		);
		toggle?.click();
		await until(
			() =>
				activeScreen(root).querySelectorAll(
					"[role='switch'][aria-checked='true'], input[type='checkbox']:checked",
				).length ===
				before + 1,
		);
		history.back();
		await until(() => location.pathname.endsWith("/manage/role/testers"));
		await settled(root);
		expect(buttonNamed(activeScreen(root), "Save")).toBeTruthy();
		expect(buttonNamed(activeScreen(root), "Delete role")).toBeTruthy();
		store.setControls({ developerMode: false });
	});

	it("adds and removes members from a role", async () => {
		const { root, store } = await mount(`/app/c/${HQ}/manage/role/bots`);
		await until(() => !!buttonNamed(activeScreen(root), /^Members/));
		buttonNamed(activeScreen(root), /^Members/)?.click();
		await until(() => location.pathname.endsWith("/manage/role-members/bots"));
		await until(() => sheetMembers().length === 2);
		await settled(root);
		expect(document.querySelector("[data-full-screen-sheet]")).toBeNull();
		const sheet = activeScreen(root);
		await expectNoLayoutIssues(content(root));
		sheet
			.querySelector<HTMLElement>(
				"[data-role-member] button[aria-label^='Remove']",
			)
			?.click();
		await until(() => sheetMembers().length === 1);
		expect(hqSpace(store).roleByKey("bots")?.memberCount).toBe(1);
		buttonNamed(sheet, "Add members")?.click();
		await until(() => !!dialogNamed("Add members to Bots"));
		await wait(400);
		const dialog = dialogNamed("Add members to Bots") as HTMLElement;
		await expectNoLayoutIssues(dialog);
		const option = dialog.querySelector<HTMLElement>(
			'[data-member-picker] input[type="checkbox"], [data-member-picker] [role="checkbox"]',
		);
		option?.click();
		await until(() => !!buttonNamed(dialog, "Add 1 member"));
		buttonNamed(dialog, "Add 1 member")?.click();
		await until(() => sheetMembers().length === 2);
		expect(hqSpace(store).roleByKey("bots")?.memberCount).toBe(2);
	});

	it("deletes a role after confirming and strips it from members", async () => {
		const { root, store } = await mount(`/app/c/${HQ}/manage/roles`);
		await until(() => !!rowNamed(root, "Moderators"));
		rowNamed(root, "Moderators")?.click();
		await until(() => !!buttonNamed(activeScreen(root), "Delete role"));
		buttonNamed(activeScreen(root), "Delete role")?.click();
		await until(() => !!dialogNamed('Delete the "Moderators" role?'));
		await wait(300);
		const dialog = dialogNamed('Delete the "Moderators" role?') as HTMLElement;
		expect(dialog.textContent).toContain("removed from 3 members");
		await expectNoLayoutIssues(dialog);
		buttonNamed(dialog, "Delete role")?.click();
		await until(() => location.pathname.endsWith("/manage/roles"));
		await until(() => !rowNamed(root, "Moderators"));
		expect(hqSpace(store).roleByKey("mods")).toBeUndefined();
		expect(
			hqSpace(store)
				.members.value()
				?.some((member) => member.roles.includes("mods")),
		).toBe(false);
	});

	it("saves a new order through the store and shows it", async () => {
		const { root, store } = await mount(`/app/c/${HQ}/manage/roles`);
		await until(() => roleRows(root).length === 4);
		await hqSpace(store).reorderRoles([
			"owner",
			"testers",
			"core",
			"mods",
			"bots",
		]);
		await until(
			() => roleRows(root)[0]?.textContent?.includes("Testers") === true,
		);
		const positions = hqSpace(store)
			.roles.value()
			?.map((role) => [role.rkey, role.position]);
		expect(positions).toEqual([
			["owner", 5],
			["testers", 4],
			["core", 3],
			["mods", 2],
			["bots", 1],
		]);
	});

	it("lifts a held role and moves it to where it's dropped", async () => {
		const { root, store } = await mount(`/app/c/${HQ}/manage/roles`);
		await until(() => roleRows(root).length === 4);
		expect(root.querySelector('[data-role-hold="owner"]')).toBeNull();
		const held = root.querySelector<HTMLElement>(
			'[data-role-hold="testers"]',
		) as HTMLElement;
		const box = held.getBoundingClientRect();
		const point = (y: number) => ({
			bubbles: true,
			cancelable: true,
			pointerId: 31,
			pointerType: "touch",
			isPrimary: true,
			button: 0,
			clientX: box.left + box.width / 2,
			clientY: y,
		});
		const startY = box.top + box.height / 2;
		held.dispatchEvent(new PointerEvent("pointerdown", point(startY)));
		await wait(480);
		expect(held.hasAttribute("data-lifted")).toBe(true);
		expect(held.style.transform).toContain("scale(1.03)");
		for (let step = 1; step <= 5; step++) {
			document.dispatchEvent(
				new PointerEvent(
					"pointermove",
					point(startY - (box.height * step) / 5),
				),
			);
			await new Promise((resolve) => requestAnimationFrame(resolve));
		}
		document.dispatchEvent(
			new PointerEvent("pointerup", point(startY - box.height)),
		);
		await until(
			() => roleRows(root)[1]?.textContent?.includes("Testers") === true,
		);
		expect(root.querySelector("[data-lifted]")).toBeNull();
		await until(
			() =>
				hqSpace(store)
					.roles.value()
					?.map((role) => role.rkey)
					.join(",") === "owner,core,testers,mods,bots",
		);
	});

	it("treats the owner role as unavailable", async () => {
		const { root } = await mount(`/app/c/${HQ}/manage/role/owner`);
		await until(
			() =>
				activeScreen(root).textContent?.includes("doesn't exist anymore") ===
				true,
		);
		expect(nameField(root)).toBeNull();
	});

	it("shows a missing role as unavailable", async () => {
		const { root } = await mount(`/app/c/${HQ}/manage/role/nope`);
		await until(
			() =>
				activeScreen(root).textContent?.includes("doesn't exist anymore") ===
				true,
		);
	});
});
