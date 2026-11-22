import { clientOrigin } from "@colibri-social/lib";
import { createSignal, type JSX, Show } from "solid-js";
import { afterEach, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import type { Did } from "../../../data/types";
import { type SettingsNav, SettingsNavContext } from "../nav";
import EmojiPackPage from "./emoji-pack";
import EmojiPacksPage from "./emoji-packs";
import { editingPack, setEditingPack } from "./own-emoji";
import { cleanup, mountPage } from "./page-test-kit";

const HQ = "did:plc:colibrihqspace2a4b6c8d" as Did;

afterEach(() => {
	cleanup();
	setEditingPack(undefined);
});

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout)
			throw new Error("condition never held");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

const mountWithNav = async (view: () => JSX.Element) => {
	const nav: SettingsNav = { open: vi.fn(), back: vi.fn() };
	const mounted = await mountPage(() => (
		<SettingsNavContext.Provider value={nav}>
			{view()}
		</SettingsNavContext.Provider>
	));
	return { ...mounted, nav };
};

type Store = Awaited<ReturnType<typeof mountWithNav>>["store"];

const image = (name: string) =>
	new File([new Uint8Array([137, 80, 78, 71])], `${name}.png`, {
		type: "image/png",
	});

const ownPack = async (store: Store) => {
	const viewer = store.viewer.did;
	const wave = await store.emoji.upload({
		community: viewer,
		name: "wave",
		file: image("wave"),
	});
	const hello = await store.emoji.upload({
		community: viewer,
		name: "hello",
		file: image("hello"),
	});
	return store.emoji.createPack(viewer, "Greetings", [wave.id, hello.id]);
};

const hqPack = async (store: Store) => {
	const hq = store.emoji.catalog(HQ);
	await until(() => (hq.value()?.packs.length ?? 0) > 0);
	const pack = hq.value()?.packs[0];
	if (!pack) throw new Error("the mock Space has no pack");
	return pack;
};

it("explains how to get emoji while the viewer has none", async () => {
	await mountWithNav(() => <EmojiPacksPage platform="mobile" />);
	await expect.element(page.getByText("No emoji yet")).toBeVisible();
	await expect
		.element(page.getByRole("button", { name: "Upload Emoji" }))
		.toBeVisible();
});

it("opens the pack editor to create or edit a pack", async () => {
	const { store, nav } = await mountWithNav(() => (
		<EmojiPacksPage platform="mobile" />
	));
	await userEvent.click(page.getByRole("button", { name: "Create new Pack" }));
	expect(nav.open).toHaveBeenCalledWith("emojiPack");
	expect(editingPack()).toBeUndefined();

	const followed = await ownPack(store);
	await userEvent.click(
		page.getByRole("button", { name: `Edit ${followed.name}` }),
	);
	expect(editingPack()).toBe(followed.id);
});

it("copies a share link for a pack", async () => {
	const writeText = vi
		.spyOn(navigator.clipboard, "writeText")
		.mockResolvedValue(undefined);
	const { store } = await mountWithNav(() => (
		<EmojiPacksPage platform="mobile" />
	));
	const followed = await ownPack(store);
	await userEvent.click(
		page.getByRole("button", { name: `Copy link to ${followed.name}` }),
	);
	const [did, , rkey] = followed.id.slice("at://".length).split("/");
	await until(() => writeText.mock.calls.length > 0);
	expect(writeText).toHaveBeenCalledWith(
		`${clientOrigin()}/emoji/${did}/${rkey}`,
	);
	writeText.mockRestore();
});

it("creates a pack from the viewer's own emoji", async () => {
	const { store, nav } = await mountWithNav(() => (
		<EmojiPackPage platform="mobile" />
	));
	const followed = await ownPack(store);
	const emoji = store.emoji
		.own()
		.value()
		?.emojis.find((entry) => entry.id === followed.emojis[0]);
	if (!emoji) throw new Error("the pack has no emoji");

	await userEvent.fill(page.getByLabelText("Pack Name"), "Favorites");
	await until(
		() =>
			!!document.querySelector(
				`input[type="checkbox"][aria-label="Include :${emoji.name}:"]`,
			),
	);
	document
		.querySelector<HTMLInputElement>(
			`input[type="checkbox"][aria-label="Include :${emoji.name}:"]`,
		)
		?.click();
	await userEvent.click(page.getByRole("button", { name: "Create Pack" }));

	await until(() => vi.mocked(nav.back).mock.calls.length > 0);
	const created = store.emoji
		.own()
		.value()
		?.packs.find((pack) => pack.name === "Favorites");
	expect(created?.emojis).toEqual([emoji.id]);
});

it("deletes a pack and keeps its emoji", async () => {
	const [ready, setReady] = createSignal(false);
	const { store, nav } = await mountWithNav(() => (
		<Show when={ready()}>
			<EmojiPackPage platform="mobile" />
		</Show>
	));
	const followed = await ownPack(store);
	setEditingPack(followed.id);
	setReady(true);

	await userEvent.click(page.getByRole("button", { name: "Delete Pack" }));
	await userEvent.click(
		page.getByRole("dialog").getByRole("button", { name: "Delete pack" }),
	);

	await until(() => vi.mocked(nav.back).mock.calls.length > 0);
	const catalog = store.emoji.own().value();
	expect(catalog?.packs).toEqual([]);
	expect(catalog?.emojis.map((emoji) => emoji.id).sort()).toEqual(
		[...followed.emojis].sort(),
	);
});

it("lists followed packs and removes a follow", async () => {
	const { store } = await mountWithNav(() => (
		<EmojiPacksPage platform="mobile" />
	));
	const pack = await hqPack(store);
	await store.emoji.follow(pack.id);
	await expect.element(page.getByText("Followed packs")).toBeVisible();
	const row = () =>
		document.querySelector<HTMLElement>(`[data-emoji-follow="${pack.id}"]`);
	await until(() => !!row());
	expect(row()?.dataset.followState).toBe("available");
	expect(row()?.textContent).toContain(pack.name);

	await userEvent.click(
		page.getByRole("button", { name: `Remove ${pack.name}` }),
	);
	await until(() => !row());
	expect(store.emoji.followOf(pack.id)).toBeUndefined();
});

it("shows a followed pack its owner deleted", async () => {
	const { store } = await mountWithNav(() => (
		<EmojiPacksPage platform="mobile" />
	));
	const pack = await hqPack(store);
	await store.emoji.follow(pack.id);
	await store.emoji.removePack(HQ, pack.id);
	const row = () =>
		document.querySelector<HTMLElement>(`[data-emoji-follow="${pack.id}"]`);
	await until(() => row()?.dataset.followState === "missing");
	expect(row()?.textContent).toContain("Deleted pack");
	expect(row()?.textContent).toContain("Its owner deleted it.");
});
