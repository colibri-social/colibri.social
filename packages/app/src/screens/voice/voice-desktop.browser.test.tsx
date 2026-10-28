import "../../app.css";
import { createSignal, Suspense } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createSimulatedConnection } from "../../data/mock/voice-connection";
import { createDataStore, DataContext } from "../../data/store";
import {
	setVoiceConnectionMonitor,
	setVoiceSoundPlayer,
	voice,
} from "../../data/voice";
import {
	createVoiceSoundPlayer,
	type VoiceSound,
} from "../../data/voice-sounds";
import { Providers } from "../../providers";
import { DesktopShell } from "../../shell/desktop/DesktopShell";
import { closeVoicePrompt } from "./voice-prompt";

const HQ = "did:plc:colibrihqspace2a4b6c8d";
const VOICE = "social.colibri.beta.channel.voice";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

let dispose: (() => void) | undefined;

afterEach(() => {
	voice.leave();
	setVoiceConnectionMonitor(createSimulatedConnection());
	localStorage.removeItem("colibri:voice-floating-corner");
	setVoiceSoundPlayer(createVoiceSoundPlayer());
	closeVoicePrompt();
	dispose?.();
	dispose = undefined;
	document.body.replaceChildren();
	history.replaceState(null, "", "/");
});

let lastStore: ReturnType<typeof createDataStore> | undefined;

const mountAt = async (path: string, connectMs = 30) => {
	setLatency(0);
	setVoiceConnectionMonitor(
		createSimulatedConnection({ connectMs, tickMs: 60, random: () => 0.5 }),
	);
	await page.viewport(1440, 900);
	history.replaceState(null, "", path);
	const store = createDataStore(createMockSource({ live: false }));
	lastStore = store;
	const host = document.createElement("div");
	host.style.cssText = "position:fixed;inset:0";
	document.body.append(host);
	dispose = render(
		() => (
			<DataContext.Provider value={store}>
				<Providers>
					<Suspense fallback={<div data-shell-fallback="" />}>
						<DesktopShell />
					</Suspense>
				</Providers>
			</DataContext.Provider>
		),
		host,
	);
	return { host, store };
};

const mount = async (slug: string, connectMs?: number) => {
	const { host } = await mountAt(`/app/c/${HQ}/${VOICE}/${slug}`, connectMs);
	await expect
		.poll(() => document.querySelector("[data-voice-desktop]"))
		.not.toBeNull();
	return host;
};

const stage = () =>
	document.querySelector<HTMLElement>("[data-voice-desktop]") as HTMLElement;

const button = (scope: ParentNode, name: string) =>
	Array.from(scope.querySelectorAll<HTMLElement>("button")).find(
		(element) =>
			element.getAttribute("aria-label") === name ||
			element.textContent?.trim() === name,
	) as HTMLElement;

const turnOnCamera = async () => {
	const control = () => {
		const status = document.querySelector<HTMLElement>("[data-voice-status]");
		return status ? button(status, "Turn on camera") : undefined;
	};
	await expect.poll(control).toBeTruthy();
	(control() as HTMLElement).click();
};

const header = () =>
	document.querySelector<HTMLElement>(
		'[data-outlet="header"] [data-channel-header="desktop"]',
	) as HTMLElement;

const expectNoMobileOverlays = () => {
	expect(document.querySelector('[role="dialog"]')).toBeNull();
	expect(document.querySelector("[data-call-pill]")).toBeNull();
};

it("shows a centered join prompt with a desktop header", async () => {
	await mount("lounge");
	const join = stage().querySelector<HTMLElement>("[data-voice-join-prompt]");
	expect(join).not.toBeNull();
	expect(join?.querySelector('[role="list"], ul')).toBeNull();
	expect(join?.querySelector("[data-voice-join-text]")?.textContent).toMatch(
		/ (is|are) here\.$/,
	);
	const joinButton = button(stage(), "Join voice");
	expect(joinButton.getBoundingClientRect().height).toBe(36);
	expect(joinButton.getBoundingClientRect().width).toBeLessThan(200);
	expect(button(stage(), "Join muted")).toBeUndefined();
	expect(button(stage(), "Open chat")).toBeUndefined();
	expect(header().textContent).toContain("Lounge");
	expect(button(header(), "Open chat")).toBeTruthy();
	expect(header().querySelector('[aria-label="Channel settings"]')).toBeNull();
	const main = document.querySelector("[data-shell-main]") as HTMLElement;
	const box = (join as HTMLElement).getBoundingClientRect();
	const area = main.getBoundingClientRect();
	expect(
		Math.abs(box.left + box.width / 2 - (area.left + area.width / 2)),
	).toBeLessThan(2);
	expect(join?.querySelector("[data-speaking]")).toBeNull();
	expectNoMobileOverlays();
});

