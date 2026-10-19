import "../../../app.css";
import { render } from "solid-js/web";
import { afterEach, expect, it } from "vitest";
import { createMockSource, setLatency } from "../../../data/mock/source";
import {
	createDataStore,
	DataContext,
	type DataStore,
} from "../../../data/store";
import type { Did } from "../../../data/types";
import { Providers } from "../../../providers";
import { createCustomEmojiDrawer } from "./custom-emoji-drawer";

const HQ = "did:plc:colibrihqspace2a4b6c8d" as Did;

let dispose: (() => void) | undefined;
let store: DataStore | undefined;

afterEach(() => {
	dispose?.();
	dispose = undefined;
	store?.dispose();
	store = undefined;
	document.body.replaceChildren();
});

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

it("shows the emoji owner's handle", async () => {
	setLatency(0);
	const data = createDataStore(createMockSource({ live: false }));
	store = data;
	await until(() => !!data.communities.value()?.length);
	const catalog = data.emoji.catalog(HQ);
	await until(() => !!catalog.value()?.emojis.length);
	const emoji = catalog.value()?.emojis[0];
	if (!emoji) throw new Error("no emoji");
	const space = data.communities.value()?.find((entry) => entry.did === HQ);
	let open: ReturnType<typeof createCustomEmojiDrawer>["open"] | undefined;
	const host = document.createElement("div");
	document.body.append(host);
	dispose = render(
		() => (
			<DataContext.Provider value={data}>
				<Providers>
					{(() => {
						const drawer = createCustomEmojiDrawer({
							data,
							community: () => HQ,
						});
						open = drawer.open;
						return <drawer.Overlay />;
					})()}
				</Providers>
			</DataContext.Provider>
		),
		host,
	);
	open?.({ id: emoji.id, name: emoji.name, src: emoji.image });
	await until(() => !!document.querySelector("[data-custom-emoji-handle]"));
	expect(
		document.querySelector("[data-custom-emoji-handle]")?.textContent,
	).toBe(`@${space?.handle}`);
});

it("names your own packed emoji after its pack", async () => {
	setLatency(0);
	const data = createDataStore(createMockSource({ live: false }));
	store = data;
	await until(() => !!data.communities.value()?.length);
	const viewer = data.viewer.did as Did;
	const own = data.emoji.catalog(viewer);
	await until(() => !own.loading());
	const emoji = await data.emoji.upload({
		community: viewer,
		name: "atmo_blob",
		file: new File([new Uint8Array(64)], "blob.png", { type: "image/png" }),
	});
	await data.emoji.createPack(viewer, "Atmologos", [emoji.id]);
	let open: ReturnType<typeof createCustomEmojiDrawer>["open"] | undefined;
	const host = document.createElement("div");
	document.body.append(host);
	dispose = render(
		() => (
			<DataContext.Provider value={data}>
				<Providers>
					{(() => {
						const drawer = createCustomEmojiDrawer({
							data,
							community: () => HQ,
						});
						open = drawer.open;
						return <drawer.Overlay />;
					})()}
				</Providers>
			</DataContext.Provider>
		),
		host,
	);
	open?.({ id: emoji.id, name: emoji.name, src: emoji.image });
	const sourceLine = () =>
		document.querySelector("[data-custom-emoji-source]")?.textContent;
	await until(() => sourceLine() === "Atmologos");
	expect(document.body.textContent).not.toContain("Your emoji");
});
