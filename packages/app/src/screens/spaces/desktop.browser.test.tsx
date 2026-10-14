import "../../app.css";
import { render } from "solid-js/web";
import { afterEach, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext } from "../../data/store";
import { voice } from "../../data/voice";
import { Providers } from "../../providers";
import { DesktopShell } from "../../shell/desktop/DesktopShell";

const HQ = "did:plc:colibrihqspace2a4b6c8d";
const TEXT = "social.colibri.beta.channel.text";
const VOICE = "social.colibri.beta.channel.voice";

let dispose: (() => void) | undefined;

afterEach(() => {
	dispose?.();
	document.body.replaceChildren();
});

const mount = async (path: string) => {
	setLatency(0);
	localStorage.removeItem("colibri:desktop-members-open");
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

const rightClick = (element: Element) => {
	const rect = element.getBoundingClientRect();
	element.dispatchEvent(
		new MouseEvent("contextmenu", {
			bubbles: true,
			cancelable: true,
			button: 2,
			clientX: rect.left + 16,
			clientY: rect.top + 12,
		}),
	);
};

const sidebar = () =>
	document.querySelector<HTMLElement>("[data-shell-sidebar]") as HTMLElement;

const channelButton = (name: string) =>
	Array.from(sidebar().querySelectorAll<HTMLElement>("button")).find((button) =>
		(button.getAttribute("aria-label") ?? button.textContent ?? "")
			.trim()
			.startsWith(name),
	);

it("renders the desktop rail with the Inbox first and switches Spaces", async () => {
	await mount(`/app/c/${HQ}/${TEXT}/general`);
	const rail = await expect
		.poll(() => document.querySelector("[data-shell-rail]"))
		.not.toBeNull();
	expect(rail).toBeTruthy();
	await expect
		.element(page.getByRole("button", { name: /^Inbox/ }))
		.toBeVisible();
	const railNav = document.querySelector("[data-shell-rail]") as HTMLElement;
	const buttons = Array.from(railNav.querySelectorAll("button"));
	expect(buttons[0]?.getAttribute("aria-label") ?? "").toMatch(/^Inbox/);
	await userEvent.click(
		page.getByRole("button", { name: /Night Owls/ }).first(),
	);
	await expect
		.poll(() => location.pathname)
		.toMatch(
			/^\/app\/c\/did:plc:[^/]+\/social\.colibri\.beta\.channel\.text\//,
		);
	expect(location.pathname).not.toContain(HQ);
});

it("switches channels from the desktop channel list", async () => {
	await mount(`/app/c/${HQ}/${TEXT}/general`);
	await expect.poll(() => channelButton("design")).toBeTruthy();
	expect(
		document
			.querySelector("[data-channel-list-header]")
			?.getAttribute("data-platform"),
	).toBe("desktop");
	await userEvent.click(channelButton("design") as HTMLElement);
	await expect
		.poll(() => location.pathname)
		.toBe(`/app/c/${HQ}/${TEXT}/design`);
	await expect
		.poll(() => channelButton("design")?.getAttribute("aria-current"))
		.toBeTruthy();
});

it("joins a voice channel directly and keeps the current channel open", async () => {
	const store = await mount(`/app/c/${HQ}/${TEXT}/general`);
	await expect.poll(() => channelButton("Lounge")).toBeTruthy();
	const lounge = store
		.space(store.spaceByKey(HQ) as never)
		.channelBySlug("lounge");
	await userEvent.click(channelButton("Lounge") as HTMLElement);
	await expect.poll(() => voice.current()?.channel).toBe(lounge?.space);
	expect(location.pathname).toBe(`/app/c/${HQ}/${TEXT}/general`);
	voice.leave();
});

it("opens the voice channel view when join confirmation is on", async () => {
	const store = await mount(`/app/c/${HQ}/${TEXT}/general`);
	store.setControls({ confirmVoiceJoin: true });
	await expect.poll(() => channelButton("Lounge")).toBeTruthy();
	await userEvent.click(channelButton("Lounge") as HTMLElement);
	await expect
		.poll(() => location.pathname)
		.toBe(`/app/c/${HQ}/${VOICE}/lounge`);
	expect(voice.current()).toBeUndefined();
	store.setControls({ confirmVoiceJoin: false });
});

it("opens the channel and Space menus on right-click", async () => {
	await mount(`/app/c/${HQ}/${TEXT}/general`);
	await expect.poll(() => channelButton("design")).toBeTruthy();
	rightClick(channelButton("design") as HTMLElement);
	await expect
		.element(page.getByRole("menuitem", { name: "Copy channel link" }))
		.toBeVisible();
	await userEvent.keyboard("{Escape}");
	await expect.poll(() => document.querySelector("[role=menu]")).toBeNull();
	const header = sidebar().querySelector("[data-category-header]");
	expect(header).not.toBeNull();
	rightClick(header as Element);
	await expect
		.element(page.getByRole("menu", { name: /options/ }))
		.toBeVisible();
	await userEvent.keyboard("{Escape}");
	await expect.poll(() => document.querySelector("[role=menu]")).toBeNull();
	const railItem = page.getByRole("button", { name: /Night Owls/ }).first();
	rightClick(railItem.element());
	await expect
		.element(page.getByRole("menuitem", { name: /Mark as read/ }))
		.toBeVisible();
});

it("opens the Inbox popover from the rail", async () => {
	await mount(`/app/c/${HQ}/${TEXT}/general`);
	await userEvent.click(page.getByRole("button", { name: /^Inbox/ }));
	await expect
		.poll(() => document.querySelector("[data-inbox-popover]"))
		.not.toBeNull();
	await expect
		.element(page.getByRole("navigation", { name: "Inbox views" }))
		.toBeVisible();
	await userEvent.keyboard("{Escape}");
	await expect
		.poll(() => document.querySelector("[data-inbox-popover]"))
		.toBeNull();
});

it("clears the Inbox from its right-click menu", async () => {
	const store = await mount(`/app/c/${HQ}/${TEXT}/general`);
	await expect.poll(() => store.notifications.unreadCount()).toBeGreaterThan(0);
	const inbox = page.getByRole("button", { name: /^Inbox/ });
	await expect.element(inbox).toBeVisible();
	rightClick(inbox.element());
	await expect
		.element(page.getByRole("menu", { name: "Inbox options" }))
		.toBeVisible();
	await userEvent.click(page.getByRole("menuitem", { name: "Clear Inbox" }));
	await expect.poll(() => store.notifications.items().length).toBe(0);
	expect(store.notifications.unreadCount()).toBe(0);
	await expect.poll(() => document.querySelector("[role=menu]")).toBeNull();
	rightClick(inbox.element());
	for (const name of ["Clear Inbox", "Mark everything as read"]) {
		await expect
			.element(page.getByRole("menuitem", { name }))
			.toHaveAttribute("aria-disabled", "true");
	}
});

it("marks everything read from the Inbox right-click menu", async () => {
	const store = await mount(`/app/c/${HQ}/${TEXT}/general`);
	await expect.poll(() => store.notifications.unreadCount()).toBeGreaterThan(0);
	rightClick(page.getByRole("button", { name: /^Inbox/ }).element());
	await userEvent.click(
		page.getByRole("menuitem", { name: "Mark everything as read" }),
	);
	await expect.poll(() => store.notifications.unreadCount()).toBe(0);
	expect(store.notifications.items().length).toBeGreaterThan(0);
});

it("shows the member sidebar with desktop rows, the profile popover and the member menu", async () => {
	await mount(`/app/c/${HQ}/${TEXT}/general`);
	await expect
		.poll(
			() =>
				document.querySelectorAll(
					'[data-shell-members] [data-member-list][data-variant="desktop"] [data-member-row]',
				).length,
		)
		.toBeGreaterThan(3);
	const row = document.querySelector<HTMLElement>(
		"[data-shell-members] [data-member-row]",
	) as HTMLElement;
	expect(Math.round(row.getBoundingClientRect().height)).toBe(44);
	await userEvent.click(row);
	await expect
		.poll(() => document.querySelector("[data-profile-popover]"))
		.not.toBeNull();
	const popover = document.querySelector(
		"[data-profile-popover]",
	) as HTMLElement;
	await expect
		.poll(() => Math.round(popover.getBoundingClientRect().width))
		.toBe(360);
	expect(popover.getBoundingClientRect().right).toBeLessThanOrEqual(
		row.getBoundingClientRect().left + 1,
	);
	await userEvent.keyboard("{Escape}");
	await expect
		.poll(() => document.querySelector("[data-profile-popover]"))
		.toBeNull();
	rightClick(row);
	await expect
		.element(page.getByRole("menuitem", { name: /View profile/ }))
		.toBeVisible();
});

const rowOf = (name: string) =>
	channelButton(name)?.closest<HTMLElement>("[data-list-node]") ??
	channelButton(name)?.parentElement;

const previewOf = (name: string) =>
	rowOf(name)?.querySelector("[data-channel-preview]")?.textContent ?? "";

it("shows live last-message previews that follow the setting", async () => {
	const store = await mount(`/app/c/${HQ}/${TEXT}/general`);
	await expect.poll(() => previewOf("design")).toMatch(/: \S/);
	const community = store.spaceByKey(HQ);
	if (!community) throw new Error("no HQ");
	const design = store.space(community).channelBySlug("design");
	if (!design) throw new Error("no design");
	const before = previewOf("design");
	await store.channel(design.space).send({ text: "Fresh preview text" });
	await expect.poll(() => previewOf("design")).toContain("Fresh preview text");
	const sent = store.lastMessage(design.space);
	if (!sent) throw new Error("no summary");
	await store.channel(design.space).edit(sent.rkey, "Edited preview text");
	await expect.poll(() => previewOf("design")).toContain("Edited preview text");
	await store.channel(design.space).remove(sent.rkey);
	await expect.poll(() => previewOf("design")).toBe(before);
	store.setControls({ showMessagePreviews: false });
	await expect
		.poll(() => sidebar().querySelectorAll("[data-channel-preview]").length)
		.toBe(0);
	await expect
		.poll(() => sidebar().querySelector("[data-channel-list]"))
		.toHaveAttribute("data-density", "compact");
	const nodes = Array.from(
		sidebar().querySelectorAll<HTMLElement>(
			'[data-category-rows] > [data-list-node="channel"]',
		),
	);
	expect(nodes.length).toBeGreaterThan(1);
	for (const node of nodes)
		expect(node.getBoundingClientRect().height).toBeGreaterThanOrEqual(40);
	const [first, second] = nodes;
	expect(second.getBoundingClientRect().top).toBe(
		first.getBoundingClientRect().bottom,
	);
	store.setControls({ showMessagePreviews: true });
});

it("shows the member count and owner chips in the desktop header", async () => {
	const store = await mount(`/app/c/${HQ}/${TEXT}/general`);
	const community = store.spaceByKey(HQ);
	if (!community) throw new Error("no HQ");
	const space = store.space(community);
	await expect
		.poll(() => space.members.value()?.length ?? 0)
		.toBeGreaterThan(0);
	const ownerRole = space.roles.value()?.find((role) => role.protected);
	const owner = space.members
		.value()
		?.find((member) => member.roles.includes(ownerRole?.rkey ?? ""));
	expect(owner).toBeTruthy();
	await expect
		.poll(
			() =>
				document
					.querySelector("[data-space-chips] [data-owner-chip]")
					?.textContent?.trim() ?? "",
		)
		.toBe(`Owner @${owner?.actor.handle}`);
	const chips = document.querySelector("[data-space-chips]") as HTMLElement;
	expect(chips.children[0]?.textContent).toMatch(/members?$/);
	expect(chips.textContent).not.toContain("By @");
	expect(getComputedStyle(chips).flexWrap).toBe("wrap");
	for (const chip of Array.from(chips.children)) {
		expect(chip.getBoundingClientRect().right).toBeLessThanOrEqual(
			chips.getBoundingClientRect().right + 0.5,
		);
	}
});

it("opens the voice chat in the right pane from the voice channel menu", async () => {
	await mount(`/app/c/${HQ}/${TEXT}/general`);
	await expect.poll(() => channelButton("Lounge")).toBeTruthy();
	rightClick(channelButton("Lounge") as HTMLElement);
	await userEvent.click(page.getByRole("menuitem", { name: "Open chat" }));
	await expect
		.poll(() => location.pathname)
		.toBe(`/app/c/${HQ}/${VOICE}/lounge`);
	await expect
		.poll(() => document.querySelector("[data-shell-thread]"))
		.not.toBeNull();
});

it("insets the Inbox 8px from the top without a custom title bar", async () => {
	await mount(`/app/c/${HQ}/${TEXT}/general`);
	const inbox = page.getByRole("button", { name: /^Inbox/ });
	await expect.element(inbox).toBeVisible();
	expect(document.querySelector("[data-window-bar]")).toBeNull();
	const rail = document.querySelector("[data-space-rail]") as HTMLElement;
	expect(
		Math.round(
			inbox.element().getBoundingClientRect().top -
				rail.getBoundingClientRect().top,
		),
	).toBe(8);
	expect(Math.round(rail.getBoundingClientRect().top)).toBe(0);
});

it("keeps every desktop channel row at the list width", async () => {
	await mount(`/app/c/${HQ}/${TEXT}/general`);
	await expect.poll(() => previewOf("design")).toMatch(/: \S/);
	const slots = Array.from(
		sidebar().querySelectorAll<HTMLElement>("[data-channel-slot]"),
	);
	expect(slots.length).toBeGreaterThan(5);
	const width = slots[0]?.getBoundingClientRect().width ?? 0;
	const previews: number[] = [];
	for (const slot of slots) {
		const item = slot.firstElementChild as HTMLElement;
		expect(item.getBoundingClientRect().width).toBe(width);
		const row = slot.querySelector<HTMLElement>("[data-channel-row]");
		if (!row) continue;
		expect(row.getBoundingClientRect().width).toBe(width);
		const preview = row.querySelector<HTMLElement>("[data-channel-preview]");
		if (preview) {
			previews.push(preview.scrollWidth - preview.clientWidth);
			expect(preview.getBoundingClientRect().right).toBeLessThanOrEqual(
				row.getBoundingClientRect().right,
			);
		}
	}
	expect(Math.min(...previews)).toBeLessThanOrEqual(0);
	expect(Math.max(...previews)).toBeGreaterThan(0);
});

it("draws the Space banner behind the name inside a square corner on the web", async () => {
	await mount(`/app/c/${HQ}/${TEXT}/general`);
	await expect
		.poll(() => sidebar().querySelector("[data-banner-flush]"))
		.not.toBeNull();
	const header = sidebar().querySelector(
		"[data-channel-list-header]",
	) as HTMLElement;
	const banner = header.querySelector("[data-banner]") as HTMLElement;
	expect(banner.getBoundingClientRect().top).toBe(
		header.getBoundingClientRect().top,
	);
	const name = header.querySelector("[data-space-name]") as HTMLElement;
	expect(getComputedStyle(name).textShadow).not.toBe("none");
	const content = sidebar().querySelector(
		"[data-shell-sidebar-content]",
	) as HTMLElement;
	expect(getComputedStyle(sidebar()).borderTopLeftRadius).toBe("0px");
	expect(getComputedStyle(content).borderTopLeftRadius).toBe("0px");
	expect(getComputedStyle(content).overflow).toBe("hidden");
	expect(getComputedStyle(content).isolation).toBe("isolate");
	expect(content.contains(banner)).toBe(true);
});

it("keeps the profile popover where it opened while rows move", async () => {
	const store = await mount(`/app/c/${HQ}/${TEXT}/general`);
	await expect
		.poll(
			() =>
				document.querySelectorAll("[data-shell-members] [data-member-row]")
					.length,
		)
		.toBeGreaterThan(6);
	const rows = () =>
		Array.from(
			document.querySelectorAll<HTMLElement>(
				"[data-shell-members] [data-member-row]",
			),
		);
	const viewerName = store.viewer.displayName ?? "";
	const viewerIndex = rows().findIndex((row) =>
		row.textContent?.includes(viewerName),
	);
	const target = rows()[viewerIndex + 2] ?? (rows()[3] as HTMLElement);
	const targetName =
		target.querySelector("[data-member-name]")?.textContent ?? "";
	const rowOf = () =>
		rows().find(
			(row) =>
				row.querySelector("[data-member-name]")?.textContent === targetName,
		);
	await userEvent.click(target);
	await expect
		.poll(() => document.querySelector("[data-profile-popover]"))
		.not.toBeNull();
	const popover = document.querySelector(
		"[data-profile-popover]",
	) as HTMLElement;
	await expect
		.poll(() => Math.round(popover.getBoundingClientRect().width))
		.toBe(360);
	await new Promise((resolve) => setTimeout(resolve, 300));
	const before = popover.getBoundingClientRect();
	const rowBefore = rowOf()?.getBoundingClientRect().top ?? 0;
	const community = store.spaceByKey(HQ);
	if (!community) throw new Error("no HQ");
	const general = store.space(community).channelBySlug("general");
	if (!general) throw new Error("no general");
	await store.setOnlineState("offline");
	await store.channel(general.space).send({ text: "First new message" });
	await store.channel(general.space).send({ text: "Second new message" });
	await expect
		.poll(() => rowOf()?.getBoundingClientRect().top ?? rowBefore)
		.not.toBe(rowBefore);
	await new Promise((resolve) => setTimeout(resolve, 300));
	const after = popover.getBoundingClientRect();
	expect(popover.isConnected).toBe(true);
	expect(after.top).toBeCloseTo(before.top, 0);
	expect(after.left).toBeCloseTo(before.left, 0);
});