it("joins into the grid with call controls and plays the join sound", async () => {
	await mount("standup");
	const played: VoiceSound[] = [];
	setVoiceSoundPlayer((sound) => played.push(sound));
	await userEvent.click(button(stage(), "Join voice"));
	await expect.poll(() => stage().hasAttribute("data-joined")).toBe(true);
	expect(played).toEqual(["join"]);
	expect(voice.current()?.channel.endsWith("/standup")).toBe(true);
	expect(voice.muted()).toBe(false);
	expect(stage().querySelector("[data-voice-grid]")).not.toBeNull();
	await expect
		.poll(() => stage().querySelectorAll("[data-voice-tile]").length)
		.toBe(1);
	const toolbar = stage().querySelector('[role="toolbar"]') as HTMLElement;
	expect(toolbar.getAttribute("aria-label")).toBe("Call controls");
	button(toolbar, "Mute").click();
	expect(voice.muted()).toBe(true);
	expectNoMobileOverlays();
});

it("opens and closes the voice chat in the right pane", async () => {
	await mount("lounge");
	expect(document.querySelector("[data-shell-thread]")).toBeNull();
	expect(button(header(), "Open chat").getAttribute("aria-pressed")).toBe(
		"false",
	);
	await userEvent.click(button(header(), "Open chat"));
	await expect
		.poll(() => document.querySelector("[data-shell-thread]"))
		.not.toBeNull();
	expect(location.pathname).toBe(`/app/c/${HQ}/${VOICE}/lounge`);
	const close = button(header(), "Close chat");
	expect(close.getAttribute("aria-pressed")).toBe("true");
	await userEvent.click(close);
	await expect
		.poll(() => document.querySelector("[data-shell-thread]"))
		.toBeNull();
});

it("sends a message from the voice chat pane", async () => {
	const { store } = await mountAt(`/app/c/${HQ}/${VOICE}/lounge`);
	await expect
		.poll(() => document.querySelector("[data-voice-desktop]"))
		.not.toBeNull();
	await userEvent.click(button(header(), "Open chat"));
	const pane = () =>
		document.querySelector<HTMLElement>("[data-shell-thread]") as HTMLElement;
	await expect
		.poll(() => pane()?.querySelector('[role="textbox"]') ?? null)
		.not.toBeNull();
	const editor = pane().querySelector<HTMLElement>(
		'[role="textbox"]',
	) as HTMLElement;
	editor.focus();
	const text = "Hello from the voice chat";
	await userEvent.keyboard(text);
	await userEvent.keyboard("{Enter}");
	await expect
		.poll(
			() =>
				Array.from(pane().querySelectorAll<HTMLElement>("[data-state]")).find(
					(row) => row.textContent?.includes(text),
				)?.dataset.state,
		)
		.toBe("sent");
	void store;
});

it("keeps the call in the user panel after switching channels and returns to it", async () => {
	const host = await mount("standup");
	await userEvent.click(button(stage(), "Join voice"));
	await expect.poll(() => stage().hasAttribute("data-joined")).toBe(true);
	const general = Array.from(
		host.querySelectorAll<HTMLElement>("[data-shell-sidebar] button"),
	).find((element) => element.textContent?.trim().startsWith("general"));
	expect(general).toBeTruthy();
	await userEvent.click(general as HTMLElement);
	await expect
		.poll(() => document.querySelector("[data-voice-desktop]"))
		.toBeNull();
	const panel = document.querySelector<HTMLElement>(
		"[data-user-panel] [data-voice-status]",
	);
	expect(panel).not.toBeNull();
	expect(panel?.textContent).toContain("Standup");
	button(panel as HTMLElement, "Mute").click();
	expect(voice.muted()).toBe(true);
	await userEvent.click(
		panel?.querySelector("[data-open-call]") as HTMLElement,
	);
	await expect
		.poll(() => document.querySelector("[data-voice-desktop][data-joined]"))
		.not.toBeNull();
	expect(location.pathname).toBe(`/app/c/${HQ}/${VOICE}/standup`);
	expectNoMobileOverlays();
});

