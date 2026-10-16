import "../../../app.css";
import { render } from "solid-js/web";
import { afterEach, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { createMockSource, setLatency } from "../../../data/mock/source";
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

const sendWithPreviewDefault = async (showPreviews: boolean) => {
	setLatency(0);
	history.replaceState(null, "", GENERAL);
	const source = createMockSource({ live: false });
	const sent: SendMessageInput[] = [];
	const send = source.sendMessage;
	source.sendMessage = (input) => {
		sent.push(input);
		return send(input);
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
	const editor = chat()?.querySelector<HTMLElement>(
		'[role="textbox"]',
	) as HTMLElement;
	editor.focus();
	await userEvent.keyboard("Read https://example.com/field-notes today");
	const button = Array.from(
		chat()?.querySelectorAll<HTMLElement>("button") ?? [],
	).find((element) => element.getAttribute("aria-label") === "Send message");
	if (!button) throw new Error("no send button");
	button.click();
	await until(() => sent.length > 0);
	return sent[0] as SendMessageInput;
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
