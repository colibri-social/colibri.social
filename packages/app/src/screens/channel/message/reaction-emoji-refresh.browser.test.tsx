import { render } from "solid-js/web";
import { afterEach, expect, it, vi } from "vitest";
import "../../../app.css";
import type { EmojiCatalogView } from "../../../data/emoji";
import { createMockSource, setLatency } from "../../../data/mock/source";
import type { DataSource } from "../../../data/source";
import { createDataStore, DataContext } from "../../../data/store";
import type { Did, ReactionEmojiRef } from "../../../data/types";
import { Providers } from "../../../providers";
import { MobileShell } from "../../../shell/MobileShell";

const HQ = "did:plc:colibrihqspace2a4b6c8d" as Did;
const DEV_PATH = `/app/c/${HQ}/social.colibri.beta.channel.text/dev`;
const TEXT = "React with an expired emoji";
const EXPIRED = "/expired-emoji.png";

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

let stop: (() => void) | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
	stop?.();
	host?.remove();
	history.replaceState(null, "", "/");
});

const expire = (catalog: EmojiCatalogView): EmojiCatalogView => ({
	...catalog,
	emojis: catalog.emojis.map((emoji) => ({ ...emoji, image: EXPIRED })),
});

type Serve = (
	catalog: EmojiCatalogView,
	count: number,
) => EmojiCatalogView | Promise<never>;

const mount = async (serve: Serve) => {
	setLatency(0);
	history.replaceState(null, "", DEV_PATH);
	const source = createMockSource({ live: false });
	const listEmoji = source.listEmoji.bind(source);
	const served = new Map<string, number>();
	const spy = vi.fn(async (community: Did) => {
		const catalog = await listEmoji(community);
		const count = (served.get(community) ?? 0) + 1;
		served.set(community, count);
		return community === HQ ? serve(catalog, count) : catalog;
	});
	const reference = await listEmoji(HQ);
	const target = reference.emojis[0];
	if (!target) throw new Error("HQ emoji missing");
	const wrapped: DataSource = { ...source, listEmoji: spy };
	const store = createDataStore(wrapped);
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
	const pane = () =>
		host?.querySelector('[data-pane-index="1"]') as HTMLElement | null;
	await until(
		() => (pane()?.querySelectorAll("[data-message]").length ?? 0) > 3,
	);
	const community = store.communities
		.value()
		?.find((entry) => entry.did === HQ);
	const dev = community
		? store.space(community).channelBySlug("dev")
		: undefined;
	if (!dev) throw new Error("dev missing");
	const channel = store.channel(dev.space);
	await channel.send({ text: TEXT });
	const article = () =>
		Array.from(pane()?.querySelectorAll<HTMLElement>("article") ?? []).find(
			(entry) => entry.textContent?.includes(TEXT),
		);
	await until(() => !!article());
	const rkey = channel
		.messages()
		.find((message) => message.text === TEXT && message.rkey)?.rkey;
	if (!rkey) throw new Error("sent message missing");
	const shortcode = `:${target.name}:`;
	const ref = { uri: target.ref.uri, cid: target.ref.cid } as ReactionEmojiRef;
	await channel.react(rkey, shortcode, true, ref);
	const chip = () =>
		article()?.querySelector<HTMLElement>(`[data-reaction="${shortcode}"]`);
	const glyph = () =>
		chip()?.querySelector<HTMLElement>("[data-custom-emoji-image]");
	await until(() => !!glyph());
	return { served, target, shortcode, chip, glyph };
};

it("shows a placeholder for a broken reaction emoji and swaps in a refetched link", async () => {
	const { served, target, shortcode, chip, glyph } = await mount(
		(catalog, count) => (count === 1 ? expire(catalog) : catalog),
	);
	expect(chip()?.textContent).not.toContain(shortcode);
	expect(chip()?.getAttribute("aria-label")).toContain(target.name);

	await until(() => (served.get(HQ) ?? 0) >= 2);
	await until(
		() =>
			!!glyph()?.querySelector("img") &&
			glyph()?.querySelector("img")?.getAttribute("src") !== EXPIRED,
	);
	await until(() => !glyph()?.hasAttribute("data-custom-emoji-pending"));
	expect(chip()?.textContent).not.toContain(shortcode);
	await new Promise((resolve) => setTimeout(resolve, 300));
	expect(served.get(HQ)).toBe(2);
});

it("switches to a static placeholder once the refetch drops the emoji", async () => {
	const { served, shortcode, chip, glyph } = await mount((catalog, count) =>
		count === 1
			? expire(catalog)
			: { ...catalog, emojis: catalog.emojis.slice(1) },
	);
	await until(() => !!glyph()?.hasAttribute("data-custom-emoji-unavailable"));
	expect(glyph()?.hasAttribute("data-skeleton")).toBe(false);
	expect(chip()?.textContent).not.toContain(shortcode);
	await new Promise((resolve) => setTimeout(resolve, 300));
	expect(served.get(HQ)).toBe(2);
});

it("retries a failed emoji catalog once and shows the emoji", async () => {
	const { served, glyph } = await mount((catalog, count) =>
		count === 1 ? Promise.reject(new TypeError("Failed to fetch")) : catalog,
	);
	await until(() => (served.get(HQ) ?? 0) >= 2);
	await until(() => !!glyph()?.querySelector("img"));
	await until(() => !glyph()?.hasAttribute("data-custom-emoji-pending"));
	await new Promise((resolve) => setTimeout(resolve, 300));
	expect(served.get(HQ)).toBe(2);
});

it("falls back to a static placeholder when the catalog retry fails", async () => {
	const { served, shortcode, chip, glyph } = await mount(() =>
		Promise.reject(new TypeError("Failed to fetch")),
	);
	await until(() => !!glyph()?.hasAttribute("data-custom-emoji-unavailable"));
	expect(chip()?.textContent).not.toContain(shortcode);
	await new Promise((resolve) => setTimeout(resolve, 300));
	expect(served.get(HQ)).toBe(2);
});

it("uses the same placeholder in the reactors sheet", async () => {
	const { shortcode, chip, glyph } = await mount((catalog, count) =>
		count === 1
			? expire(catalog)
			: { ...catalog, emojis: catalog.emojis.slice(1) },
	);
	await until(() => !!glyph()?.hasAttribute("data-custom-emoji-unavailable"));
	const target = chip() as HTMLElement;
	const box = target.getBoundingClientRect();
	const init = {
		bubbles: true,
		pointerType: "touch",
		pointerId: 703,
		isPrimary: true,
		button: 0,
		clientX: box.left + box.width / 2,
		clientY: box.top + box.height / 2,
	};
	target.dispatchEvent(new PointerEvent("pointerdown", init));
	await new Promise((resolve) => setTimeout(resolve, 500));
	target.dispatchEvent(new PointerEvent("pointerup", init));
	const sheet = () =>
		Array.from(document.querySelectorAll<HTMLElement>("[role='dialog']")).find(
			(dialog) => dialog.querySelector("[role='tablist']"),
		);
	await until(() => !!sheet());
	const tabs = sheet()?.querySelector<HTMLElement>("[role='tablist']");
	const sheetGlyph = tabs?.querySelector<HTMLElement>(
		"[data-custom-emoji-image]",
	);
	expect(sheetGlyph?.hasAttribute("data-custom-emoji-unavailable")).toBe(true);
	expect(tabs?.textContent).not.toContain(shortcode);
});