it("leaves from the stage controls and from the user panel", async () => {
	await mount("standup");
	await userEvent.click(button(stage(), "Join voice"));
	await expect.poll(() => stage().hasAttribute("data-joined")).toBe(true);
	await userEvent.click(button(stage(), "Leave call"));
	await expect.poll(() => voice.current()).toBeUndefined();
	await expect
		.poll(() => stage().querySelector("[data-voice-join]"))
		.not.toBeNull();
	await wait(50);
	expect(document.querySelector("[data-voice-status]")).toBeNull();
	await userEvent.click(button(stage(), "Join voice"));
	await expect
		.poll(() => document.querySelector("[data-voice-status]"))
		.not.toBeNull();
	await userEvent.click(
		button(
			document.querySelector("[data-voice-status]") as HTMLElement,
			"Disconnect",
		),
	);
	await expect.poll(() => voice.current()).toBeUndefined();
	await expect
		.poll(() => document.querySelector("[data-voice-status]"))
		.toBeNull();
});

const openGeneral = async (host: HTMLElement) => {
	const general = Array.from(
		host.querySelectorAll<HTMLElement>("[data-shell-sidebar] button"),
	).find((element) => element.textContent?.trim().startsWith("general"));
	await userEvent.click(general as HTMLElement);
	await expect
		.poll(() => document.querySelector("[data-voice-desktop]"))
		.toBeNull();
};

const floating = () =>
	document.querySelector<HTMLElement>("[data-voice-floating]");

it("reports a connecting then measured connection in the status panel", async () => {
	await mount("standup", 400);
	await userEvent.click(button(stage(), "Join voice"));
	const panel = () =>
		document.querySelector<HTMLElement>("[data-voice-status]") as HTMLElement;
	await expect.poll(() => panel()?.dataset.state).toBe("connecting");
	await expect.poll(() => panel().dataset.state).toBe("connected");
	expect(panel().dataset.quality).toBe("excellent");
	expect(voice.connection().latency).toBeGreaterThan(0);
	expect(panel().textContent).toContain("Voice connected");
	await userEvent.click(button(stage(), "Leave call"));
	expect(voice.connection().state).toBe("disconnected");
});

it("shows the floating window with video away from the call and snaps it to corners", async () => {
	const host = await mount("standup");
	await userEvent.click(button(stage(), "Join voice"));
	await expect.poll(() => voice.connection().state).toBe("connected");
	await openGeneral(host);
	expect(floating()).toBeNull();
	await turnOnCamera();
	await expect.poll(() => floating()).not.toBeNull();
	expect(floating()?.dataset.corner).toBe("br");
	const surface = () =>
		floating()?.querySelector<HTMLElement>("[data-floating-surface]");
	await expect
		.poll(async () => {
			surface()?.focus();
			await userEvent.keyboard("{ArrowUp}");
			return floating()?.dataset.corner;
		})
		.toBe("tr");
	expect(localStorage.getItem("colibri:voice-floating-corner")).toBe("tr");
	await userEvent.keyboard("{ArrowLeft}");
	await expect.poll(() => floating()?.dataset.corner).toBe("tl");

	button(floating() as HTMLElement, "Hide floating window").click();
	await expect.poll(() => floating()).toBeNull();
	const show = button(
		document.querySelector("[data-voice-status]") as HTMLElement,
		"Show floating window",
	);
	show.click();
	await expect.poll(() => floating()?.dataset.corner).toBe("tl");

	(floating()?.querySelector("[data-floating-surface]") as HTMLElement).focus();
	await userEvent.keyboard("{Enter}");
	await expect
		.poll(() => document.querySelector("[data-voice-desktop][data-joined]"))
		.not.toBeNull();
	expect(location.pathname).toBe(`/app/c/${HQ}/${VOICE}/standup`);
	expect(floating()).toBeNull();
	expectNoMobileOverlays();
});

it("keeps the floating window hidden without video and after leaving", async () => {
	const host = await mount("standup");
	await userEvent.click(button(stage(), "Join voice"));
	await openGeneral(host);
	await new Promise((r) => setTimeout(r, 100));
	expect(floating()).toBeNull();
	await turnOnCamera();
	await expect.poll(() => floating()).not.toBeNull();
	button(floating() as HTMLElement, "Disconnect").click();
	await expect.poll(() => voice.current()).toBeUndefined();
	expect(floating()).toBeNull();
});

