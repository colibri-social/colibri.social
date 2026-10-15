import "../../../app.css";
import { Modal } from "@colibri-social/ui";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { expectNoLayoutIssues } from "../../../../../ui/src/foundations/layout-test";
import { createMockSource, setLatency } from "../../../data/mock/source";
import { createDataStore, DataContext } from "../../../data/store";
import { Providers } from "../../../providers";
import { DesktopShell } from "../../../shell/desktop/DesktopShell";
import type { Layer } from "../../../shell/layers";
import { type Navigator, StackContext } from "../../../shell/stack";
import SettingsModal from "./settings-modal";

const HQ = "did:plc:colibrihqspace2a4b6c8d";

let dispose: (() => void) | undefined;

afterEach(() => {
	dispose?.();
	dispose = undefined;
	document.body.replaceChildren();
});

const host = () => {
	const element = document.createElement("div");
	element.style.cssText = "position:fixed;inset:0";
	document.body.append(element);
	return element;
};

const mountShell = async (path: string) => {
	setLatency(0);
	await page.viewport(1440, 900);
	history.replaceState(null, "", path);
	const store = createDataStore(createMockSource({ live: false }));
	dispose = render(
		() => (
			<DataContext.Provider value={store}>
				<Providers>
					<DesktopShell />
				</Providers>
			</DataContext.Provider>
		),
		host(),
	);
	await expect.poll(() => location.pathname).toContain("channel.text");
	return store;
};

const dialog = () =>
	page.getByRole("dialog").filter({ hasText: "Account" }).first();

const openSettings = async () => {
	await userEvent.click(
		page
			.getByRole("region", { name: "Your account" })
			.getByRole("button", { name: "Settings", exact: true }),
	);
	await expect.element(dialog()).toBeVisible();
};

const profileTrigger = () =>
	page
		.getByRole("region", { name: "Your account" })
		.getByRole("button")
		.first();

const openEditProfile = async () => {
	await userEvent.click(profileTrigger());
	const popover = page.getByRole("dialog", { name: "Your profile" });
	await userEvent.click(popover.getByRole("button", { name: "Edit profile" }));
	await expect.poll(() => location.pathname).toBe("/app/settings/profile");
	await expect.element(dialog()).toBeVisible();
};

