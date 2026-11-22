import { render } from "solid-js/web";
import { afterEach, describe, expect, it } from "vitest";
import "../../app.css";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext } from "../../data/store";
import type { ReactionEmojiRef } from "../../data/types";
import { Providers } from "../../providers";
import { MobileShell } from "../../shell/MobileShell";
import { statusInputFrom } from "./status-editor";

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

let stop: (() => void) | undefined;

afterEach(async () => {
	stop?.();
	stop = undefined;
	document.body.innerHTML = "";
	await new Promise((resolve) => setTimeout(resolve, 50));
});

const mount = async () => {
	setLatency(0);
	window.history.replaceState(null, "", "/app/profile");
	const store = createDataStore(createMockSource({ live: false }));
	const host = document.createElement("div");
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
	return store;
};

const bubble = () =>
	document.querySelector<HTMLElement>("[data-status-bubble]");

describe("emoji statuses", () => {
	it("shows an emoji-only status on the own profile", async () => {
		const store = await mount();
		await store.setStatus({ text: "", emoji: "🍜", removeCustomEmoji: true });
		await until(() => !!bubble()?.querySelector('[data-emoji="unicode"]'));
		expect(bubble()?.textContent).toContain("🍜");
	});

	it("shows a custom emoji status on the own profile", async () => {
		const store = await mount();
		await until(() => (store.communities.value()?.length ?? 0) > 0);
		const community = store.communities.value()?.[0]?.did;
		if (!community) throw new Error("no community");
		await until(
			() => (store.emoji.catalog(community).value()?.emojis.length ?? 0) > 0,
		);
		const emoji = store.emoji.catalog(community).value()?.emojis[0];
		if (!emoji) throw new Error("no emoji");
		await store.setStatus({
			text: "",
			emoji: "",
			customEmoji: { uri: emoji.id } as ReactionEmojiRef,
		});
		await until(() => !!bubble()?.querySelector('[data-emoji="custom"]'));
		expect(
			bubble()?.querySelector('[data-emoji="custom"]')?.getAttribute("alt"),
		).toBe(`:${emoji.name}:`);
	});
});

describe("statusInputFrom", () => {
	const URI = "at://did:plc:lis/blue.moji.collection.item/party";

	it("sends a custom emoji and clears the Unicode one", () => {
		const input = statusInputFrom(
			{
				text: "",
				customEmoji: { id: URI, name: "party_bird", src: "" },
				clearAfter: "never",
			},
			{ keepExpiry: false },
		);
		expect(input).toMatchObject({
			text: "",
			emoji: "",
			customEmoji: { uri: URI },
		});
		expect(input.removeCustomEmoji).toBeUndefined();
	});

	it("removes the custom emoji for a Unicode pick", () => {
		const input = statusInputFrom(
			{ text: "Lunch", emoji: "🍜", clearAfter: "never" },
			{ keepExpiry: false },
		);
		expect(input).toMatchObject({ emoji: "🍜", removeCustomEmoji: true });
		expect(input.customEmoji).toBeUndefined();
	});
});