it("returns to the call when double clicking the floating window", async () => {
	const host = await mount("standup");
	await userEvent.click(button(stage(), "Join voice"));
	await expect.poll(() => voice.connection().state).toBe("connected");
	await openGeneral(host);
	await turnOnCamera();
	await expect.poll(() => floating()).not.toBeNull();
	const surface = floating()?.querySelector(
		"[data-floating-surface]",
	) as HTMLElement;
	await userEvent.dblClick(surface);
	await expect
		.poll(() => document.querySelector("[data-voice-desktop][data-joined]"))
		.not.toBeNull();
	expect(location.pathname).toBe(`/app/c/${HQ}/${VOICE}/standup`);
	expect(floating()).toBeNull();
});

const floatingName = () =>
	floating()?.querySelector("[data-voice-tile]")?.getAttribute("aria-label");

it("shares the grid focus with the floating window", async () => {
	const host = await mount("lounge");
	await userEvent.click(button(stage(), "Join voice"));
	await expect.poll(() => stage().hasAttribute("data-joined")).toBe(true);
	await expect
		.poll(() => stage().querySelectorAll("[data-voice-tile]").length)
		.toBe(4);
	const tiles = Array.from(
		stage().querySelectorAll<HTMLElement>("button[data-voice-tile]"),
	);
	const other = tiles.find(
		(tile) => !tile.textContent?.includes(voiceSelfName()),
	) as HTMLElement;
	const otherName = (
		other.querySelector("[data-tile-label]")?.textContent ?? ""
	)
		.replace(", speaking", "")
		.trim();
	other.click();
	await expect.poll(() => voice.focusedKey()).toMatch(/^p:did:/);
	expect(
		stage().querySelector("[data-voice-grid][data-focused]"),
	).not.toBeNull();
	await turnOnCamera();
	await openGeneral(host);
	await expect.poll(() => floatingName()).toContain(otherName);

	(floating()?.querySelector("[data-floating-surface]") as HTMLElement).focus();
	await userEvent.keyboard("{Enter}");
	const focusedTile = () =>
		stage()?.querySelector<HTMLElement>(
			'[data-voice-grid][data-focused] button[data-voice-tile][aria-pressed="true"]',
		);
	await expect.poll(focusedTile).toBeTruthy();
	(focusedTile() as HTMLElement).click();
	await expect.poll(() => voice.focusedKey()).toBeNull();
	await openGeneral(host);
	await expect.poll(() => floatingName()).toBeTruthy();
	expect(floatingName()).not.toContain(otherName);
	await userEvent.click(button(floating() as HTMLElement, "Disconnect"));
	expect(voice.focusedKey()).toBeNull();
});

const voiceSelfName = () =>
	document
		.querySelector("[data-user-panel-profile] .truncate")
		?.textContent?.trim() ?? "";

const sidebarRow = (host: HTMLElement, name: string) =>
	Array.from(
		host.querySelectorAll<HTMLElement>("[data-shell-sidebar] button"),
	).find((element) => element.textContent?.trim().startsWith(name)) as
		| HTMLElement
		| undefined;

const mountGeneral = async (connectMs = 30) => {
	const app = await mountAt(`/app/c/${HQ}`, connectMs);
	await expect.poll(() => location.pathname).toContain("channel.text");
	await expect.poll(() => sidebarRow(app.host, "Standup")).toBeTruthy();
	return { ...app, path: location.pathname };
};

it("joins a voice channel from the sidebar without leaving the current channel", async () => {
	const { host, path } = await mountGeneral();
	const played: VoiceSound[] = [];
	setVoiceSoundPlayer((sound) => played.push(sound));
	await userEvent.click(sidebarRow(host, "Standup") as HTMLElement);
	expect(voice.current()?.channel.endsWith("/standup")).toBe(true);
	expect(played).toEqual(["join"]);
	expect(location.pathname).toBe(path);
	expect(document.querySelector("[data-voice-desktop]")).toBeNull();
	await expect.poll(() => voice.connection().state).toBe("connected");
	await userEvent.click(sidebarRow(host, "Standup") as HTMLElement);
	await expect
		.poll(() => document.querySelector("[data-voice-desktop][data-joined]"))
		.not.toBeNull();
	expect(location.pathname).toBe(`/app/c/${HQ}/${VOICE}/standup`);
	expect(played).toEqual(["join"]);
	expectNoMobileOverlays();
});

