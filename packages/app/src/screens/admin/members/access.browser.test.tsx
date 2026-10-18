import "../../../app.css";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { expectNoLayoutIssues } from "../../../../../ui/src/foundations/layout-test";
import { createMockSource, setLatency } from "../../../data/mock/source";
import { createDataStore, DataContext } from "../../../data/store";
import { Providers } from "../../../providers";
import { MobileShell } from "../../../shell/MobileShell";

const HQ = "did:plc:colibrihqspace2a4b6c8d";
const PIXEL = "did:plc:pixelgardenspace5n7p9q";
const READERS = "did:plc:quietreadersclub6r8s2t";

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

const itemNamed = (label: string) =>
	Array.from(
		document.querySelectorAll<HTMLElement>('[role="menuitem"], button'),
	).find((element) => element.textContent?.trim() === label);

const confirmDialog = () =>
	document.querySelector<HTMLElement>('[role="alertdialog"]') ??
	Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).at(-1);

const pressConfirm = async (label: string) => {
	await until(() => !!confirmDialog()?.textContent?.includes("?"));
	await wait(300);
	buttonNamed(confirmDialog() as HTMLElement, label)?.click();
};

describe("members page", () => {
	it("reviews join requests, searches members and unbans", async () => {
		const { root, store } = await mount(`/app/c/${HQ}/manage/members`);
		await until(() => !!buttonNamed(root, /^Approve /));
		const pane = topPane(root);
		expect(pane.textContent).toContain("Join requests");
		expect(pane.textContent).toContain("Banned users");
		await expectNoLayoutIssues(pane);
		const approvals = Array.from(pane.querySelectorAll("button")).filter((b) =>
			(b.getAttribute("aria-label") ?? "").startsWith("Approve "),
		);
		const before = approvals.length;
		const did = approvals[0]
			?.closest("[data-member-action-row]")
			?.getAttribute("data-member-action-row");
		approvals[0]?.click();
		await until(
			() =>
				Array.from(topPane(root).querySelectorAll("button")).filter((b) =>
					(b.getAttribute("aria-label") ?? "").startsWith("Approve "),
				).length ===
				before - 1,
		);
		const community = store.spaceByKey(HQ);
		await until(
			() =>
				!!community &&
				!!store
					.space(community)
					.members.value()
					?.some((member) => member.actor.did === did),
		);

		const search = pane.querySelector<HTMLInputElement>('input[type="search"]');
		expect(search).not.toBeNull();
		typeInto(search as HTMLInputElement, "zzzz-nobody");
		await until(
			() => !!topPane(root).textContent?.includes("No members match"),
		);
		typeInto(search as HTMLInputElement, "mira");
		await until(
			() =>
				!!topPane(root).querySelector<HTMLElement>(
					"button[data-member-action-row]",
				),
		);
		topPane(root)
			.querySelector<HTMLElement>("button[data-member-action-row]")
			?.click();
		await until(() => !!dialog());
		await wait(400);
		document.dispatchEvent(
			new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
		);
		await until(() => !dialog());

		const unban = buttonNamed(topPane(root), /^Unban /) as HTMLElement;
		const banned = (unban.getAttribute("aria-label") ?? "").replace(
			"Unban ",
			"",
		);
		unban.click();
		await pressConfirm("Unban");
		await until(() => !buttonNamed(topPane(root), `Unban ${banned}`));
	});

	it("stacks each request's handle above its request time", async () => {
		const { root } = await mount(`/app/c/${HQ}/manage/members`);
		await until(() => !!buttonNamed(root, /^Approve /));
		const pane = topPane(root);
		const rows = Array.from(
			pane.querySelectorAll<HTMLElement>("[data-member-action-row]"),
		).filter((row) => !!row.querySelector("[data-member-action-detail]"));
		expect(rows.length).toBeGreaterThan(0);
		for (const row of rows) {
			const handle = row.querySelector<HTMLElement>(
				"[data-member-action-handle]",
			) as HTMLElement;
			const detail = row.querySelector<HTMLElement>(
				"[data-member-action-detail]",
			) as HTMLElement;
			expect(detail.textContent).toMatch(/^Requested /);
			expect(handle.scrollWidth).toBeLessThanOrEqual(handle.clientWidth);
			expect(detail.scrollWidth).toBeLessThanOrEqual(detail.clientWidth);
			expect(detail.getBoundingClientRect().top).toBeGreaterThanOrEqual(
				handle.getBoundingClientRect().bottom - 1,
			);
		}
		await expectNoLayoutIssues(pane);
	});

	it("caps the member list and points to search", async () => {
		const { root } = await mount(
			`/app/c/did:plc:nightowlsartclub3e5f7g9h/manage/members`,
		);
		await until(() => !!root.querySelector("[data-member-limit]"));
		const rows = topPane(root).querySelectorAll(
			"button[data-member-action-row]",
		);
		expect(rows.length).toBe(50);
	});
});

