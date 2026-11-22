import "../../app.css";
import { render } from "solid-js/web";
import { afterEach, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext } from "../../data/store";
import { setVoiceSoundPlayer, voice } from "../../data/voice";
import {
	createVoiceSoundPlayer,
	type VoiceSound,
} from "../../data/voice-sounds";
import { Providers } from "../../providers";
import { MobileShell } from "../../shell/MobileShell";
import { closeVoicePrompt } from "./voice-prompt";

const HQ = "did:plc:colibrihqspace2a4b6c8d";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
type Nav = { currentEntry: { index: number } };
const nav = () => (globalThis as unknown as { navigation: Nav }).navigation;

let dispose: (() => void) | undefined;

afterEach(() => {
	voice.leave();
	setVoiceSoundPlayer(createVoiceSoundPlayer());
	closeVoicePrompt();
	dispose?.();
	dispose = undefined;
});

const mount = async (space = HQ) => {
	setLatency(0);
	history.pushState(null, "", `/app/c/${space}`);
	const startIndex = nav().currentEntry.index;
	const store = createDataStore(createMockSource({ live: false }));
	const host = document.createElement("div");
	host.style.cssText = "position:fixed;inset:0;width:402px;height:874px";
	document.body.append(host);
	const stop = render(
		() => (
			<DataContext.Provider value={store}>
				<Providers>
					<MobileShell />
				</Providers>
			</DataContext.Provider>
		),
		host,
	);
	dispose = () => {
		stop();
		host.remove();
		history.replaceState(null, "", "/");
	};
	await wait(1200);
	return { host, offset: () => nav().currentEntry.index - startIndex };
};

const row = (host: HTMLElement, name: string) =>
	Array.from(host.querySelectorAll<HTMLElement>("button")).find((button) =>
		button.textContent?.trim().startsWith(name),
	) as HTMLElement;

const dialog = (name: string) =>
	document.querySelector<HTMLElement>(`[role="dialog"][aria-label="${name}"]`);

const button = (scope: HTMLElement, name: string) =>
	Array.from(scope.querySelectorAll<HTMLElement>("button")).find(
		(element) =>
			element.getAttribute("aria-label") === name ||
			element.textContent?.trim() === name,
	) as HTMLElement;

const settle = () => wait(900);

const openPrompt = async (host: HTMLElement) => {
	await userEvent.click(row(host, "Standup"));
	await settle();
	const prompt = dialog("Join Standup");
	expect(prompt).toBeTruthy();
	return prompt as HTMLElement;
};

it("opens the prompt for an empty voice channel and joins muted into the call screen", async () => {
	const app = await mount();
	const prompt = await openPrompt(app.host);
	expect(prompt.textContent).toContain(
		"This voice channel is empty. Join to get the conversation started!",
	);
	expect(prompt.hasAttribute("data-fill")).toBe(false);
	const played: VoiceSound[] = [];
	setVoiceSoundPlayer((sound) => played.push(sound));
	const mic = button(prompt, "Join muted");
	await userEvent.click(mic);
	expect(mic.getAttribute("aria-pressed")).toBe("true");
	expect(played).toEqual(["mute"]);
	await userEvent.click(mic);
	expect(played).toEqual(["mute", "unmute"]);
	await userEvent.click(mic);
	await userEvent.click(button(prompt, "Join voice"));
	await settle();
	const call = dialog("Voice call");
	expect(call).toBe(prompt);
	expect(call?.hasAttribute("data-fill")).toBe(true);
	expect(voice.current()?.channel.endsWith("/standup")).toBe(true);
	expect(voice.muted()).toBe(true);
	expect(
		button(call as HTMLElement, "Unmute").getAttribute("aria-pressed"),
	).toBe("true");
	const height = (call as HTMLElement).getBoundingClientRect().height;
	expect(Math.abs(height - window.innerHeight)).toBeLessThan(1);
});

it("shows a note instead of the join controls for a voice channel the viewer can't join", async () => {
	const app = await mount("did:plc:nightowlsartclub3e5f7g9h");
	await userEvent.click(row(app.host, "Quiet studio"));
	await settle();
	const prompt = dialog("Join Quiet studio") as HTMLElement;
	expect(prompt).toBeTruthy();
	expect(prompt.querySelector("[data-voice-join-disabled]")?.textContent).toBe(
		"You can't join this voice channel.",
	);
	expect(button(prompt, "Join voice")).toBeUndefined();
	expect(button(prompt, "Join muted")).toBeUndefined();
	expect(button(prompt, "Open chat")).toBeTruthy();
	expect(voice.current()).toBeUndefined();
});

it("collapses the call screen with the close button and reopens it from the channel row", async () => {
	const app = await mount();
	const prompt = await openPrompt(app.host);
	await userEvent.click(button(prompt, "Join voice"));
	await settle();
	await userEvent.click(
		button(dialog("Voice call") as HTMLElement, "Minimize call"),
	);
	await settle();
	expect(dialog("Voice call")).toBeNull();
	expect(voice.current()).toBeTruthy();
	expect(voice.expanded()).toBe(false);
	await userEvent.click(row(app.host, "Standup"));
	await settle();
	expect(dialog("Voice call")).toBeTruthy();
	expect(dialog("Join Standup")).toBeNull();
});

it("collapses the call screen on device back and keeps the call", async () => {
	const app = await mount();
	const prompt = await openPrompt(app.host);
	await userEvent.click(button(prompt, "Join voice"));
	await settle();
	expect(app.offset()).toBe(1);
	history.back();
	await settle();
	expect(dialog("Voice call")).toBeNull();
	expect(voice.current()).toBeTruthy();
	expect(app.offset()).toBe(0);
	expect(location.pathname).toBe(`/app/c/${HQ}`);
});

it("leaves the call with the hang up button", async () => {
	const app = await mount();
	const prompt = await openPrompt(app.host);
	await userEvent.click(button(prompt, "Join voice"));
	await settle();
	await userEvent.click(
		button(dialog("Voice call") as HTMLElement, "Leave call"),
	);
	await settle();
	expect(voice.current()).toBeUndefined();
	expect(dialog("Voice call")).toBeNull();
	expect(app.offset()).toBe(0);
});

it("opens the voice channel chat as a pushed layer", async () => {
	const app = await mount();
	const prompt = await openPrompt(app.host);
	await userEvent.click(button(prompt, "Open chat"));
	await wait(1500);
	expect(dialog("Join Standup")).toBeNull();
	expect(location.pathname).toBe(
		`/app/c/${HQ}/social.colibri.beta.channel.voice/standup`,
	);
	expect(app.offset()).toBe(1);
});