it("keeps the current text channel mounted while joining from the sidebar", async () => {
	const { host } = await mountGeneral();
	const view = () =>
		document.querySelector<HTMLElement>('[data-channel-view="desktop"]');
	await expect.poll(view).not.toBeNull();
	const before = view();
	const swaps: string[] = [];
	const observer = new MutationObserver(() => {
		if (view() !== before) swaps.push("view");
		if (document.querySelector("[data-shell-fallback]")) swaps.push("fallback");
	});
	observer.observe(host, { childList: true, subtree: true });
	await userEvent.click(sidebarRow(host, "Standup") as HTMLElement);
	await expect.poll(() => voice.connection().state).toBe("connected");
	await wait(300);
	observer.disconnect();
	expect(swaps).toEqual([]);
	expect(view()).toBe(before);
});

it("switches calls from the sidebar with a leave and a join sound", async () => {
	const { host, path } = await mountGeneral();
	await userEvent.click(sidebarRow(host, "Lounge") as HTMLElement);
	expect(voice.current()?.channel.endsWith("/lounge")).toBe(true);
	const played: VoiceSound[] = [];
	setVoiceSoundPlayer((sound) => played.push(sound));
	await userEvent.click(sidebarRow(host, "Standup") as HTMLElement);
	expect(voice.current()?.channel.endsWith("/standup")).toBe(true);
	expect(played).toEqual(["leave", "join"]);
	expect(location.pathname).toBe(path);
});

it("ignores a second click while the call is still connecting", async () => {
	const { host, path } = await mountGeneral(5_000);
	await userEvent.click(sidebarRow(host, "Standup") as HTMLElement);
	expect(voice.connection().state).toBe("connecting");
	expect(location.pathname).toBe(path);
	const played: VoiceSound[] = [];
	setVoiceSoundPlayer((sound) => played.push(sound));
	await userEvent.click(sidebarRow(host, "Standup") as HTMLElement);
	await new Promise((r) => setTimeout(r, 100));
	expect(location.pathname).toBe(path);
	expect(played).toEqual([]);
	expect(voice.current()?.channel.endsWith("/standup")).toBe(true);
});

it("opens the voice channel without joining when confirm before joining is on", async () => {
	const { host, store } = await mountGeneral();
	store.setControls({ confirmVoiceJoin: true });
	await userEvent.click(sidebarRow(host, "Standup") as HTMLElement);
	await expect
		.poll(() => document.querySelector("[data-voice-desktop]"))
		.not.toBeNull();
	expect(voice.current()).toBeUndefined();
	expect(stage().hasAttribute("data-joined")).toBe(false);
	expect(location.pathname).toBe(`/app/c/${HQ}/${VOICE}/standup`);
	await userEvent.click(button(stage(), "Join voice"));
	await expect.poll(() => stage().hasAttribute("data-joined")).toBe(true);
	expect(voice.current()?.channel.endsWith("/standup")).toBe(true);
});

const OWLS = "did:plc:nightowlsartclub3e5f7g9h";

it("opens a voice channel the viewer can't join without joining", async () => {
	const { host } = await mountAt(`/app/c/${OWLS}`);
	await expect.poll(() => location.pathname).toContain("channel.text");
	await expect.poll(() => sidebarRow(host, "Quiet studio")).toBeTruthy();
	await userEvent.click(sidebarRow(host, "Quiet studio") as HTMLElement);
	await expect
		.poll(() => document.querySelector("[data-voice-desktop]"))
		.not.toBeNull();
	expect(location.pathname).toBe(`/app/c/${OWLS}/${VOICE}/quiet-studio`);
	expect(voice.current()).toBeUndefined();
	const prompt = stage().querySelector<HTMLElement>("[data-voice-join-prompt]");
	expect(prompt?.querySelector("[data-voice-join-disabled]")?.textContent).toBe(
		"You can't join this voice channel.",
	);
	expect(button(stage(), "Join voice")).toBeUndefined();
	expect(button(header(), "Open chat")).toBeTruthy();
});