describe("desktop settings modal", () => {
	it("opens from the gear on the profile page and switches pages by URL", async () => {
		await mountShell(`/app/c/${HQ}`);
		const channelPath = location.pathname;
		await openSettings();
		await expect.poll(() => location.pathname).toBe("/app/settings");
		const modal = dialog();
		const atmosphere = modal
			.getByRole("link", { name: "My Atmosphere Account" })
			.first();
		await expect
			.element(atmosphere)
			.toHaveAttribute("href", "https://pds.example.com/account");
		await expect.element(atmosphere).toHaveAttribute("target", "_blank");
		await expect
			.element(
				modal.getByRole("button", { name: "Profile", exact: true }).first(),
			)
			.toHaveAttribute("aria-current", "page");
		await expect
			.element(modal.getByRole("textbox", { name: "Display name" }))
			.toBeVisible();
		await userEvent.click(modal.getByRole("button", { name: "Advanced" }));
		await expect.poll(() => location.pathname).toBe("/app/settings/advanced");
		await expect
			.element(modal.getByRole("switch", { name: /Developer mode/ }))
			.toBeVisible();
		await expect
			.element(modal.getByRole("button", { name: /Delete my Colibri data/ }))
			.toBeVisible();
		expect(document.body.textContent).not.toContain("Swipe left");
		expect(modal.element().querySelector("[data-modal-back]")).toBeNull();
		await expectNoLayoutIssues(modal.element() as HTMLElement);
		const preview = modal
			.element()
			.querySelector<HTMLElement>("[data-member-row]");
		expect(preview?.tagName).toBe("DIV");
		expect(preview?.tabIndex).toBe(-1);
		expect(preview?.hasAttribute("aria-label")).toBe(false);
		expect(getComputedStyle(preview as HTMLElement).cursor).not.toBe("pointer");
		expect(preview?.classList.contains("ripple")).toBe(false);
		await userEvent.click(
			modal.getByRole("button", { name: "Profile", exact: true }).first(),
		);
		await expect.poll(() => location.pathname).toBe("/app/settings/profile");
		await userEvent.keyboard("{Escape}");
		await expect.poll(() => location.pathname).toBe(channelPath);
	});

	it("shows developer rows only with developer mode on", async () => {
		const store = await mountShell(`/app/c/${HQ}`);
		await openSettings();
		const modal = dialog();
		expect(modal.element().textContent).not.toContain("Debug information");
		store.setControls({ developerMode: true });
		await expect
			.element(modal.getByRole("button", { name: "Debug information" }))
			.toBeVisible();
		await expect
			.element(modal.getByRole("link", { name: "View account on PDSls" }))
			.toHaveAttribute("href", `https://pdsls.dev/at://${store.viewer.did}`);
	});

	it("asks before discarding profile edits when closing or switching pages", async () => {
		await mountShell(`/app/c/${HQ}`);
		const channelPath = location.pathname;
		await openEditProfile();
		const modal = dialog();
		const name = modal.getByRole("textbox", { name: "Display name" });
		await userEvent.fill(name, "Somebody else");
		await expect
			.element(modal.getByRole("button", { name: "Save changes" }))
			.toBeEnabled();
		await userEvent.keyboard("{Escape}");
		const discard = page.getByRole("dialog", { name: "Discard changes?" });
		await expect.element(discard).toBeVisible();
		expect(location.pathname).toBe("/app/settings/profile");
		await userEvent.click(discard.getByRole("button", { name: "Cancel" }));
		await expect.element(name).toHaveValue("Somebody else");
		await userEvent.click(modal.getByRole("button", { name: "Advanced" }));
		await expect.element(discard).toBeVisible();
		await userEvent.click(
			discard.getByRole("button", { name: "Discard changes" }),
		);
		await expect.poll(() => location.pathname).toBe("/app/settings/advanced");
		await userEvent.click(modal.getByRole("button", { name: "Close" }));
		await expect.poll(() => location.pathname).toBe(channelPath);
	});

	it("saves the profile page and stays open", async () => {
		const store = await mountShell(`/app/c/${HQ}`);
		await openEditProfile();
		const modal = dialog();
		await userEvent.fill(
			modal.getByRole("textbox", { name: "Display name" }),
			"Lou the Crow",
		);
		await userEvent.click(modal.getByRole("button", { name: "Save changes" }));
		await expect.poll(() => store.viewer.displayName).toBe("Lou the Crow");
		await expect.element(dialog()).toBeVisible();
		await expect
			.element(modal.getByRole("button", { name: "Save changes" }))
			.toBeDisabled();
		const bar = document.querySelector<HTMLElement>("[data-profile-save-bar]");
		const content = document.querySelector<HTMLElement>("[data-modal-main]");
		expect(bar && content).toBeTruthy();
		expect(
			Math.abs(
				(bar as HTMLElement).getBoundingClientRect().bottom -
					(content as HTMLElement).getBoundingClientRect().bottom,
			),
		).toBeLessThanOrEqual(1);
	});
});

const stubNavigator = (layers: Layer[]) => {
	const calls = {
		pop: vi.fn(() => true),
		popTo: vi.fn(),
		replaceTop: vi.fn(),
	};
	const navigator = {
		root: () => ({ tab: "spaces" as const }),
		setRoot: () => {},
		mounted: () => layers,
		activeDepth: () => layers.length,
		moving: () => false,
		push: () => {},
		replaceTop: calls.replaceTop,
		pop: calls.pop,
		popTo: calls.popTo,
		forcePop: () => {},
		setPopGuard: () => () => {},
		registerLeave: () => () => {},
		confirmLeave: (_depth: number, action: () => void) => action(),
		depth: () => layers.length,
		top: () => layers.at(-1),
		isVisible: () => true,
	} as unknown as Navigator;
	return { navigator, calls };
};

