import "../app.css";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { DEVICE_KEYS } from "../data/device-prefs";
import { LEGACY_PREFERENCES_KEY } from "../data/preferences/legacy";
import {
	PREVIEW_VERSION,
	type ReleaseNoteSummary,
} from "../data/release-notes";
import {
	FALLBACK_RELEASE_NOTE_ICON,
	RELEASE_NOTE_ICONS,
} from "../data/release-notes/icons";
import { WHATS_NEW_SEEN_KEY } from "../data/whats-new";

const ICON =
	Object.keys(RELEASE_NOTE_ICONS).find(
		(icon) => icon !== FALLBACK_RELEASE_NOTE_ICON,
	) ?? FALLBACK_RELEASE_NOTE_ICON;

import { createDeviceNotifications } from "../native/notifications/device";
import type { OsNotifier } from "../native/notifications/index";
import { Providers } from "../providers";
import { claimBlockingDialog } from "./blocking-dialogs";
import type { Layer } from "./layers";
import { NotificationPrompt } from "./NotificationPrompt";
import { WhatsNewHost } from "./WhatsNewHost";

const note = (version: string): ReleaseNoteSummary => ({
	version,
	date: "November 20, 2026",
	title: "Fresh paint",
	entries: [
		{
			title: "A new look",
			body: "Everything got a new design.",
			icon: ICON,
			kind: "feature",
		},
	],
});

const RELEASE = note("0.8.0");

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let dispose: (() => void) | undefined;

beforeEach(() => {
	localStorage.removeItem(WHATS_NEW_SEEN_KEY);
});

afterEach(() => {
	dispose?.();
	dispose = undefined;
	vi.restoreAllMocks();
	document.body.replaceChildren();
});

const fakeStack = () => {
	const [top, setTop] = createSignal<Layer>();
	const pushed: Layer[] = [];
	return {
		top,
		setTop,
		pushed,
		push: (layer: Layer) => {
			pushed.push(layer);
			setTop(layer);
		},
	};
};

const mount = (
	notes: readonly ReleaseNoteSummary[] = [RELEASE],
	extra?: () => unknown,
) => {
	const stack = fakeStack();
	const host = document.createElement("div");
	document.body.append(host);
	dispose = render(
		() => (
			<Providers>
				{extra?.() as never}
				<WhatsNewHost stack={stack} notes={notes} />
			</Providers>
		),
		host,
	);
	return stack;
};

const popup = () => page.getByRole("dialog", { name: "Fresh paint" });

const popupOpen = () =>
	[...document.querySelectorAll('[role="dialog"]')].some((dialog) =>
		dialog.textContent?.includes("Fresh paint"),
	);

const expectHidden = async () => {
	await wait(300);
	expect(popupOpen()).toBe(false);
};

const closePopup = async () => {
	await page.getByRole("button", { name: "Got it" }).click();
	await expect.poll(popupOpen).toBe(false);
};

it("records the newest release on a fresh install and stays hidden", async () => {
	mount();
	await expectHidden();
	expect(localStorage.getItem(WHATS_NEW_SEEN_KEY)).toBe("0.8.0");
});

it("shows the newest release after an upgrade", async () => {
	localStorage.setItem(WHATS_NEW_SEEN_KEY, "0.7.0");
	mount([RELEASE, note("0.7.0")]);
	await expect.element(popup()).toBeVisible();
	await expect
		.element(page.getByText("Version 0.8.0, November 20, 2026"))
		.toBeVisible();
	const icon = document.querySelector("[data-release-note-item] svg");
	expect(icon?.getAttribute("class")).toContain(`solar-${ICON}-bold`);
});

it("shows the release to people coming from the old app", async () => {
	localStorage.setItem(
		LEGACY_PREFERENCES_KEY,
		JSON.stringify({ theme: "dark", lastSeenReleaseNote: "0.5.1" }),
	);
	mount();
	await expect.element(popup()).toBeVisible();
});