it("hides Join voice in the context menu of a voice channel the viewer can't join", async () => {
	const { host } = await mountAt(`/app/c/${OWLS}`);
	await expect.poll(() => sidebarRow(host, "Quiet studio")).toBeTruthy();
	rightClick(sidebarRow(host, "Quiet studio") as HTMLElement);
	await expect.poll(() => document.querySelector("[role='menu']")).toBeTruthy();
	const items = Array.from(
		document.querySelectorAll<HTMLElement>("[role='menu'] [role='menuitem']"),
	).map((item) => item.textContent?.trim());
	expect(items).toContain("Open chat");
	expect(items).not.toContain("Join voice");
	await userEvent.keyboard("{Escape}");
});

it("offers confirm before joining on the Voice and video settings page", async () => {
	await mountAt("/app/settings/voiceVideo");
	await expect
		.poll(() => document.querySelector('[data-settings-page="voiceVideo"]'))
		.not.toBeNull();
	const page = document.querySelector(
		'[data-settings-page="voiceVideo"]',
	) as HTMLElement;
	const row = Array.from(
		page.querySelectorAll<HTMLElement>("[data-list-toggle-row]"),
	).find((element) =>
		element.textContent?.includes("Confirm before joining"),
	) as HTMLElement;
	expect(row.textContent).toContain(
		"Opening a voice channel shows who's there. Press Join to connect.",
	);
	expect(lastStore?.controls().confirmVoiceJoin).toBe(false);
	row.click();
	await expect.poll(() => lastStore?.controls().confirmVoiceJoin).toBe(true);
});

it("opens the screen share picker and hands the quality to the browser picker", async () => {
	await mount("standup");
	await userEvent.click(button(stage(), "Join voice"));
	await expect.poll(() => stage().hasAttribute("data-joined")).toBe(true);
	const canvas = document.createElement("canvas");
	const stream = canvas.captureStream(5);
	const track = stream.getVideoTracks()[0] as MediaStreamTrack;
	const requests: unknown[] = [];
	const original = navigator.mediaDevices.getDisplayMedia;
	navigator.mediaDevices.getDisplayMedia = async (request) => {
		requests.push(request);
		return stream;
	};
	try {
		const toolbar = stage().querySelector('[role="toolbar"]') as HTMLElement;
		await userEvent.click(button(toolbar, "Share screen"));
		await expect
			.poll(() =>
				document.querySelector('[role="dialog"] [data-screen-share-quality]'),
			)
			.not.toBeNull();
		const picker = document.querySelector('[role="dialog"]') as HTMLElement;
		expect(picker.textContent).toContain("Share your screen");
		await userEvent.click(button(picker, "Continue"));
		await expect.poll(() => requests.length).toBe(1);
		expect(requests[0]).toMatchObject({
			video: { height: { ideal: 1080, max: 1080 } },
			selfBrowserSurface: "exclude",
		});
		await expect.poll(() => track.readyState).toBe("ended");
		expect(voice.screenSharing()).toBe(false);
	} finally {
		navigator.mediaDevices.getDisplayMedia = original;
	}
});

it("changes the screen share quality from the caret menu", async () => {
	await mount("standup");
	await userEvent.click(button(stage(), "Join voice"));
	await expect.poll(() => stage().hasAttribute("data-joined")).toBe(true);
	const toolbar = stage().querySelector('[role="toolbar"]') as HTMLElement;
	const caret = toolbar.querySelector(
		"[data-screen-share-menu]",
	) as HTMLElement;
	await userEvent.click(caret);
	await expect
		.poll(() => document.querySelectorAll('[role="menuitemradio"]').length)
		.toBeGreaterThan(0);
	const item = Array.from(
		document.querySelectorAll<HTMLElement>('[role="menuitemradio"]'),
	).find((element) => element.textContent?.includes("720p")) as HTMLElement;
	await userEvent.click(item);
	await expect
		.poll(
			() =>
				JSON.parse(localStorage.getItem("colibri:voice-settings") ?? "{}")
					.screen?.resolution,
		)
		.toBe("720");
	localStorage.removeItem("colibri:voice-settings");
});

it("shows the screen sharing options on the Voice and video settings page", async () => {
	await mountAt("/app/settings/voiceVideo");
	await expect
		.poll(() => document.querySelector('[data-settings-page="voiceVideo"]'))
		.not.toBeNull();
	const settings = document.querySelector(
		'[data-settings-page="voiceVideo"]',
	) as HTMLElement;
	expect(settings.textContent).toContain("Screen sharing");
});

const rightClick = (element: HTMLElement) => {
	const box = element.getBoundingClientRect();
	element.dispatchEvent(
		new MouseEvent("contextmenu", {
			bubbles: true,
			cancelable: true,
			button: 2,
			clientX: box.left + 20,
			clientY: box.top + 20,
		}),
	);
};

