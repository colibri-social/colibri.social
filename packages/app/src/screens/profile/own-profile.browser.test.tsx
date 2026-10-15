import "../../app.css";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { OwnProfilePopoverFixture } from "../../../../ui/src/components/Profile/own-profile-fixture";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext } from "../../data/store";
import { Providers } from "../../providers";
import { DesktopShell } from "../../shell/desktop/DesktopShell";
import { MemberMenuProvider, useMemberMenu } from "../members/member-menu";
import { ProfileSheetProvider, useProfileSheet } from "./profile-sheet";

const HQ = "did:plc:colibrihqspace2a4b6c8d";

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

let stops: (() => void)[] = [];

afterEach(() => {
	for (const stop of stops) stop();
	stops = [];
	document.body.replaceChildren();
});

const host = (style = "position:fixed;inset:0") => {
	const element = document.createElement("div");
	element.style.cssText = style;
	document.body.append(element);
	return element;
};

const sectionLabels = (root: ParentNode) =>
	Array.from(root.querySelectorAll("[data-profile-section]")).map((section) =>
		section.getAttribute("data-profile-section"),
	);

const describePopover = (popover: HTMLElement) => {
	const body = popover.querySelector("[data-profile-body]");
	const footer = popover.querySelector("[data-profile-footer]");
	const card = footer?.querySelector<HTMLElement>(".bg-secondary");
	return {
		width: popover.offsetWidth,
		banner: !!popover.querySelector("[data-banner]"),
		heading: !!popover.querySelector("[data-profile-name]"),
		sections: sectionLabels(popover),
		footerLast: !!footer && body?.lastElementChild === footer,
		rows: Array.from(card?.children ?? []).map((row) =>
			row.textContent
				?.trim()
				.replace(/^(Online|Away|Do not disturb|Offline)$/, "Presence"),
		),
		quickActions: !!popover.querySelector("[data-profile-quick-actions]"),
		cardDiffers:
			!!card &&
			getComputedStyle(card).backgroundColor !==
				getComputedStyle(popover).backgroundColor,
	};
};

describe("own profile popover", () => {
	it("matches the library fixture section for section and row for row", async () => {
		setLatency(0);
		await page.viewport(1440, 900);
		history.replaceState(null, "", `/app/c/${HQ}`);
		const store = createDataStore(createMockSource({ live: false }));
		await until(() => !!store.communities.value());
		const hq = store.spaceByKey(HQ);
		if (!hq) throw new Error("hq missing");
		const hqSpace = store.space(hq);
		await until(() => !!hqSpace.members.value() && !!hqSpace.roles.value());
		await hqSpace.setMemberRoles(store.viewer.did, ["owner", "core"]);
		stops.push(
			render(
				() => (
					<DataContext.Provider value={store}>
						<Providers>
							<DesktopShell />
						</Providers>
					</DataContext.Provider>
				),
				host(),
			),
		);
		await expect.poll(() => location.pathname).toContain("channel.text");
		await userEvent.click(
			page
				.getByRole("region", { name: "Your account" })
				.getByRole("button")
				.first(),
		);
		const appPopover = page.getByRole("dialog", { name: "Your profile" });
		await expect.element(appPopover).toBeVisible();
		await expect
			.poll(
				() =>
					appPopover
						.element()
						.querySelector("[data-profile-footer] .bg-secondary")?.children
						.length,
			)
			.toBe(3);
		const app = describePopover(appPopover.element() as HTMLElement);
		const appRoles = appPopover
			.element()
			.querySelector('[data-profile-section="Space roles"]')?.textContent;
		expect(appRoles).toContain("Core team");
		expect(appRoles).not.toContain("Owner");
		await userEvent.keyboard("{Escape}");
		await expect
			.poll(() => document.querySelector('[role="dialog"]'))
			.toBeNull();
		for (const stop of stops) stop();
		stops = [];
		document.body.replaceChildren();

		stops.push(
			render(
				() => (
					<div class="flex h-full flex-col justify-end p-4">
						<div class="w-[312px]">
							<OwnProfilePopoverFixture />
						</div>
					</div>
				),
				host(),
			),
		);
		await userEvent.click(page.getByRole("button", { name: /^Lou/ }));
		const fixturePopover = page.getByRole("dialog", { name: "Your profile" });
		await expect.element(fixturePopover).toBeVisible();
		const fixture = describePopover(fixturePopover.element() as HTMLElement);

		expect(app).toEqual(fixture);
		expect(app).toMatchObject({
			width: 360,
			banner: true,
			footerLast: true,
			quickActions: false,
			cardDiffers: true,
		});
		expect(app.rows).toEqual(["Presence", "Edit profile", "Edit status"]);
	});
});

