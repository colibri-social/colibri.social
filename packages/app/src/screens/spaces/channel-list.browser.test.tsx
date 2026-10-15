import "../../app.css";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { createMockSource, setLatency } from "../../data/mock/source";
import { spaceNotificationPrefs } from "../../data/notifications";
import { createDataStore, DataContext } from "../../data/store";
import { setVoiceSoundPlayer } from "../../data/voice";
import { Providers } from "../../providers";
import { usePlatform } from "../../screen/platform";
import { DesktopShell } from "../../shell/desktop/DesktopShell";
import { depthOf } from "../../shell/history-sync";
import { MobileShell } from "../../shell/MobileShell";
import { categoryCollapseKey } from "./category-collapse";

const HQ = "did:plc:colibrihqspace2a4b6c8d";
const OWLS = "did:plc:nightowlsartclub3e5f7g9h";
const TEXT = "social.colibri.beta.channel.text";

let dispose: (() => void) | undefined;
let pointerSeed = 4100;

afterEach(() => {
	dispose?.();
	dispose = undefined;
	document.body.replaceChildren();
	history.replaceState(null, "", "/");
});

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const mount = async (platform: "mobile" | "desktop", path: string) => {
	setLatency(0);
	setVoiceSoundPlayer(() => {});
	if (platform === "desktop") await page.viewport(1440, 900);
	else await page.viewport(402, 874);
	await until(() => usePlatform()() === platform);
	history.replaceState(null, "", path);
	const store = createDataStore(createMockSource({ live: false }));
	const host = document.createElement("div");
	host.style.cssText = "position:fixed;inset:0";
	document.body.append(host);
	dispose = render(
		() => (
			<DataContext.Provider value={store}>
				<Providers>
					{platform === "desktop" ? <DesktopShell /> : <MobileShell />}
				</Providers>
			</DataContext.Provider>
		),
		host,
	);
	return store;
};

const channelRow = (name: string) =>
	Array.from(document.querySelectorAll<HTMLElement>("[data-channel-row]")).find(
		(row) => row.querySelector("[data-channel-name]")?.textContent === name,
	);

const threadRow = (name: string) =>
	Array.from(
		document.querySelectorAll<HTMLElement>("[data-channel-thread]"),
	).find(
		(row) => row.querySelector("[data-thread-name]")?.textContent === name,
	);

const categorySection = (name: string) =>
	document.querySelector<HTMLElement>(
		`[data-category][aria-label="${name}"]`,
	) ?? undefined;

const dialogName = (element: HTMLElement) => {
	const label = element.getAttribute("aria-label");
	if (label) return label;
	const ids = element.getAttribute("aria-labelledby")?.split(" ") ?? [];
	return ids
		.map((id) => document.getElementById(id)?.textContent ?? "")
		.join(" ")
		.trim();
};

const dialogNamed = (name: string) =>
	Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).find(
		(element) => dialogName(element) === name,
	);

const buttonIn = (root: HTMLElement, label: string) =>
	Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find(
		(button) => button.textContent?.trim() === label,
	);

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

const menuItem = (label: string) =>
	Array.from(
		document.querySelectorAll<HTMLElement>(
			'[role="menuitem"], [role="menuitemcheckbox"]',
		),
	).find((item) => item.textContent?.trim() === label);

const hold = async (element: HTMLElement) => {
	const box = element.getBoundingClientRect();
	const init = {
		bubbles: true,
		pointerType: "touch",
		pointerId: ++pointerSeed,
		isPrimary: true,
		button: 0,
		clientX: box.left + Math.min(40, box.width / 2),
		clientY: box.top + box.height / 2,
	};
	element.dispatchEvent(new PointerEvent("pointerdown", init));
	await wait(500);
	element.dispatchEvent(new PointerEvent("pointerup", init));
	element.click();
};