it("shows the release when old app settings exist without a seen release", async () => {
	localStorage.setItem(LEGACY_PREFERENCES_KEY, JSON.stringify({}));
	mount();
	await expect.element(popup()).toBeVisible();
});

it("stores the release when closed and doesn't show it again", async () => {
	localStorage.setItem(WHATS_NEW_SEEN_KEY, "0.7.0");
	mount();
	await expect.element(popup()).toBeVisible();
	await closePopup();
	expect(localStorage.getItem(WHATS_NEW_SEEN_KEY)).toBe("0.8.0");
	dispose?.();
	document.body.replaceChildren();
	mount();
	await expectHidden();
});

it("opens the full list from the popup and counts that as seen", async () => {
	localStorage.setItem(WHATS_NEW_SEEN_KEY, "0.7.0");
	const stack = mount();
	await expect.element(popup()).toBeVisible();
	await page.getByRole("button", { name: "See all updates" }).click();
	expect(stack.pushed).toEqual([{ kind: "settings", page: "whatsNew" }]);
	expect(localStorage.getItem(WHATS_NEW_SEEN_KEY)).toBe("0.8.0");
	await expect.poll(popupOpen).toBe(false);
});

it("shows the preview release until the preview itself is seen", async () => {
	mount([note(PREVIEW_VERSION)]);
	await expect.element(popup()).toBeVisible();
	await closePopup();
	expect(localStorage.getItem(WHATS_NEW_SEEN_KEY)).toBe(PREVIEW_VERSION);
	dispose?.();
	document.body.replaceChildren();
	mount([note(PREVIEW_VERSION)]);
	await expectHidden();
});

it("waits while another blocking dialog is open", async () => {
	localStorage.setItem(WHATS_NEW_SEEN_KEY, "0.7.0");
	const [blocking, setBlocking] = createSignal(true);
	mount([RELEASE], () => {
		claimBlockingDialog(blocking);
		return null;
	});
	await expectHidden();
	setBlocking(false);
	await expect.element(popup()).toBeVisible();
});

it("keeps the notification prompt waiting until it's closed", async () => {
	localStorage.setItem(WHATS_NEW_SEEN_KEY, "0.7.0");
	localStorage.removeItem(DEVICE_KEYS.notificationPrompt);
	const notifier: OsNotifier = {
		kind: "native",
		permission: async () => "default",
		requestPermission: async () => "default",
		show: async () => {},
		dismiss: async () => {},
		clearAll: async () => {},
		onActivation: () => () => {},
	};
	const device = createDeviceNotifications(async () => notifier);
	mount([RELEASE], () => (
		<NotificationPrompt device={device} notifier={async () => notifier} />
	));
	await expect.element(popup()).toBeVisible();
	await wait(300);
	expect(
		document.querySelectorAll('[role="dialog"], [role="alertdialog"]'),
	).toHaveLength(1);
	await closePopup();
	await expect
		.element(page.getByRole("dialog", { name: "Turn on notifications?" }))
		.toBeVisible();
});

it("waits while an invite is open", async () => {
	localStorage.setItem(WHATS_NEW_SEEN_KEY, "0.7.0");
	const stack = fakeStack();
	stack.setTop({ kind: "join", code: "abc" });
	const host = document.createElement("div");
	document.body.append(host);
	dispose = render(
		() => (
			<Providers>
				<WhatsNewHost stack={stack} notes={[RELEASE]} />
			</Providers>
		),
		host,
	);
	await expectHidden();
	stack.setTop(undefined);
	await expect.element(popup()).toBeVisible();
});

it("keeps working when storage throws", async () => {
	vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
		throw new Error("storage blocked");
	});
	vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
		throw new Error("storage blocked");
	});
	mount();
	await expectHidden();
});

it("shows on desktop as a dialog", async () => {
	await page.viewport(1200, 900);
	try {
		localStorage.setItem(WHATS_NEW_SEEN_KEY, "0.7.0");
		mount();
		await expect.element(popup()).toBeVisible();
		await closePopup();
	} finally {
		await page.viewport(402, 874);
	}
});