describe("moderation on yourself", () => {
	const setup = async () => {
		setLatency(0);
		await page.viewport(1440, 900);
		const store = createDataStore(createMockSource({ live: false }));
		await until(() => !!store.communities.value());
		const hq = store.spaceByKey(HQ);
		if (!hq) throw new Error("hq missing");
		const space = store.space(hq);
		await until(() => !!space.members.value() && !!space.roles.value());
		let openProfile: ReturnType<typeof useProfileSheet>["open"] = () => {};
		let openMenu: (did: string, space: string) => void = () => {};
		let anchor: HTMLButtonElement | undefined;
		const Capture = () => {
			openProfile = useProfileSheet().open;
			openMenu = useMemberMenu().open;
			return null;
		};
		stops.push(
			render(
				() => (
					<DataContext.Provider value={store}>
						<Providers>
							<ProfileSheetProvider>
								<MemberMenuProvider>
									<Capture />
									<button
										type="button"
										ref={anchor}
										style={{ margin: "200px" }}
									>
										Anchor
									</button>
								</MemberMenuProvider>
							</ProfileSheetProvider>
						</Providers>
					</DataContext.Provider>
				),
				host("position:fixed;inset:0;width:1440px;height:900px"),
			),
		);
		return {
			store,
			openOwnProfile: () =>
				openProfile(store.viewer.did, HQ, { element: anchor }),
			openOwnMenu: () => openMenu(store.viewer.did, HQ),
		};
	};

	it("shows no moderation actions on your own profile from a member row or author", async () => {
		const { store, openOwnProfile } = await setup();
		openOwnProfile();
		await until(() => !!document.querySelector("[data-profile-popover]"));
		const popover = document.querySelector<HTMLElement>(
			"[data-profile-popover]",
		) as HTMLElement;
		await until(() => !!popover.querySelector("[data-profile-name]"));
		expect(popover.querySelector("[data-profile-quick-actions]")).toBeNull();
		const labels = Array.from(popover.querySelectorAll("button")).map(
			(button) => button.getAttribute("aria-label") ?? button.textContent,
		);
		expect(labels.some((label) => /\b(Kick|Ban)\b/.test(label ?? ""))).toBe(
			false,
		);
		expect(popover.textContent).toContain(store.viewer.handle);
	});

	it("offers no kick or ban in your own member menu", async () => {
		const { openOwnMenu } = await setup();
		openOwnMenu();
		await until(
			() => !!document.querySelector('[role="dialog"], [role="menu"]'),
		);
		await new Promise((resolve) => setTimeout(resolve, 200));
		const texts = Array.from(
			document.querySelectorAll<HTMLElement>(
				'[role="dialog"] button, [role="menu"] [role^="menuitem"]',
			),
		).map((element) => element.textContent?.trim() ?? "");
		expect(texts.length).toBeGreaterThan(0);
		expect(texts.some((text) => /^(Kick|Ban)\b/.test(text))).toBe(false);
	});
});

describe("bio parity", () => {
	const BIO =
		"Birds at lou.gg/birds. Ping @ana.bsky.social (or https://colibri.social).\nSecond line";

	const bioMarkup = (root: ParentNode) =>
		root.querySelector('[data-profile-section="Bio"]')?.innerHTML ?? "";

	it("renders the same bio in the user panel and the member popover", async () => {
		setLatency(0);
		await page.viewport(1440, 900);
		history.replaceState(null, "", `/app/c/${HQ}`);
		const source = createMockSource({ live: false });
		await source.putProfile({ syncBluesky: false, description: BIO });
		const store = createDataStore(source);
		await until(() => !!store.communities.value());
		const hq = store.spaceByKey(HQ);
		if (!hq) throw new Error("hq missing");
		await until(() => !!store.space(hq).members.value());

		stops.push(
			render(
				() => (
					<DataContext.Provider value={store}>
						<Providers>
							<DesktopShell />
						</Providers>
					</DataContext.Provider>
				),
				host(),
			),
		);
		await expect.poll(() => location.pathname).toContain("channel.text");
		await userEvent.click(
			page
				.getByRole("region", { name: "Your account" })
				.getByRole("button")
				.first(),
		);
		const panel = page.getByRole("dialog", { name: "Your profile" });
		await expect.element(panel).toBeVisible();
		await expect.poll(() => bioMarkup(panel.element())).not.toBe("");
		const panelBio = bioMarkup(panel.element());
		await userEvent.keyboard("{Escape}");
		await expect
			.poll(() => document.querySelector('[role="dialog"]'))
			.toBeNull();
		for (const stop of stops) stop();
		stops = [];
		document.body.replaceChildren();

		let openProfile: ReturnType<typeof useProfileSheet>["open"] = () => {};
		let anchor: HTMLButtonElement | undefined;
		const Capture = () => {
			openProfile = useProfileSheet().open;
			return null;
		};
		stops.push(
			render(
				() => (
					<DataContext.Provider value={store}>
						<Providers>
							<ProfileSheetProvider>
								<Capture />
								<button type="button" ref={anchor} style={{ margin: "200px" }}>
									Anchor
								</button>
							</ProfileSheetProvider>
						</Providers>
					</DataContext.Provider>
				),
				host("position:fixed;inset:0;width:1440px;height:900px"),
			),
		);
		openProfile(store.viewer.did, HQ, { element: anchor });
		await until(() => bioMarkup(document) !== "");
		const memberBio = bioMarkup(document);

		expect(panelBio).toBe(memberBio);
		const links = Array.from(
			document.querySelectorAll<HTMLAnchorElement>(
				'[data-profile-section="Bio"] a[data-bio-link]',
			),
		).map((link) => [link.textContent, link.getAttribute("href")]);
		expect(links).toEqual([
			["lou.gg/birds", "https://lou.gg/birds"],
			["@ana.bsky.social", expect.stringContaining("ana.bsky.social")],
			["https://colibri.social", "https://colibri.social"],
		]);
	});
});