describe("threads in the channel list", () => {
	it("nests an unread thread under its channel on mobile and opens it", async () => {
		await mount("mobile", `/app/c/${OWLS}`);
		await until(() => !!threadRow("Portrait critique"));
		const row = threadRow("Portrait critique") as HTMLElement;
		const entry = row.closest("[data-channel-entry]") as HTMLElement;
		expect(
			entry.querySelector("[data-channel-row] [data-channel-name]")
				?.textContent,
		).toBe("critique");
		expect(row.dataset.state).not.toBe("read");
		const channel = entry.querySelector(
			"[data-channel-row] [data-channel-name]",
		) as HTMLElement;
		const name = row.querySelector("[data-thread-name]") as HTMLElement;
		expect(name.getBoundingClientRect().left).toBeGreaterThan(
			channel.getBoundingClientRect().left,
		);
		(row.querySelector("button") as HTMLButtonElement).click();
		await until(() => location.pathname.includes("/t/"));
	});

	it("opens a thread from the mobile list as one history entry and goes back to the list", async () => {
		await mount("mobile", `/app/c/${OWLS}`);
		await until(() => !!threadRow("Portrait critique"));
		const listPath = location.pathname;
		const startDepth = depthOf(history.state);
		(
			threadRow("Portrait critique")?.querySelector(
				"button",
			) as HTMLButtonElement
		).click();
		await until(() => location.pathname.includes("/t/"));
		expect(depthOf(history.state)).toBe(startDepth + 1);
		expect(document.querySelector('[data-pane-index="2"]')).toBeNull();
		await until(
			() =>
				!!document.querySelector<HTMLElement>(
					'[aria-label="Back to channels"]',
				),
		);
		history.back();
		await until(() => location.pathname === listPath);
		expect(depthOf(history.state)).toBe(startDepth);
	});

	it("keeps the channel under a thread opened from a cold mobile link", async () => {
		await mount("mobile", `/app/c/${OWLS}`);
		await until(() => !!threadRow("Portrait critique"));
		(
			threadRow("Portrait critique")?.querySelector(
				"button",
			) as HTMLButtonElement
		).click();
		await until(() => location.pathname.includes("/t/"));
		const threadPath = location.pathname;
		const channelPath = threadPath.slice(0, threadPath.indexOf("/t/"));
		dispose?.();
		dispose = undefined;
		document.body.replaceChildren();
		await mount("mobile", threadPath);
		await until(
			() =>
				!!document.querySelector<HTMLElement>(
					'[aria-label="Back to #critique"]',
				),
		);
		const header = document.querySelector<HTMLElement>(
			'[data-pane-index="2"] h1, [data-pane-index="2"] [data-channel-header]',
		);
		await userEvent.click(header ?? document.body);
		await until(() => depthOf(history.state) === 2);
		history.back();
		await until(() => location.pathname === channelPath);
	});

	it("opens a thread from the desktop list in the pane and Back closes the pane", async () => {
		await mount("desktop", `/app/c/${HQ}/${TEXT}/general`);
		await until(() => !!threadRow("Spring tuning"));
		const startDepth = depthOf(history.state);
		(
			threadRow("Spring tuning")?.querySelector("button") as HTMLButtonElement
		).click();
		await until(() => location.pathname.includes("/t/"));
		const threadPath = location.pathname;
		expect(depthOf(history.state)).toBe(startDepth + 1);
		history.back();
		await until(
			() =>
				location.pathname === threadPath.slice(0, threadPath.indexOf("/t/")),
		);
		expect(depthOf(history.state)).toBe(startDepth);
		await until(() => !document.querySelector("[data-shell-thread]"));
	});

	it("highlights only the open thread on desktop and keeps its row after the pane closes", async () => {
		await mount("desktop", `/app/c/${HQ}/${TEXT}/general`);
		await until(() => !!threadRow("Spring tuning"));
		(
			threadRow("Spring tuning")?.querySelector("button") as HTMLButtonElement
		).click();
		await until(() => location.pathname.includes("/t/"));
		await until(
			() => !!threadRow("Spring tuning")?.hasAttribute("data-active"),
		);
		expect(threadRow("Spring tuning")?.querySelector("button")).toHaveAttribute(
			"aria-current",
			"page",
		);
		expect(
			document.querySelectorAll(
				"[data-channel-row][data-active], [data-channel-thread][data-active]",
			),
		).toHaveLength(1);
		expect(channelRow("dev")?.hasAttribute("data-active")).toBe(false);
		await userEvent.click(page.getByRole("button", { name: "Close thread" }));
		await until(() => !document.querySelector("[data-shell-thread]"));
		await until(() => !!channelRow("dev")?.hasAttribute("data-active"));
		expect(threadRow("Spring tuning")?.hasAttribute("data-active")).toBe(false);
		(
			channelRow("general")?.querySelector("button") as HTMLButtonElement
		).click();
		await until(() => !!channelRow("general")?.hasAttribute("data-active"));
		expect(threadRow("Spring tuning")).toBeDefined();
		expect(threadRow("Spring tuning")?.hasAttribute("data-active")).toBe(false);
	});

	it("highlights only the thread on mobile until a channel is opened", async () => {
		await mount("mobile", `/app/c/${OWLS}`);
		await until(() => !!threadRow("Portrait critique"));
		const listPath = location.pathname;
		(
			threadRow("Portrait critique")?.querySelector(
				"button",
			) as HTMLButtonElement
		).click();
		await until(() => location.pathname.includes("/t/"));
		await until(
			() => !!threadRow("Portrait critique")?.hasAttribute("data-active"),
		);
		expect(
			Array.from(document.querySelectorAll("[data-channel-row]")).filter(
				(row) => row.hasAttribute("data-active"),
			),
		).toHaveLength(0);
		history.back();
		await until(() => location.pathname === listPath);
		expect(threadRow("Portrait critique")?.hasAttribute("data-active")).toBe(
			true,
		);
		(
			channelRow("critique")?.querySelector("button") as HTMLButtonElement
		).click();
		await until(() => location.pathname.endsWith("/critique"));
		await until(() => !!channelRow("critique")?.hasAttribute("data-active"));
		expect(threadRow("Portrait critique")).toBeDefined();
		expect(threadRow("Portrait critique")?.hasAttribute("data-active")).toBe(
			false,
		);
	});

	it("shows a followed thread as read on desktop", async () => {
		await mount("desktop", `/app/c/${HQ}/${TEXT}/general`);
		await until(() => !!threadRow("Spring tuning"));
		const row = threadRow("Spring tuning") as HTMLElement;
		expect(row.dataset.state).toBe("read");
		expect(
			row
				.closest("[data-channel-entry]")
				?.querySelector("[data-channel-row] [data-channel-name]")?.textContent,
		).toBe("dev");
	});
});

