import "../../../app.css";
import { render } from "solid-js/web";
import { afterEach, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { createMockSource, setLatency } from "../../../data/mock/source";
import { createDataStore, DataContext } from "../../../data/store";
import { Providers } from "../../../providers";
import { DesktopShell } from "../../../shell/desktop/DesktopShell";

const HQ = "did:plc:colibrihqspace2a4b6c8d";
const SLOW = { timeout: 8000 };

let dispose: (() => void) | undefined;

afterEach(() => {
	dispose?.();
	document.body.replaceChildren();
	history.replaceState(null, "", "/");
});

const mount = async (path: string, developerMode = false) => {
	setLatency(0);
	await page.viewport(1440, 900);
	history.replaceState(null, "", path);
	const store = createDataStore(createMockSource({ live: false }));
	store.setControls({ developerMode });
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
};

const memberTrigger = () =>
	Array.from(document.querySelectorAll<HTMLElement>("[data-member-action-row]"))
		.map((row) => row.parentElement)
		.find((parent) => parent?.matches("button[aria-haspopup]"));

const menuItem = (label: string) =>
	Array.from(document.querySelectorAll<HTMLElement>("[role='menuitem']")).find(
		(entry) => entry.textContent?.includes(label),
	);

const closeMenu = async () => {
	await userEvent.keyboard("{Escape}");
	await expect.poll(() => document.querySelector("[role='menu']")).toBeNull();
};

const expectMemberMenu = async () => {
	await expect.poll(() => !!menuItem("View profile"), SLOW).toBe(true);
	expect(menuItem("Copy DID")).toBeUndefined();
	expect(menuItem("Developer mode")).toBeUndefined();
	await new Promise((resolve) => setTimeout(resolve, 300));
	expect(document.querySelector("[data-corvu-drawer-content]")).toBeNull();
};

it("opens the member menu as a dropdown on click and at the pointer on right-click", async () => {
	await mount(`/app/c/${HQ}/manage/members`);
	await expect.poll(() => !!memberTrigger(), SLOW).toBe(true);
	const trigger = memberTrigger() as HTMLElement;
	expect(document.querySelector("button[data-member-action-row]")).toBeNull();

	await userEvent.click(trigger);
	await expectMemberMenu();
	await closeMenu();

	const rect = trigger.getBoundingClientRect();
	trigger.dispatchEvent(
		new MouseEvent("contextmenu", {
			bubbles: true,
			cancelable: true,
			button: 2,
			clientX: rect.left + 40,
			clientY: rect.top + 10,
		}),
	);
	await expectMemberMenu();
	await closeMenu();
});

it("puts Copy DID and the explorer link in the developer submenu", async () => {
	await mount(`/app/c/${HQ}/manage/members`, true);
	await expect.poll(() => !!memberTrigger(), SLOW).toBe(true);

	await userEvent.click(memberTrigger() as HTMLElement);
	await expect.poll(() => !!menuItem("Developer mode"), SLOW).toBe(true);
	expect(menuItem("Copy DID")).toBeUndefined();
	const developer = menuItem("Developer mode") as HTMLElement;
	developer.focus();
	await userEvent.keyboard("{ArrowRight}");
	await expect.poll(() => !!menuItem("Show on PDSls")).toBe(true);
	expect(menuItem("Copy DID")).toBeTruthy();
	const opened = vi.spyOn(window, "open").mockReturnValue(null);
	await userEvent.click(menuItem("Show on PDSls") as HTMLElement);
	expect(opened).toHaveBeenCalledTimes(1);
	expect(opened.mock.calls[0]?.[0]).toMatch(
		/^https:\/\/pdsls\.dev\/at:\/\/did:/,
	);
	opened.mockRestore();
});