describe("settings subpages", () => {
	it("shows a breadcrumb trail with back for stacked pages", async () => {
		setLatency(0);
		await page.viewport(1440, 900);
		const layers: Layer[] = [
			{ kind: "chat", space: HQ, channel: "general" },
			{ kind: "settings", page: "advanced" },
			{ kind: "settings", page: "deleteAccount" },
		];
		const { navigator, calls } = stubNavigator(layers);
		const store = createDataStore(createMockSource({ live: false }));
		dispose = render(
			() => (
				<DataContext.Provider value={store}>
					<Providers>
						<StackContext.Provider value={navigator}>
							<Modal open>
								<SettingsModal layers={layers.slice(1)} depth={1} />
							</Modal>
						</StackContext.Provider>
					</Providers>
				</DataContext.Provider>
			),
			host(),
		);
		const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
		await expect.element(crumbs).toBeVisible();
		expect(
			Array.from(crumbs.element().querySelectorAll("li")).map((item) =>
				item.textContent?.replace("/", "").trim(),
			),
		).toEqual(["Advanced", "Delete my Colibri data"]);
		await userEvent.click(page.getByRole("button", { name: "Back" }));
		expect(calls.pop).toHaveBeenCalledTimes(1);
		await userEvent.click(crumbs.getByRole("button", { name: "Advanced" }));
		expect(calls.popTo).toHaveBeenCalledWith(2);
		await userEvent.click(
			page
				.getByRole("navigation", { name: "Settings" })
				.getByRole("button", { name: "Advanced" }),
		);
		expect(calls.popTo).toHaveBeenLastCalledWith(2);
		expect(calls.replaceTop).toHaveBeenLastCalledWith({
			kind: "settings",
			page: "advanced",
		});
	});
});