describe("deleting channels and categories", () => {
	it("deletes a channel from the desktop context menu after typing its name", async () => {
		await mount("desktop", `/app/c/${HQ}/${TEXT}/general`);
		await until(() => !!channelRow("design"));
		rightClick(channelRow("design") as HTMLElement);
		await until(() => !!menuItem("Delete channel"));
		await userEvent.click(menuItem("Delete channel") as HTMLElement);
		await until(() => !!dialogNamed("Delete #design?"));
		const dialog = dialogNamed("Delete #design?") as HTMLElement;
		const confirm = buttonIn(dialog, "Delete channel") as HTMLButtonElement;
		expect(confirm.disabled).toBe(true);
		await userEvent.type(
			page.getByRole("textbox", { name: "Channel name" }),
			"design",
		);
		await until(() => !confirm.disabled);
		confirm.click();
		await until(() => !channelRow("design"));
	});

	it("deletes a category from its desktop context menu", async () => {
		await mount("desktop", `/app/c/${HQ}/${TEXT}/general`);
		await until(() => !!categorySection("Testing"));
		const header = categorySection("Testing")?.querySelector(
			"[data-category-header]",
		) as HTMLElement;
		rightClick(header);
		await until(() => !!menuItem("Delete category"));
		await userEvent.click(menuItem("Delete category") as HTMLElement);
		await until(() => !!dialogNamed("Delete Testing?"));
		const dialog = dialogNamed("Delete Testing?") as HTMLElement;
		(buttonIn(dialog, "Delete category") as HTMLButtonElement).click();
		await until(() => !categorySection("Testing"));
	});

	it("offers delete in the mobile channel drawer", async () => {
		await mount("mobile", `/app/c/${HQ}`);
		await until(() => !!channelRow("design"));
		await hold(channelRow("design")?.querySelector("button, a") as HTMLElement);
		await until(() => !!dialogNamed("design options"));
		await wait(400);
		const drawer = dialogNamed("design options") as HTMLElement;
		(buttonIn(drawer, "Delete channel") as HTMLButtonElement).click();
		await until(() => !!dialogNamed("Delete #design?"));
	});

	it("hides delete when the viewer lacks the permission", async () => {
		await mount("desktop", `/app/c/${OWLS}`);
		await until(() => !!channelRow("critique"));
		rightClick(channelRow("critique") as HTMLElement);
		await until(() => !!menuItem("Mark as read"));
		expect(menuItem("Delete channel")).toBeUndefined();
	});
});

