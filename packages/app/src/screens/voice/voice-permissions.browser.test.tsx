import "../../app.css";
import { CALL_PERMISSION_COPY } from "@colibri-social/ui";
import { Suspense } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createMockVoiceConnection } from "../../data/mock/voice";
import { createSimulatedConnection } from "../../data/mock/voice-connection";
import { createDataStore, DataContext } from "../../data/store";
import { setVoiceConnectionMonitor, voice } from "../../data/voice";
import { Providers } from "../../providers";
import { DesktopShell } from "../../shell/desktop/DesktopShell";
import { closeVoicePrompt } from "./voice-prompt";

const OWLS = "did:plc:nightowlsartclub3e5f7g9h";
const VOICE = "social.colibri.beta.channel.voice";

let dispose: (() => void) | undefined;

afterEach(() => {
	voice.leave();
	setVoiceConnectionMonitor(createSimulatedConnection());
	closeVoicePrompt();
	dispose?.();
	dispose = undefined;
	document.body.replaceChildren();
	history.replaceState(null, "", "/");
});

const mount = async (slug: string) => {
	setLatency(0);
	const source = createMockSource({ live: false });
	setVoiceConnectionMonitor(
		createMockVoiceConnection(source.world, {
			connectMs: 20,
			tickMs: 60,
			random: () => 0.5,
			moveMs: 200,
			grantMs: 60_000,
		}),
	);
	await page.viewport(1440, 900);
	history.replaceState(null, "", `/app/c/${OWLS}/${VOICE}/${slug}`);
	const store = createDataStore(source);
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
	await expect
		.poll(() => document.querySelector("[data-voice-desktop]"))
		.not.toBeNull();
	return host;
};

const stage = () =>
	document.querySelector<HTMLElement>("[data-voice-desktop]") as HTMLElement;

const header = () =>
	document.querySelector<HTMLElement>(
		'[data-outlet="header"] [data-channel-header="desktop"]',
	) as HTMLElement;

const button = (scope: ParentNode, name: string) =>
	Array.from(scope.querySelectorAll<HTMLButtonElement>("button")).find(
		(element) =>
			element.getAttribute("aria-label") === name ||
			element.textContent?.trim() === name,
	);

const join = async () => {
	await userEvent.click(button(stage(), "Join voice") as HTMLElement);
	await expect.poll(() => stage().hasAttribute("data-joined")).toBe(true);
};

const toolbar = () =>
	stage().querySelector<HTMLElement>('[role="toolbar"]') as HTMLElement;

const voiceRows = (host: HTMLElement) =>
	Array.from(
		host.querySelectorAll("[data-voice-row] [data-channel-name]"),
		(name) => name.textContent?.trim(),
	);

it("hides the chat entry and disables the mic where speaking and chat are denied", async () => {
	await mount("waiting-room");
	expect(header().textContent).toContain("Waiting room");
	expect(button(header(), "Open chat")).toBeUndefined();
	await join();
	await expect
		.poll(() => button(toolbar(), CALL_PERMISSION_COPY.speakLabel))
		.toBeTruthy();
	expect(
		button(toolbar(), CALL_PERMISSION_COPY.speakLabel)?.disabled ||
			button(toolbar(), CALL_PERMISSION_COPY.speakLabel)?.getAttribute(
				"aria-disabled",
			) === "true",
	).toBe(true);
	expect(button(toolbar(), "Open chat")).toBeUndefined();
	expect(voice.muted()).toBe(true);
	expect(document.querySelector("[data-shell-thread]")).toBeNull();
});

it("disables camera and screen share without even trying to send them", async () => {
	await mount("draw-along");
	expect(button(header(), "Open chat")).toBeTruthy();
	await join();
	const camera = () => button(toolbar(), CALL_PERMISSION_COPY.cameraLabel);
	const screen = () => button(toolbar(), CALL_PERMISSION_COPY.screenshareLabel);
	await expect.poll(camera).toBeTruthy();
	expect(
		camera()?.disabled || camera()?.getAttribute("aria-disabled") === "true",
	).toBe(true);
	expect(
		screen()?.disabled || screen()?.getAttribute("aria-disabled") === "true",
	).toBe(true);
	voice.toggleCamera();
	expect(voice.camera()).toBe(false);
	expect(voice.cameraPending()).toBe(false);
});

it("lists a moved-into hidden channel as the joined row and drops it after leaving", async () => {
	const host = await mount("waiting-room");
	expect(voiceRows(host)).not.toContain("Critique booth");
	await join();
	await expect
		.poll(() => voiceRows(host))
		.toEqual(["Draw along", "Quiet studio", "Waiting room", "Critique booth"]);
	const joined = host.querySelector<HTMLElement>(
		"[data-voice-row][data-joined]",
	);
	expect(joined?.querySelector("[data-channel-name]")?.textContent).toBe(
		"Critique booth",
	);
	expect(joined?.querySelector("[data-channel-private]")).not.toBeNull();
	await expect
		.poll(() => document.querySelector("[data-voice-status]")?.textContent)
		.toContain("Critique booth");
	await expect.poll(() => voice.connection().state).toBe("connected");
	(
		host.querySelector(
			"[data-voice-row][data-joined] > button",
		) as HTMLButtonElement
	).click();
	await expect
		.poll(() => location.pathname)
		.toBe(`/app/c/${OWLS}/${VOICE}/critique-booth`);
	await expect.poll(() => stage()?.hasAttribute("data-joined")).toBe(true);
	expect(header().textContent).toContain("Critique booth");
	await expect
		.poll(() => button(toolbar(), CALL_PERMISSION_COPY.listenLabel))
		.toBeTruthy();
	expect(button(toolbar(), "Open chat")).toBeUndefined();
	expect(button(header(), "Open chat")).toBeUndefined();

	(
		button(
			document.querySelector("[data-voice-status]") as HTMLElement,
			"Disconnect",
		) as HTMLButtonElement
	).click();
	await expect.poll(() => voice.current()).toBeUndefined();
	await expect
		.poll(() => voiceRows(host))
		.toEqual(["Draw along", "Quiet studio", "Waiting room"]);
	await expect.poll(() => location.pathname).not.toContain("critique-booth");
	expect(location.pathname.startsWith(`/app/c/${OWLS}/`)).toBe(true);
	await expect.poll(() => header()?.textContent ?? "").not.toBe("");
	expect(header()?.textContent).not.toContain("Critique booth");
});