const menuSliders = () =>
	Array.from(
		document.querySelectorAll<HTMLElement>("[role='menu'] [data-menu-slider]"),
	).map((slider) => slider.textContent?.replace(/\d+%$/, "").trim());

it("opens the member menu with Volume when right-clicking a call tile", async () => {
	await mount("lounge");
	await userEvent.click(button(stage(), "Join voice"));
	await expect
		.poll(() => stage().querySelectorAll("[data-voice-tile]").length)
		.toBe(4);
	const peer = Array.from(
		stage().querySelectorAll<HTMLElement>("[data-voice-tile]"),
	).find((tile) => !tile.textContent?.includes(voiceSelfName())) as HTMLElement;
	rightClick(peer);
	await expect.poll(() => document.querySelector("[role='menu']")).toBeTruthy();
	expect(menuSliders()).toContain("Volume");
	expect(document.querySelector("[role='dialog']")).toBeNull();
	await expect
		.poll(() => document.activeElement?.closest("[data-menu-slider]"))
		.toBeTruthy();
	const slider = document.activeElement as HTMLElement;
	expect(slider.getAttribute("role")).toBe("slider");
	const before = Number(slider.getAttribute("aria-valuenow"));
	await userEvent.keyboard("{ArrowRight}");
	await expect
		.poll(() => Number(slider.getAttribute("aria-valuenow")))
		.toBeGreaterThan(before);
	expect(document.querySelector("[role='menu']")).toBeTruthy();
	await userEvent.keyboard("{Escape}");
	await expect.poll(() => document.querySelector("[role='menu']")).toBeNull();
});

it("keeps the standard menu focus when a tile menu opens from the keyboard", async () => {
	await mount("lounge");
	await userEvent.click(button(stage(), "Join voice"));
	await expect
		.poll(() => stage().querySelectorAll("[data-voice-tile]").length)
		.toBe(4);
	const peer = Array.from(
		stage().querySelectorAll<HTMLElement>("[data-voice-tile]"),
	).find((tile) => !tile.textContent?.includes(voiceSelfName())) as HTMLElement;
	peer.focus();
	peer.dispatchEvent(
		new KeyboardEvent("keydown", { key: "F10", shiftKey: true, bubbles: true }),
	);
	peer.dispatchEvent(
		new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
	);
	await expect
		.poll(() => document.activeElement?.closest("[role='menu']"))
		.toBeTruthy();
	await wait(100);
	expect(document.activeElement?.closest("[data-menu-slider]")).toBeNull();
	await userEvent.keyboard("{Escape}");
	await expect.poll(() => document.querySelector("[role='menu']")).toBeNull();
});

it("offers only Stream volume when right-clicking a screen share tile", async () => {
	await mount("lounge");
	const simulated = createSimulatedConnection({ connectMs: 30, tickMs: 60 });
	const sharer = () => {
		const channel = voice.current()?.channel;
		const viewer = lastStore?.viewer.did;
		return channel
			? lastStore?.inVoice(channel).find((did) => did !== viewer)
			: undefined;
	};
	const stream = new MediaStream();
	setVoiceConnectionMonitor({
		...simulated,
		videos: () => {
			const did = sharer();
			return did ? [{ did, source: "screen", stream }] : [];
		},
	});
	await userEvent.click(button(stage(), "Join voice"));
	await expect
		.poll(() => stage().querySelector("[data-voice-tile][data-kind='screen']"))
		.toBeTruthy();
	rightClick(
		stage().querySelector(
			"[data-voice-tile][data-kind='screen']",
		) as HTMLElement,
	);
	await expect.poll(() => document.querySelector("[role='menu']")).toBeTruthy();
	expect(menuSliders()).toEqual(["Stream volume"]);
	expect(document.querySelector("[role='menu']")?.textContent).not.toContain(
		"View profile",
	);
	await userEvent.keyboard("{Escape}");
});

const mirrored = (video: Element | null | undefined) =>
	!!video && getComputedStyle(video).transform === "matrix(-1, 0, 0, 1, 0, 0)";

