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

const followHqPack = async (
	store: Awaited<ReturnType<typeof mountWithNav>>["store"],
) => {
	const hq = store.emoji.catalog(HQ);
	await until(() => (hq.value()?.packs.length ?? 0) > 0);
	const pack = hq.value()?.packs[0];
	if (!pack) throw new Error("the mock Space has no pack");
	return store.emoji.followPack(HQ, pack.id);
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

	const followed = await followHqPack(store);
	await userEvent.click(
		page.getByRole("button", { name: `Edit ${followed.name}` }),
	);
	expect(editingPack()).toBe(followed.id);
});

it("creates a pack from the viewer's own emoji", async () => {
	const { store, nav } = await mountWithNav(() => (
		<EmojiPackPage platform="mobile" />
	));
	const followed = await followHqPack(store);
	const emoji = store.emoji
		.followed()
		.value()
		?.emojis.find((entry) => entry.id === followed.emojis[0]);
	if (!emoji) throw new Error("the followed pack has no emoji");

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
		.followed()
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
	const followed = await followHqPack(store);
	setEditingPack(followed.id);
	setReady(true);

	await userEvent.click(page.getByRole("button", { name: "Delete Pack" }));
	await userEvent.click(
		page.getByRole("dialog").getByRole("button", { name: "Delete pack" }),
	);

	await until(() => vi.mocked(nav.back).mock.calls.length > 0);
	const catalog = store.emoji.followed().value();
	expect(catalog?.packs).toEqual([]);
	expect(catalog?.emojis.map((emoji) => emoji.id).sort()).toEqual(
		[...followed.emojis].sort(),
	);
});