describe("invite links", () => {
	it("lists invite cards and deletes one from its menu", async () => {
		const { root } = await mount(`/app/c/${HQ}/manage/invites`);
		await until(() => !!buttonNamed(root, "More actions for invite Rk7mQ2xa"));
		const pane = topPane(root);
		expect(
			pane.querySelectorAll("[data-invite-state]").length,
		).toBeGreaterThanOrEqual(3);
		await expectNoLayoutIssues(pane);
		buttonNamed(pane, "More actions for invite Rk7mQ2xa")?.click();
		await until(() => !!itemNamed("Delete invite link"));
		await wait(300);
		itemNamed("Delete invite link")?.click();
		await pressConfirm("Delete invite link");
		await until(
			() => !buttonNamed(topPane(root), "More actions for invite Rk7mQ2xa"),
		);
	});

	it("opens the invite drawer from the Space menu", async () => {
		const { root } = await mount(`/app/c/${HQ}`);
		await holdRail(root, "Colibri HQ");
		const invite =
			buttonNamed(dialog() as HTMLElement, "Invite") ??
			buttonNamed(dialog() as HTMLElement, "Invite people");
		invite?.click();
		await until(() => !!document.querySelector("[data-invite-drawer] input"));
		const drawer = document.querySelector(
			"[data-invite-drawer]",
		) as HTMLElement;
		const value = drawer.querySelector<HTMLInputElement>("input")?.value ?? "";
		expect(value).toContain("/invite/");
		expect(dialog()?.textContent).toContain("Invite people to Colibri HQ");
		expect(buttonNamed(drawer, /Share invite/)).toBeTruthy();
		await expectNoLayoutIssues(dialog() as HTMLElement);
	});
});

describe("join by invite", () => {
	it("joins an open Space and lands in it", async () => {
		const { root, store } = await mount("/app/invite/pixel-garden");
		await until(() => !!buttonNamed(root, "Join this Space"));
		await expectNoLayoutIssues(topPane(root));
		buttonNamed(root, "Join this Space")?.click();
		await until(() => location.pathname === `/app/c/${PIXEL}`);
		await until(() => !!store.spaceByKey(PIXEL));
	});

	it("requests to join a Space that needs approval", async () => {
		const { root } = await mount("/app/invite/quiet-readers");
		await until(() => !!buttonNamed(root, "Request to join"));
		buttonNamed(root, "Request to join")?.click();
		await until(() => !!buttonNamed(root, "Request pending"));
		expect(location.pathname).toBe("/app/invite/quiet-readers");
		expect(READERS).toContain("quietreaders");
	});

	it("explains expired links", async () => {
		const expired = await mount("/app/invite/pixel-sprint");
		await until(
			() =>
				!!expired.root.textContent?.includes("This invite link has expired"),
		);
	});

	it("explains unknown links", async () => {
		const unknown = await mount("/app/invite/does-not-exist");
		await until(
			() =>
				!!unknown.root.textContent?.includes("This invite link isn't valid"),
		);
		await expectNoLayoutIssues(topPane(unknown.root));
	});

	it("opens the Space right away for members", async () => {
		await mount("/app/invite/colibri-hq");
		await until(() => location.pathname === `/app/c/${HQ}`);
	});
});
