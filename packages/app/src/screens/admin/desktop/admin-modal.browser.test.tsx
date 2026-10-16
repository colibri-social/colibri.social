import "../../../app.css";
import { EMOJI_POPOVER_WIDTH } from "@colibri-social/ui";
import { render } from "solid-js/web";
import { afterEach, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { expectNoLayoutIssues } from "../../../../../ui/src/foundations/layout-test";
import { createMockSource, setLatency } from "../../../data/mock/source";
import { createDataStore, DataContext } from "../../../data/store";
import { Providers } from "../../../providers";
import { DesktopShell } from "../../../shell/desktop/DesktopShell";
import { DISCOVERY_ENABLED } from "../../../shell/features";

const HQ = "did:plc:colibrihqspace2a4b6c8d";
const SLOW = { timeout: 8000 };

let dispose: (() => void) | undefined;

afterEach(() => {
	dispose?.();
	document.body.replaceChildren();
	history.replaceState(null, "", "/");
});

const mount = async (path: string) => {
	setLatency(0);
	await page.viewport(1440, 900);
	history.replaceState(null, "", path);
	const store = createDataStore(createMockSource({ live: false }));
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
	return store;
};

const dialog = () =>
	document.querySelector<HTMLElement>('[role="dialog"]') ?? undefined;

const crumbs = () =>
	Array.from(
		dialog()?.querySelectorAll<HTMLElement>(
			'nav[aria-label="Breadcrumb"] li',
		) ?? [],
	).map((item) => item.textContent?.replace("/", "").trim());

const visiblePage = () =>
	dialog()?.querySelector<HTMLElement>("[data-modal-page]:not([hidden])")
		?.dataset.modalPage;

it("opens Space settings on the first page with a sidebar", async () => {
	await mount(`/app/c/${HQ}/manage/overview`);
	await expect
		.poll(() => location.pathname, SLOW)
		.toBe(`/app/c/${HQ}/manage/profile`);
	await expect.poll(visiblePage, SLOW).toBe("profile");
	const nav = page.getByRole("dialog").getByRole("button", { name: "Roles" });
	await expect.element(nav).toBeVisible();
	await expect
		.element(
			page.getByRole("dialog").getByRole("button", { name: "Space profile" }),
		)
		.toHaveAttribute("aria-current", "page");
	await userEvent.click(nav);
	await expect
		.poll(() => location.pathname, SLOW)
		.toBe(`/app/c/${HQ}/manage/roles`);
	await expect.poll(visiblePage, SLOW).toBe("roles");
	expect(dialog()?.querySelectorAll("[data-modal-page]")).toHaveLength(1);
	expect(crumbs()).toEqual([]);
	expect(dialog()?.querySelector("[data-modal-back]")).toBeNull();
	await expectNoLayoutIssues(dialog() as HTMLElement);
});

it("pushes nested pages with a breadcrumb, back arrow and crumb navigation", async () => {
	await mount(`/app/c/${HQ}/manage/role/bots`);
	await expect.poll(visiblePage, SLOW).toBe("role");
	await expect.poll(() => crumbs()[1]).not.toBe("Role");
	expect(crumbs()[0]).toBe("Roles");
	const roleName = crumbs()[1];
	expect(roleName).toBeTruthy();
	await userEvent.click(
		page
			.getByRole("dialog")
			.getByRole("button", { name: /permissions/i })
			.first(),
	);
	await expect
		.poll(() => location.pathname, SLOW)
		.toBe(`/app/c/${HQ}/manage/role-permissions/bots`);
	await expect.poll(visiblePage, SLOW).toBe("role-permissions");
	await expect.poll(crumbs, SLOW).toEqual(["Roles", roleName, "Permissions"]);
	await expect
		.poll(() => dialog()?.querySelectorAll("[data-modal-page]").length, SLOW)
		.toBe(3);
	await userEvent.click(
		dialog()?.querySelector("[data-modal-back]") as HTMLElement,
	);
	await expect.poll(visiblePage, SLOW).toBe("role");
	await userEvent.click(
		page
			.getByRole("navigation", { name: "Breadcrumb" })
			.getByRole("button", { name: "Roles" }),
	);
	await expect
		.poll(() => location.pathname, SLOW)
		.toBe(`/app/c/${HQ}/manage/roles`);
	await expect.poll(crumbs, SLOW).toEqual([]);
});

const unsavedBar = () =>
	dialog()?.querySelector<HTMLElement>(
		"[data-modal-page]:not([hidden]) [data-unsaved-changes-bar]",
	) ?? undefined;

const barShown = () => unsavedBar()?.dataset.visible !== undefined;

const barAttention = () => unsavedBar()?.dataset.attention !== undefined;

it("drops the page heading and shows only the breadcrumb title", async () => {
	await mount(`/app/c/${HQ}/manage/roles`);
	await expect.poll(visiblePage, SLOW).toBe("roles");
	const visible = () =>
		dialog()?.querySelector<HTMLElement>("[data-modal-page]:not([hidden])");
	expect(visible()?.querySelector("h1, h2, h3")).toBeNull();
	const actions = dialog()?.querySelector<HTMLElement>("[data-modal-actions]");
	expect(actions?.querySelector("[data-modal-page-action]")).not.toBeNull();
	await expectNoLayoutIssues(dialog() as HTMLElement);
});

it("shows the unsaved changes bar only after an edit and cancels back", async () => {
	await mount(`/app/c/${HQ}/manage/profile`);
	await expect.poll(visiblePage, SLOW).toBe("profile");
	expect(barShown()).toBe(false);
	expect(
		dialog()?.querySelector("[data-modal-actions] [data-modal-page-action]"),
	).toBeNull();
	const name = page.getByRole("dialog").getByLabelText("Name", { exact: true });
	await expect.element(name).toHaveValue("Colibri HQ");
	await userEvent.fill(name, "Renamed HQ");
	await expect.poll(barShown).toBe(true);
	await expect
		.element(page.getByRole("dialog").getByText("You have unsaved changes"))
		.toBeVisible();
	await userEvent.click(
		page.getByRole("dialog").getByRole("button", { name: "Cancel" }),
	);
	await expect.poll(barShown).toBe(false);
	await expect.element(name).toHaveValue("Colibri HQ");
});

it("saves from the bar and stays on the page", async () => {
	const store = await mount(`/app/c/${HQ}/manage/profile`);
	await expect.poll(visiblePage, SLOW).toBe("profile");
	const name = page.getByRole("dialog").getByLabelText("Name", { exact: true });
	await userEvent.fill(name, "Renamed HQ");
	await expect.poll(barShown).toBe(true);
	await userEvent.click(
		page.getByRole("dialog").getByRole("button", { name: "Save" }),
	);
	await expect.poll(barShown, SLOW).toBe(false);
	await expect
		.poll(
			() => store.communities.value()?.find((entry) => entry.did === HQ)?.name,
			SLOW,
		)
		.toBe("Renamed HQ");
	await expect.element(name).toHaveValue("Renamed HQ");
	expect(location.pathname).toBe(`/app/c/${HQ}/manage/profile`);
});

it("keeps the bar clear of the last field when scrolled to the end", async () => {
	await mount(`/app/c/${HQ}/manage/profile`);
	await expect.poll(visiblePage, SLOW).toBe("profile");
	await userEvent.fill(
		page.getByRole("dialog").getByLabelText("Name", { exact: true }),
		"Renamed HQ",
	);
	await expect.poll(barShown).toBe(true);
	const scroll = dialog()?.querySelector<HTMLElement>("[data-modal-scroll]");
	if (scroll) scroll.scrollTop = scroll.scrollHeight;
	const toggle = dialog()?.querySelector<HTMLElement>(
		'[data-modal-page]:not([hidden]) [role="switch"]',
	);
	const card = unsavedBar()?.firstElementChild as HTMLElement;
	await expect
		.poll(
			() =>
				(toggle?.closest("section") ?? toggle)?.getBoundingClientRect()
					.bottom ?? Number.POSITIVE_INFINITY,
		)
		.toBeLessThanOrEqual(card.getBoundingClientRect().top + 0.5);
	expect(card.getBoundingClientRect().bottom).toBeLessThanOrEqual(
		(scroll as HTMLElement).getBoundingClientRect().bottom,
	);
	await expectNoLayoutIssues(dialog() as HTMLElement);
});

it("blocks closing the modal while a page has unsaved changes", async () => {
	await mount(`/app/c/${HQ}/manage/profile`);
	await expect.poll(visiblePage, SLOW).toBe("profile");
	const name = page.getByRole("dialog").getByLabelText("Name", { exact: true });
	await userEvent.fill(name, "Renamed HQ");
	await expect.poll(barShown).toBe(true);
	await userEvent.keyboard("{Escape}");
	await expect.poll(barAttention).toBe(true);
	expect(location.pathname).toBe(`/app/c/${HQ}/manage/profile`);
	expect(
		document.querySelector('[role="dialog"][aria-label="Discard changes?"]'),
	).toBeNull();
	await userEvent.click(
		page.getByRole("dialog").getByRole("button", { name: "Close" }).first(),
	);
	expect(visiblePage()).toBe("profile");
	expect(location.pathname).toBe(`/app/c/${HQ}/manage/profile`);
	await userEvent.click(
		page.getByRole("dialog").getByRole("button", { name: "Cancel" }),
	);
	await expect.poll(barShown).toBe(false);
	expect(barAttention()).toBe(false);
	await userEvent.click(
		page.getByRole("dialog").getByRole("button", { name: "Close" }).first(),
	);
	await expect.poll(() => location.pathname.includes("/manage/")).toBe(false);
});

it("blocks switching sidebar pages with unsaved changes", async () => {
	await mount(`/app/c/${HQ}/manage/profile`);
	await expect.poll(visiblePage, SLOW).toBe("profile");
	const settings = page.getByRole("dialog").first();
	await userEvent.fill(
		settings.getByLabelText("Name", { exact: true }),
		"Renamed HQ",
	);
	await userEvent.click(settings.getByRole("button", { name: "Roles" }));
	await expect.poll(barAttention).toBe(true);
	expect(location.pathname).toBe(`/app/c/${HQ}/manage/profile`);
	expect(visiblePage()).toBe("profile");
	await userEvent.click(settings.getByRole("button", { name: "Save" }));
	await expect.poll(barShown, SLOW).toBe(false);
	await userEvent.click(settings.getByRole("button", { name: "Roles" }));
	await expect.poll(visiblePage, SLOW).toBe("roles");
	expect(location.pathname).toBe(`/app/c/${HQ}/manage/roles`);
});

it("shows channel settings with General and Permissions in the sidebar", async () => {
	await mount(`/app/c/${HQ}/manage/channel/dev`);
	await expect.poll(visiblePage, SLOW).toBe("channel");
	const general = page
		.getByRole("dialog")
		.getByRole("button", { name: "General" });
	await expect.element(general).toHaveAttribute("aria-current", "page");
	await expect
		.element(page.getByRole("dialog").getByText("Category"))
		.toBeVisible();
	expect(
		Array.from(dialog()?.querySelectorAll("button") ?? []).some(
			(button) => button.textContent?.trim() === "Channel permissions",
		),
	).toBe(false);
	await userEvent.click(
		page.getByRole("dialog").getByRole("button", { name: "Permissions" }),
	);
	await expect
		.poll(() => location.pathname, SLOW)
		.toBe(`/app/c/${HQ}/manage/channel-permissions/dev`);
	await expect.poll(visiblePage, SLOW).toBe("channel-permissions");
	expect(crumbs()[0]).toBe("Channel settings");
	await userEvent.click(general);
	await expect
		.poll(() => location.pathname, SLOW)
		.toBe(`/app/c/${HQ}/manage/channel/dev`);
	await expectNoLayoutIssues(dialog() as HTMLElement);
});

it("opens create Space and Join as desktop modals", async () => {
	await mount("/app/new");
	await expect
		.element(page.getByRole("dialog", { name: "Create your Space" }))
		.toBeVisible();
	await expect
		.element(page.getByRole("button", { name: "Create Space" }))
		.toBeVisible();
	dispose?.();
	document.body.replaceChildren();
	await mount("/app/invite/nope");
	await expect
		.element(page.getByRole("dialog", { name: "Invite" }))
		.toBeVisible();
});

it.skipIf(!DISCOVERY_ENABLED)("opens Discover as a desktop modal", async () => {
	await mount("/app/discover");
	await expect
		.element(page.getByRole("dialog", { name: "Discover Spaces" }))
		.toBeVisible();
	await expect
		.poll(() => document.querySelector('[data-discovery="desktop"]'))
		.not.toBeNull();
	await userEvent.keyboard("{Escape}");
	await expect.poll(() => location.pathname, SLOW).not.toBe("/app/discover");
});

it("opens emoji actions in a popover anchored to the row menu", async () => {
	await mount(`/app/c/${HQ}/manage/emoji`);
	await expect.poll(visiblePage, SLOW).toBe("emoji");
	const trigger = page.getByRole("button", {
		name: "More actions for :coffee:",
	});
	await userEvent.click(trigger);
	const popover = page.getByRole("dialog", { name: ":coffee: options" });
	await expect.element(popover).toBeVisible();
	const element = popover.element() as HTMLElement;
	await expect
		.poll(() => element.getBoundingClientRect().width)
		.toBe(EMOJI_POPOVER_WIDTH);
	expect(document.querySelector("[data-corvu-drawer-content]")).toBeNull();
	await userEvent.click(popover.getByRole("button", { name: "Rename emoji" }));
	const rename = page.getByRole("dialog", { name: "Rename emoji" });
	await expect
		.element(rename.getByRole("textbox", { name: "Name" }))
		.toHaveValue("coffee");
	await userEvent.keyboard("{Escape}");
	await expect
		.element(popover.getByRole("button", { name: "Rename emoji" }))
		.toBeVisible();
	expect(visiblePage()).toBe("emoji");
});

it("locks the create Space modal while the Space is being created", async () => {
	await mount("/app/new");
	const modal = page.getByRole("dialog", { name: "Create your Space" });
	await expect.element(modal).toBeVisible();
	await userEvent.fill(modal.getByLabelText("Space name"), "Owl Watch");
	setLatency(800);
	await userEvent.click(modal.getByRole("button", { name: "Create Space" }));
	await userEvent.keyboard("{Escape}");
	await userEvent.click(modal.getByRole("button", { name: "Close" }));
	expect(location.pathname).toBe("/app/new");
	await expect.element(modal).toBeVisible();
	await expect
		.poll(() => location.pathname, { timeout: 4000 })
		.not.toBe("/app/new");
	await expect.poll(() => dialog()).toBeUndefined();
	setLatency(0);
});

it("shows the back arrow only on the second channel creation step", async () => {
	await mount(`/app/c/${HQ}/manage/channel/new`);
	await expect.poll(visiblePage, SLOW).toBe("channel");
	const modal = page.getByRole("dialog");
	expect(dialog()?.querySelector("[data-modal-back]")).toBeNull();
	await userEvent.fill(modal.getByLabelText("Channel name"), "launch-room");
	await userEvent.click(modal.getByText("Make channel private?"));
	await userEvent.click(modal.getByRole("button", { name: "Next" }));
	await expect
		.poll(() => dialog()?.querySelector("[data-modal-back]"))
		.not.toBeNull();
	await userEvent.click(
		dialog()?.querySelector("[data-modal-back]") as HTMLElement,
	);
	await expect
		.poll(() => dialog()?.querySelector("[data-modal-back]"))
		.toBeNull();
	await expect
		.element(modal.getByLabelText("Channel name"))
		.toHaveValue("launch-room");
});

it("shows bridges as summary cards with a desktop menu", async () => {
	await mount(`/app/c/${HQ}/manage/bridges`);
	await expect.poll(visiblePage, SLOW).toBe("bridges");
	const card = page.getByRole("dialog").getByText("Libera Chat");
	await expect.element(card).toBeVisible();
	const summary = document.querySelector<HTMLElement>(
		'[data-bridge-summary="Libera Chat"]',
	);
	expect(summary?.textContent).toContain("IRC bridge by");
	expect(
		summary?.querySelector("[data-bridge-channels]")?.textContent,
	).toContain("dev");
	expect(summary?.querySelector("[data-bridge-status]")?.textContent).toBe(
		"Relaying",
	);
	expect(summary?.textContent).toContain("Mirror moderation: on");
	await userEvent.click(
		page.getByRole("button", { name: "More actions for Libera Chat bridge" }),
	);
	const menu = page.getByRole("menu");
	await expect.element(menu).toBeVisible();
	expect(document.querySelector("[data-corvu-drawer-content]")).toBeNull();
	await userEvent.click(
		menu.getByRole("menuitem", { name: "Disconnect bridge" }),
	);
	await expect
		.element(
			page
				.getByRole("alertdialog")
				.or(page.getByRole("dialog", { name: /disconnect/i })),
		)
		.toBeVisible();
	await expectNoLayoutIssues(summary as HTMLElement);
});

it("uploads an emoji through the multi-step modal", async () => {
	await mount(`/app/c/${HQ}/manage/emoji`);
	await expect.poll(visiblePage, SLOW).toBe("emoji");
	await userEvent.click(page.getByRole("button", { name: "Upload Emoji" }));
	const modal = page.getByRole("dialog", { name: "Upload emoji" });
	await expect.element(modal).toBeVisible();
	await expect
		.element(modal.getByRole("button", { name: "Next" }))
		.toBeDisabled();
	const input = document.querySelector<HTMLInputElement>(
		'[data-modal-page="emoji"] input[type="file"]',
	) as HTMLInputElement;
	const gif = new File(
		[
			Uint8Array.from(
				atob("R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=="),
				(char) => char.charCodeAt(0),
			),
		],
		"Dancing Bird.gif",
		{ type: "image/gif" },
	);
	const transfer = new DataTransfer();
	transfer.items.add(gif);
	input.files = transfer.files;
	input.dispatchEvent(new Event("change", { bubbles: true }));
	await expect
		.element(modal.getByRole("img", { name: "Emoji preview" }))
		.toBeVisible();
	await expectNoLayoutIssues(modal.element() as HTMLElement);
	await userEvent.click(modal.getByRole("button", { name: "Next" }));
	await expect
		.element(modal.getByRole("textbox", { name: "Name" }))
		.toHaveValue("dancing_bird");
	await userEvent.click(modal.getByRole("button", { name: "Next" }));
	await expect.element(modal.getByText(":dancing_bird:")).toBeVisible();
	await expect
		.element(modal.getByText("It's added to this Space without a pack."))
		.toBeVisible();
	await userEvent.click(modal.getByRole("button", { name: "Upload emoji" }));
	await expect
		.poll(() => document.querySelector('[data-emoji-row="dancing_bird"]'))
		.not.toBeNull();
	await expect
		.poll(() => page.getByRole("dialog", { name: "Upload emoji" }).query())
		.toBeNull();
	expect(document.querySelector("[data-emoji-popover]")).toBeNull();
});

it("closes the bridge menu in place before opening the bridge", async () => {
	await mount(`/app/c/${HQ}/manage/bridges`);
	await expect.poll(visiblePage, SLOW).toBe("bridges");
	const trigger = page.getByRole("button", {
		name: "More actions for Libera Chat bridge",
	});
	await userEvent.click(trigger);
	const menu = page.getByRole("menu");
	await expect.element(menu).toBeVisible();
	const triggerRect = (
		trigger.element() as HTMLElement
	).getBoundingClientRect();
	const positions: { left: number; top: number }[] = [];
	let sampling = true;
	const sample = () => {
		const open = document.querySelector<HTMLElement>('[role="menu"]');
		if (open) {
			const rect = open.getBoundingClientRect();
			positions.push({ left: rect.left, top: rect.top });
		}
		if (sampling) requestAnimationFrame(sample);
	};
	requestAnimationFrame(sample);
	await userEvent.click(menu.getByRole("menuitem", { name: "Manage bridge" }));
	await expect.poll(visiblePage, SLOW).toBe("bridge");
	sampling = false;
	expect(positions.length).toBeGreaterThan(0);
	for (const position of positions) {
		expect(position.top).toBeGreaterThan(triggerRect.top - 1);
		expect(position.left).toBeGreaterThan(triggerRect.left - 400);
	}
});

it("opens a member profile from a role mention without closing the role popover", async () => {
	await mount(`/app/c/${HQ}/social.colibri.beta.channel.text/welcome`);
	const chip = page.getByRole("button", { name: "Show members of Moderators" });
	await expect.element(chip).toBeVisible();
	await userEvent.click(chip);
	const roles = page.getByRole("dialog", { name: "Moderators members" });
	await expect.element(roles).toBeVisible();
	const row = (roles.element() as HTMLElement).querySelector<HTMLElement>(
		"[data-member-row]",
	) as HTMLElement;
	await userEvent.click(row);
	const profile = page.getByRole("dialog", { name: /'s profile$/ });
	await expect.element(profile).toBeVisible();
	await expect
		.poll(() => {
			const box = (profile.element() as HTMLElement).getBoundingClientRect();
			const anchor = row.getBoundingClientRect();
			return box.right <= anchor.left + 1 || box.left >= anchor.right - 1;
		})
		.toBe(true);
	const box = (profile.element() as HTMLElement).getBoundingClientRect();
	expect(box.top).toBeGreaterThan(40);
	expect(row.isConnected).toBe(true);
	await expect.element(roles).toBeVisible();
	await userEvent.keyboard("{Escape}");
	await expect
		.poll(() => page.getByRole("dialog", { name: /'s profile$/ }).query())
		.toBeNull();
	await expect.element(roles).toBeVisible();
	await userEvent.keyboard("{Escape}");
	await expect
		.poll(() =>
			page.getByRole("dialog", { name: "Moderators members" }).query(),
		)
		.toBeNull();
});

it("pins the developer section above the danger zone and follows the open page", async () => {
	const store = await mount(`/app/c/${HQ}/manage/role/bots`);
	store.setControls({ developerMode: true });
	await expect.poll(visiblePage, SLOW).toBe("role");
	const pdsls = () =>
		dialog()
			?.querySelector<HTMLAnchorElement>("[data-developer-mode] a")
			?.getAttribute("href");
	await expect.poll(pdsls, SLOW).toContain("bots");
	const section = dialog()?.querySelector<HTMLElement>(
		"[data-developer-mode]",
	) as HTMLElement;
	expect(section.closest("nav")).not.toBeNull();
	expect(
		section.querySelector("button")?.textContent?.includes("Copy AT-URI"),
	).toBe(true);
	const danger = Array.from(
		dialog()?.querySelectorAll<HTMLElement>("nav *") ?? [],
	).find((element) => element.textContent === "Danger zone") as HTMLElement;
	expect(
		section.compareDocumentPosition(danger) & Node.DOCUMENT_POSITION_FOLLOWING,
	).toBeTruthy();
	expect(
		dialog()?.querySelector("[data-modal-page] [data-developer-mode]"),
	).toBeNull();
	await userEvent.click(
		page.getByRole("dialog").getByRole("button", { name: "Space profile" }),
	);
	await expect.poll(visiblePage, SLOW).toBe("profile");
	await expect.poll(pdsls, SLOW).toBe(`https://pdsls.dev/at://${HQ}`);
	await expectNoLayoutIssues(dialog() as HTMLElement);
});