describe("own profile popover", () => {
	it("changes presence and status from the user panel", async () => {
		const store = await mountShell(`/app/c/${HQ}`);
		const trigger = profileTrigger();
		await userEvent.click(trigger);
		await expect.element(trigger).toHaveAttribute("aria-expanded", "true");
		const popover = page.getByRole("dialog", { name: "Your profile" });
		await expect.element(popover).toBeVisible();
		const frame = popover.element() as HTMLElement;
		expect(frame.offsetWidth).toBe(360);
		expect(frame.querySelector("[data-banner]")).not.toBeNull();
		await expect
			.poll(
				() =>
					frame.querySelector("[data-profile-footer] .bg-secondary")?.children
						.length,
			)
			.toBe(3);
		const body = frame.querySelector("[data-profile-body]");
		const footer = frame.querySelector("[data-profile-footer]");
		expect(body?.lastElementChild).toBe(footer);
		const card = footer?.querySelector<HTMLElement>(".bg-secondary");
		if (!card) throw new Error("action card missing");
		expect(getComputedStyle(card).backgroundColor).not.toBe(
			getComputedStyle(frame).backgroundColor,
		);
		const rows = Array.from(card.children) as HTMLElement[];
		expect(rows.map((row) => row.textContent?.trim())).toEqual([
			"Online",
			"Edit profile",
			expect.stringMatching(/status$/),
		]);
		expect(getComputedStyle(rows[1] as HTMLElement).borderTopWidth).toBe("1px");
		const bio = frame.querySelector('[data-profile-section="Bio"] p');
		if (bio instanceof HTMLElement) {
			const probe = document.createElement("span");
			probe.style.color = "var(--foreground)";
			frame.append(probe);
			expect(getComputedStyle(bio).color).toBe(getComputedStyle(probe).color);
			probe.remove();
		}
		const presence = popover.getByRole("button", { name: /^Online status/ });
		await expect
			.element(presence)
			.toHaveAccessibleName("Online status: Online");
		await userEvent.hover(presence);
		const flyout = page.getByRole("menu", { name: /^Online status/ });
		await expect.element(flyout).toBeVisible();
		expect(
			flyout.element().getBoundingClientRect().left,
		).toBeGreaterThanOrEqual(
			popover.element().getBoundingClientRect().right - 1,
		);
		expect(
			flyout
				.getByRole("menuitemradio")
				.elements()
				.map((item) => item.textContent),
		).toEqual([
			"Online",
			"Away",
			"Do not disturbYou won't get desktop notifications",
			"OfflineYou'll appear offline",
		]);
		expect(flyout.getByRole("separator").elements()).toHaveLength(1);
		await userEvent.click(
			flyout.getByRole("menuitemradio", { name: /Do not disturb/ }),
		);
		await expect
			.poll(() => store.presenceOf(store.viewer.did)?.onlineState)
			.toBe("dnd");
		await expect.poll(() => document.querySelector('[role="menu"]')).toBeNull();
		await expect.element(popover).toBeVisible();
		await expect
			.element(presence)
			.toHaveAccessibleName("Online status: Do not disturb");
		(presence.element() as HTMLElement).focus();
		await userEvent.keyboard("{ArrowRight}");
		await expect.element(flyout).toBeVisible();
		await expect.poll(() => document.activeElement?.textContent).toBe("Online");
		await userEvent.keyboard("{ArrowLeft}");
		await expect.poll(() => document.querySelector('[role="menu"]')).toBeNull();
		await expect.poll(() => document.activeElement).toBe(presence.element());
		await userEvent.keyboard("{Enter}");
		await expect.element(flyout).toBeVisible();
		await userEvent.keyboard("{Escape}");
		await expect.poll(() => document.querySelector('[role="menu"]')).toBeNull();
		await expect.element(popover).toBeVisible();
		await userEvent.click(popover.getByRole("button", { name: /status$/ }));
		const editor = page.getByRole("dialog", { name: "Set your status" });
		await expect.element(editor).toBeVisible();
		await userEvent.fill(
			editor.getByRole("textbox").first(),
			"Watching the canal",
		);
		await userEvent.click(editor.getByRole("button", { name: "Save" }));
		await expect
			.poll(() => store.presenceOf(store.viewer.did)?.status?.text)
			.toBe("Watching the canal");
		await expect
			.element(page.getByRole("region", { name: "Your account" }))
			.toHaveTextContent("Watching the canal");
		await expectNoLayoutIssues(popover.element() as HTMLElement);
	});

	it("opens the profile settings page from Edit profile", async () => {
		await mountShell(`/app/c/${HQ}`);
		await userEvent.click(profileTrigger());
		const popover = page.getByRole("dialog", { name: "Your profile" });
		await userEvent.click(
			popover.getByRole("button", { name: "Edit profile" }),
		);
		await expect.poll(() => location.pathname).toBe("/app/settings/profile");
		await expect.element(dialog()).toBeVisible();
		await expect
			.element(dialog().getByRole("textbox", { name: "Display name" }))
			.toBeVisible();
		await expect
			.poll(() => document.querySelector("[data-own-profile]"))
			.toBeNull();
	});
	it("toggles message previews on the Appearance page", async () => {
		const store = await mountShell(`/app/c/${HQ}`);
		await openSettings();
		const modal = dialog();
		await userEvent.click(modal.getByRole("button", { name: "Appearance" }));
		await expect.poll(() => location.pathname).toBe("/app/settings/appearance");
		const toggle = modal.getByRole("switch", { name: /Show message previews/ });
		await expect.element(toggle).toBeChecked();
		await userEvent.click(page.getByText("Show message previews"));
		await expect.poll(() => store.controls().showMessagePreviews).toBe(false);
		await expect.element(toggle).not.toBeChecked();
		await userEvent.click(page.getByText("Show message previews"));
		await expect.poll(() => store.controls().showMessagePreviews).toBe(true);
	});
});
