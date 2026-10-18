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

describe("composer media sheet", () => {
	it("inserts emoji and sends GIFs", async () => {
		const onInsertEmoji = vi.fn();
		const onSendGif = vi.fn();
		let media: ReturnType<typeof createComposerMedia> | undefined;
		mount(() => {
			media = createComposerMedia({
				gifs: fakeGifs(),
				onInsertEmoji,
				onSendGif,
			});
			return <media.Sheet />;
		});
		media?.openEmoji();
		const sheet = await until(() => dialogNamed("Emoji and GIF picker"));
		await settle();
		await expectNoLayoutIssues(sheet);
		expect(document.activeElement?.getAttribute("aria-label")).toBe(
			"Search emoji",
		);
		const fire = await findEmoji(sheet, "fire");
		fire.click();
		expect(onInsertEmoji).not.toHaveBeenCalled();
		await until(() => !dialogNamed("Emoji and GIF picker"));
		await until(() => onInsertEmoji.mock.calls.length > 0);
		expect(onInsertEmoji).toHaveBeenCalledWith("🔥");

		media?.openGif();
		const gifSheet = await until(() => dialogNamed("Emoji and GIF picker"));
		await settle();
		await expectNoLayoutIssues(gifSheet);
		const search = await until(() =>
			gifSheet.querySelector<HTMLInputElement>(
				'input[aria-label="Search GIFs"]',
			),
		);
		search.value = "party";
		search.dispatchEvent(new InputEvent("input", { bubbles: true }));
		const tile = await until(() => {
			const tiles = [
				...gifSheet.querySelectorAll<HTMLButtonElement>(
					'button[aria-label="Party time"]',
				),
			];
			const cat = gifSheet.querySelector('button[aria-label="Cat typing"]');
			return tiles.length && !cat ? tiles[0] : undefined;
		});
		tile.click();
		expect(onSendGif).toHaveBeenCalledWith(
			expect.objectContaining({ id: "a", title: "Party time" }),
		);
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
});
