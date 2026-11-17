import { render } from "solid-js/web";
import { afterEach, describe, expect, it, vi } from "vitest";
import { expectNoLayoutIssues } from "../../../../../../ui/src/foundations/layout-test";
import "../../../../app.css";
import { createMockSource } from "../../../../data/mock/source";
import { createDataStore, DataContext } from "../../../../data/store";
import type { GifView } from "../../../../data/types";
import { createComposerMedia } from "./composer-media";
import type { GifData } from "./gif-source";
import { createReactionPicker } from "./reaction-picker";

const PIXEL =
	"data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";

const gif = (id: string, title: string): GifView =>
	({
		id,
		url: PIXEL,
		previewUrl: PIXEL,
		width: 200,
		height: 150,
		title,
	}) as GifView;

const CATALOG = [gif("a", "Party time"), gif("b", "Cat typing")];

const fakeGifs = (): GifData => {
	const favorites = new Map<string, GifView>();
	return {
		listGifs: async (query) =>
			query
				? CATALOG.filter((entry) =>
						(entry.title ?? "").toLowerCase().includes(query.toLowerCase()),
					)
				: CATALOG,
		listGifCategories: async () => [
			{ name: "Party", previewUrl: CATALOG[0]?.previewUrl },
		],
		gifFavorites: () => [...favorites.values()],
		setGifFavorite: (entry, favorite) => {
			if (favorite) favorites.set(entry.id, entry);
			else favorites.delete(entry.id);
		},
	};
};

let dispose: (() => void) | undefined;
let host: HTMLDivElement | undefined;
let store: ReturnType<typeof createDataStore> | undefined;

afterEach(() => {
	dispose?.();
	store?.dispose();
	host?.remove();
	for (const node of document.querySelectorAll("[role=dialog]")) node.remove();
});

const mount = (view: () => unknown) => {
	host = document.createElement("div");
	document.body.append(host);
	const data = createDataStore(createMockSource({ live: false }));
	store = data;
	dispose = render(
		() => (
			<DataContext.Provider value={data}>
				{view() as never}
			</DataContext.Provider>
		),
		host,
	);
};

const until = async <T,>(read: () => T | null | undefined, timeout = 3000) => {
	const start = performance.now();
	for (;;) {
		const value = read();
		if (value) return value;
		if (performance.now() - start > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 30));
	}
};

const dialogNamed = (name: string) =>
	document.querySelector<HTMLElement>(`[role="dialog"][aria-label="${name}"]`);