it("mirrors only the viewer's own camera on the stage and in the floating window", async () => {
	const host = await mount("lounge");
	const simulated = createSimulatedConnection({ connectMs: 30, tickMs: 60 });
	const peer = () => {
		const channel = voice.current()?.channel;
		const viewer = lastStore?.viewer.did;
		return channel
			? lastStore?.inVoice(channel).find((did) => did !== viewer)
			: undefined;
	};
	const own = new MediaStream();
	const theirs = new MediaStream();
	const screen = new MediaStream();
	setVoiceConnectionMonitor({
		...simulated,
		videos: () => {
			const viewer = lastStore?.viewer.did;
			const other = peer();
			return viewer && other
				? [
						{ did: viewer, source: "cam", stream: own },
						{ did: other, source: "cam", stream: theirs },
						{ did: other, source: "screen", stream: screen },
					]
				: [];
		},
	});
	await userEvent.click(button(stage(), "Join voice"));
	const surfaceOf = (stream: MediaStream, root: ParentNode = stage()) =>
		Array.from(
			root.querySelectorAll<HTMLVideoElement>("[data-video-surface]"),
		).find((video) => video.srcObject === stream);
	await expect.poll(() => surfaceOf(own)).toBeTruthy();
	expect(mirrored(surfaceOf(own))).toBe(true);
	expect(mirrored(surfaceOf(theirs))).toBe(false);
	expect(mirrored(surfaceOf(screen))).toBe(false);

	const ownTile = surfaceOf(own)?.closest<HTMLElement>(
		"button[data-voice-tile]",
	);
	ownTile?.click();
	await expect.poll(() => voice.focusedKey()).toMatch(/^p:/);
	await openGeneral(host);
	await expect
		.poll(() => surfaceOf(own, floating() as HTMLElement))
		.toBeTruthy();
	expect(mirrored(surfaceOf(own, floating() as HTMLElement))).toBe(true);
});

const countSurfaceChurn = async (run: () => Promise<void>) => {
	let mounts = 0;
	let plays = 0;
	const observer = new MutationObserver((records) => {
		for (const record of records)
			for (const node of record.addedNodes)
				if (
					node instanceof Element &&
					(node.matches("[data-video-surface]") ||
						node.querySelector("[data-video-surface]"))
				)
					mounts += 1;
	});
	const play = HTMLMediaElement.prototype.play;
	HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
		plays += 1;
		return play.call(this);
	};
	observer.observe(document.body, { childList: true, subtree: true });
	try {
		await run();
	} finally {
		observer.disconnect();
		HTMLMediaElement.prototype.play = play;
	}
	return { mounts, plays };
};

it("keeps the screen share surface mounted while people talk", async () => {
	await mount("lounge");
	const simulated = createSimulatedConnection({ connectMs: 30, tickMs: 60 });
	const [speakers, setSpeakers] = createSignal<ReadonlySet<string>>(new Set());
	const others = () => {
		const channel = voice.current()?.channel;
		const viewer = lastStore?.viewer.did;
		return channel
			? (lastStore?.inVoice(channel) ?? []).filter((did) => did !== viewer)
			: [];
	};
	const stream = new MediaStream();
	setVoiceConnectionMonitor({
		...simulated,
		speakers,
		videos: () => {
			const did = others()[0];
			return did ? [{ did, source: "screen", stream }] : [];
		},
	});
	await userEvent.click(button(stage(), "Join voice"));
	const screenSurface = () =>
		stage().querySelector<HTMLVideoElement>(
			"[data-voice-tile][data-kind='screen'] [data-video-surface]",
		);
	await expect.poll(() => screenSurface()).toBeTruthy();
	const talk = async () => {
		const talkers = others();
		for (let round = 0; round < 6; round += 1) {
			const talking = round % 2 ? [] : talkers.slice(0, (round % 3) + 1);
			setSpeakers(new Set(talking));
			await expect
				.poll(
					() =>
						stage().querySelectorAll("[data-voice-tile][data-speaking]").length,
				)
				.toBe(talking.length);
		}
	};

	const inGrid = screenSurface();
	expect(await countSurfaceChurn(talk)).toEqual({ mounts: 0, plays: 0 });
	expect(screenSurface()).toBe(inGrid);

	screenSurface()?.closest<HTMLElement>("button[data-voice-tile]")?.click();
	await expect.poll(() => voice.focusedKey()).toMatch(/^s:/);
	const focused = screenSurface();
	expect(await countSurfaceChurn(talk)).toEqual({ mounts: 0, plays: 0 });
	expect(screenSurface()).toBe(focused);
});
