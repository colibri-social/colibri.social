import "../../app.css";
import { render } from "solid-js/web";
import { afterEach, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { packTargetOf } from "../../data/emoji/shared-pack";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore, DataContext } from "../../data/store";
import type { Did } from "../../data/types";
import { setVoiceSoundPlayer } from "../../data/voice";
import { Providers } from "../../providers";
import { MobileShell } from "../../shell/MobileShell";

const HQ = "did:plc:colibrihqspace2a4b6c8d" as Did;

let dispose: (() => void) | undefined;

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

const buttonNamed = (name: string) =>
	Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
		(button) => button.textContent?.trim() === name,
	);

const mount = async (path: (rkey: string) => string) => {
	setLatency(0);
	setVoiceSoundPlayer(() => {});
	await page.viewport(402, 874);
	await until(() => !matchMedia("(min-width: 768px)").matches);
	const source = createMockSource({ live: false });
	const pack = (await source.listEmoji(HQ)).packs[0];
	if (!pack) throw new Error("HQ needs an emoji pack");
	history.replaceState(null, "", path(packTargetOf(pack.id).rkey));
	const store = createDataStore(source);
	const host = document.createElement("div");
	host.style.cssText = "position:fixed;inset:0";
	document.body.append(host);
	dispose = render(
		() => (
			<DataContext.Provider value={store}>
				<Providers>
					<MobileShell />
				</Providers>
			</DataContext.Provider>
		),
		host,
	);
	return pack;
};

it("opens a shared pack from its link and follows it", async () => {
	const pack = await mount((rkey) => `/app/emoji/${HQ}/${rkey}`);
	await until(
		() => !!document.querySelector("[data-pack-screen] [data-emoji-pack-card]"),
	);
	const card = document.querySelector("[data-emoji-pack-card]");
	expect(card?.getAttribute("aria-label")).toBe(`Emoji pack ${pack.name}`);
	buttonNamed("Follow pack")?.click();
	await until(() => !!buttonNamed("Unfollow pack"));
});

it("opens the web share path", async () => {
	await mount((rkey) => `/emoji/${HQ}/${rkey}`);
	await until(
		() => !!document.querySelector("[data-pack-screen] [data-emoji-pack-card]"),
	);
});

it("shows the unavailable card for a pack that doesn't exist", async () => {
	await mount(() => `/app/emoji/${HQ}/3kdoesnotexist`);
	await until(
		() =>
			!!document.querySelector(
				'[data-pack-screen] [data-emoji-pack-card-unavailable="missing"]',
			),
	);
});

it("leaves the pack from the header", async () => {
	await mount((rkey) => `/app/emoji/${HQ}/${rkey}`);
	await until(() => !!document.querySelector("[data-pack-screen]"));
	const back = document.querySelector<HTMLButtonElement>(
		'button[aria-label="Back"]',
	);
	if (!back) throw new Error("Missing back button");
	await userEvent.click(back);
	await until(() => !location.pathname.startsWith("/app/emoji/"));
});