const findEmoji = (sheet: HTMLElement, name: string) => {
	const search = sheet.querySelector<HTMLInputElement>(
		'input[aria-label="Search emoji"]',
	);
	if (search) {
		search.value = name;
		search.dispatchEvent(new InputEvent("input", { bubbles: true }));
	}
	return until(() =>
		sheet.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`),
	);
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 450));

const panel = () =>
	document.querySelector<HTMLElement>(
		'[data-media-picker-panel][aria-label="Emoji and GIF picker"]',
	);

describe("composer media panel", () => {
	it("keeps the panel open across picks and sends GIFs", async () => {
		const onInsertEmoji = vi.fn();
		const onSendGif = vi.fn();
		const focusComposer = vi.fn();
		const blurComposer = vi.fn();
		const releaseGuard = vi.fn();
		const guardBack = vi.fn((_onBack: () => void) => releaseGuard);
		let media: ReturnType<typeof createComposerMedia> | undefined;
		mount(() => {
			media = createComposerMedia({
				gifs: fakeGifs(),
				onInsertEmoji,
				onSendGif,
				focusComposer,
				blurComposer,
				guardBack,
			});
			return <media.Sheet />;
		});
		media?.toggleEmoji();
		media?.toggleEmoji();
		const sheet = await until(panel);
		await settle();
		await expectNoLayoutIssues(sheet);
		expect(media?.panelOpen()).toBe(true);
		expect(blurComposer).toHaveBeenCalledTimes(1);
		expect(guardBack).toHaveBeenCalledTimes(1);
		expect(document.activeElement?.getAttribute("aria-label")).not.toBe(
			"Search emoji",
		);
		const fire = await findEmoji(sheet, "fire");
		fire.click();
		expect(onInsertEmoji).toHaveBeenCalledWith("🔥");
		expect(focusComposer).not.toHaveBeenCalled();
		expect(panel()).toBe(sheet);
		expect(media?.panelOpen()).toBe(true);

		media?.openGif();
		const search = await until(() =>
			sheet.querySelector<HTMLInputElement>('input[aria-label="Search GIFs"]'),
		);
		search.value = "party";
		search.dispatchEvent(new InputEvent("input", { bubbles: true }));
		const tile = await until(() => {
			const tiles = [
				...sheet.querySelectorAll<HTMLButtonElement>(
					'button[aria-label="Party time"]',
				),
			];
			const cat = sheet.querySelector('button[aria-label="Cat typing"]');
			return tiles.length && !cat ? tiles[0] : undefined;
		});
		tile.click();
		expect(onSendGif).toHaveBeenCalledWith(
			expect.objectContaining({ id: "a", title: "Party time" }),
		);
		expect(media?.panelOpen()).toBe(true);

		await new Promise((resolve) => setTimeout(resolve, 400));
		media?.toggleEmoji();
		expect(focusComposer).toHaveBeenCalledTimes(1);
		expect(media?.panelOpen()).toBe(false);
		expect(releaseGuard).toHaveBeenCalledTimes(1);
		await until(() => !panel());
	});

	it("closes on Escape and when another field takes focus", async () => {
		let media: ReturnType<typeof createComposerMedia> | undefined;
		const field = document.createElement("textarea");
		document.body.append(field);
		mount(() => {
			media = createComposerMedia({
				gifs: fakeGifs(),
				onInsertEmoji: vi.fn(),
				onSendGif: vi.fn(),
			});
			return <media.Sheet />;
		});
		media?.openEmoji();
		const sheet = await until(panel);
		sheet.dispatchEvent(
			new KeyboardEvent("keydown", {
				key: "Escape",
				bubbles: true,
				cancelable: true,
			}),
		);
		expect(media?.panelOpen()).toBe(false);
		await until(() => !panel());
		media?.openEmoji();
		await until(panel);
		field.focus();
		expect(media?.panelOpen()).toBe(false);
		await until(() => !panel());
		field.remove();
	});
});

describe("reaction picker", () => {
	it("returns the picked emoji and closes", async () => {
		const onPick = vi.fn();
		let picker: ReturnType<typeof createReactionPicker> | undefined;
		mount(() => {
			picker = createReactionPicker();
			return <picker.Sheet />;
		});
		picker?.open(onPick);
		const sheet = await until(() => dialogNamed("Add a reaction"));
		await settle();
		await expectNoLayoutIssues(sheet);
		const fire = await findEmoji(sheet, "fire");
		fire.click();
		expect(onPick).toHaveBeenCalledWith("🔥");
		await until(() => !dialogNamed("Add a reaction"));
	});

	it("returns the URI of a picked custom emoji", async () => {
		const onPick = vi.fn();
		const uri = "at://did:plc:viewer/blue.moji.collection.item/kek";
		let picker: ReturnType<typeof createReactionPicker> | undefined;
		mount(() => {
			picker = createReactionPicker({
				packs: () => [
					{
						id: "own",
						name: "Your emoji",
						emojis: [{ id: uri, name: "kek", src: PIXEL }],
					},
				],
			});
			return <picker.Sheet />;
		});
		picker?.open(onPick);
		const sheet = await until(() => dialogNamed("Add a reaction"));
		await settle();
		const kek = await until(() =>
			sheet.querySelector<HTMLButtonElement>('button[aria-label=":kek:"]'),
		);
		kek.click();
		expect(onPick).toHaveBeenCalledWith(":kek:", uri);
	});
});
