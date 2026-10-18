import "../../../app.css";
import { render } from "solid-js/web";
import { afterEach, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { createMockSource, setLatency } from "../../../data/mock/source";
import { readLinkPreviewsDraft } from "../../../data/persist-drafts";
import type { SendMessageInput } from "../../../data/source";
import { createDataStore, DataContext } from "../../../data/store";
import { Providers } from "../../../providers";
import { MobileShell } from "../../../shell/MobileShell";

const HQ = "did:plc:colibrihqspace2a4b6c8d";
const TEXT = "social.colibri.beta.channel.text";
const GENERAL = `/app/c/${HQ}/${TEXT}/general`;

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

let stop: (() => void) | undefined;
let host: HTMLDivElement | undefined;
const originalPath = location.pathname + location.search;

afterEach(() => {
	stop?.();
	host?.remove();
	history.replaceState(null, "", originalPath);
	setLatency(80, 260);
});

const mountChat = async (showPreviews: boolean) => {
	setLatency(0);
	history.replaceState(null, "", GENERAL);
	const source = createMockSource({ live: false });
	const sent: SendMessageInput[] = [];
	const sendMessage = source.sendMessage;
	source.sendMessage = (input) => {
		sent.push(input);
		return sendMessage(input);
	};
	const store = createDataStore(source);
	await store.preferences.setClient({ linkEmbedsByDefault: showPreviews });
	host = document.createElement("div");
	host.style.cssText = "position:fixed;inset:0;width:402px;height:874px";
	document.body.append(host);
	stop = render(
		() => (
			<DataContext.Provider value={store}>
				<Providers>
					<MobileShell />
				</Providers>
			</DataContext.Provider>
		),
		host,
	);
	const chat = () =>
		host?.querySelector<HTMLElement>('[data-pane-index="1"]') ?? undefined;
	await until(() => !!chat()?.querySelector<HTMLElement>('[role="textbox"]'));
	await new Promise((resolve) => setTimeout(resolve, 400));
	const button = (label: string) =>
		Array.from(chat()?.querySelectorAll<HTMLElement>("button") ?? []).find(
			(element) => element.getAttribute("aria-label") === label,
		);
	const type = async (text: string) => {
		const editor = chat()?.querySelector<HTMLElement>(
			'[role="textbox"]',
		) as HTMLElement;
		editor.focus();
		await userEvent.keyboard(text);
	};
	const send = async () => {
		const count = sent.length;
		const sendButton = button("Send message");
		if (!sendButton) throw new Error("no send button");
		sendButton.click();
		await until(() => sent.length > count);
		return sent[count] as SendMessageInput;
	};
	return { button, type, send };
};

const sendWithPreviewDefault = async (showPreviews: boolean) => {
	const chat = await mountChat(showPreviews);
	await chat.type("Read https://example.com/field-notes today");
	return chat.send();
};

it("hides link previews on new messages when the viewer turned them off", async () => {
	const input = await sendWithPreviewDefault(false);
	expect(input.text).toContain("https://example.com/field-notes");
	expect(input.suppressedEmbeds).toEqual(["https://example.com/field-notes"]);
});

it("keeps link previews on new messages by default", async () => {
	const input = await sendWithPreviewDefault(true);
	expect(input.suppressedEmbeds).toBeUndefined();
});

it("hides link previews for one message when the composer toggle is off", async () => {
	const chat = await mountChat(true);
	await chat.type("Read https://example.com/field-notes today");
	await until(() => !!chat.button("Hide link previews"));
	chat.button("Hide link previews")?.click();
	await until(() => !!chat.button("Show link previews"));
	const draftKeys = () =>
		Object.keys(localStorage).filter((key) =>
			key.startsWith("colibri:link-previews:"),
		);
	const generalDraft = () => {
		const [key] = draftKeys();
		return key
			? readLinkPreviewsDraft(key.slice("colibri:link-previews:".length))
			: undefined;
	};
	expect(draftKeys()).toHaveLength(1);
	expect(generalDraft()).toBe(false);
	const first = await chat.send();
	expect(first.suppressedEmbeds).toEqual(["https://example.com/field-notes"]);
	expect(generalDraft()).toBeUndefined();
	await chat.type("Again https://example.com/second ");
	await until(() => !!chat.button("Hide link previews"));
	const second = await chat.send();
	expect(second.suppressedEmbeds).toBeUndefined();
});

it("shows link previews for one message when the viewer hides them by default", async () => {
	const chat = await mountChat(false);
	await chat.type("Read https://example.com/field-notes today");
	await until(() => !!chat.button("Show link previews"));
	chat.button("Show link previews")?.click();
	await until(() => !!chat.button("Hide link previews"));
	const input = await chat.send();
	expect(input.suppressedEmbeds).toBeUndefined();
});