describe("muted Spaces", () => {
	it("clears the rail pill and mention count while a Space is muted", async () => {
		const store = await mount("desktop", `/app/c/${HQ}/${TEXT}/general`);
		await until(() =>
			Array.from(
				document.querySelectorAll<HTMLElement>("[data-rail-item]"),
			).some((item) => item.dataset.state === "unread"),
		);
		const item = Array.from(
			document.querySelectorAll<HTMLElement>("[data-rail-item]"),
		).find((entry) => entry.dataset.state === "unread") as HTMLElement;
		const label = item.querySelector(".sr-only")?.textContent ?? "";
		const community = store.communities
			.value()
			?.find((entry) => label.startsWith(entry.name));
		expect(community).toBeDefined();
		const prefs = spaceNotificationPrefs(store);
		prefs.setMuted(community?.did ?? "", true);
		await until(() => item.dataset.state === "read");
		expect(item.querySelector("[data-rail-mentions]")).toBeNull();
		prefs.setMuted(community?.did ?? "", false);
		await until(() => item.dataset.state === "unread");
	});

	it("mutes a Space from the notification settings dialog", async () => {
		const store = await mount("desktop", `/app/c/${HQ}/${TEXT}/general`);
		await until(() => !!document.querySelector("[data-rail-item]"));
		const hq = store.communities.value()?.find((entry) => entry.did === HQ);
		const item = Array.from(
			document.querySelectorAll<HTMLElement>("[data-rail-item]"),
		).find((entry) =>
			entry.querySelector(".sr-only")?.textContent?.startsWith(hq?.name ?? "-"),
		);
		rightClick(item?.querySelector("button") as HTMLElement);
		await until(() => !!menuItem("Notification settings"));
		await userEvent.click(menuItem("Notification settings") as HTMLElement);
		await until(
			() => !!document.querySelector("[data-space-notification-settings]"),
		);
		const panel = document.querySelector(
			"[data-space-notification-settings]",
		) as HTMLElement;
		expect(panel.textContent).toContain("All messages");
		expect(panel.textContent).toContain("Mentions and replies");
		expect(panel.textContent).toContain("Nothing");
		(
			panel.querySelector(
				'input[type="radio"][value="nothing"]',
			) as HTMLInputElement
		).click();
		(
			panel.querySelector(
				'input[role="switch"], input[type="checkbox"]',
			) as HTMLInputElement
		).click();
		const did = HQ;
		const prefs = spaceNotificationPrefs(store);
		await until(() => prefs.isMuted(did));
		expect(prefs.level(did)).toBe("nothing");
	});
});

describe("category collapse", () => {
	it("remembers a collapsed category across mounts", async () => {
		localStorage.removeItem(categoryCollapseKey(HQ, "talk"));
		await mount("desktop", `/app/c/${HQ}/${TEXT}/general`);
		await until(() => !!categorySection("Talk"));
		(
			categorySection("Talk")?.querySelector(
				"[data-category-toggle]",
			) as HTMLButtonElement
		).click();
		await until(() => categorySection("Talk")?.dataset.collapsed === "true");
		expect(localStorage.getItem(categoryCollapseKey(HQ, "talk"))).toBe("1");
		dispose?.();
		dispose = undefined;
		document.body.replaceChildren();
		await mount("desktop", `/app/c/${HQ}/${TEXT}/general`);
		await until(() => !!categorySection("Talk"));
		expect(categorySection("Talk")?.dataset.collapsed).toBe("true");
		(
			categorySection("Talk")?.querySelector(
				"[data-category-toggle]",
			) as HTMLButtonElement
		).click();
		await until(() => !categorySection("Talk")?.dataset.collapsed);
		expect(localStorage.getItem(categoryCollapseKey(HQ, "talk"))).toBeNull();
	});
});
