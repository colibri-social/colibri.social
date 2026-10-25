import { describe, expect, it } from "vitest";
import { skeyOf } from "./ids";
import { createMockSource, setLatency } from "./mock/source";
import type { DataSource } from "./source";
import { createDataStore } from "./store";

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

const setup = async (
	wrap: (base: DataSource) => DataSource = (base) => base,
) => {
	setLatency(0);
	const base = createMockSource({ live: false });
	const store = createDataStore(wrap(base));
	await until(() => !!store.communities.value());
	const hq = store.communities
		.value()
		?.find((entry) => entry.handle.startsWith("hq.")) as NonNullable<
		ReturnType<typeof store.communities.value>
	>[number];
	const space = store.space(hq);
	await until(() => !!space.channels.value() && !!space.categories.value());
	const category = space.categories
		.value()
		?.find((entry) => entry.channels.length >= 2);
	if (!category) throw new Error("no category with two channels");
	const keysIn = (rkey: string) =>
		(space.categories.value() ?? [])
			.find((entry) => entry.rkey === rkey)
			?.channels.map((entry) => skeyOf(entry.space)) ?? [];
	const categoryKeys = () =>
		(space.categories.value() ?? []).map((entry) => entry.rkey);
	return { store, hq, space, base, category, keysIn, categoryKeys };
};

describe("channel reorder", () => {
	it("saves a new channel order inside a category", async () => {
		const { store, hq, category, keysIn, base } = await setup();
		const reversed = keysIn(category.rkey).reverse();
		await store.channels.reorder(hq.did, category.rkey, reversed);
		expect(keysIn(category.rkey)).toEqual(reversed);
		const saved = (await base.listCategories(hq.did)).find(
			(entry) => entry.rkey === category.rkey,
		);
		expect(saved?.channels.map((entry) => skeyOf(entry.space))).toEqual(
			reversed,
		);
	});

	it("saves a new category order", async () => {
		const { store, hq, categoryKeys, base } = await setup();
		const reversed = categoryKeys().reverse();
		await store.categories.reorder(hq.did, reversed);
		expect(categoryKeys()).toEqual(reversed);
		const saved = await base.listCategories(hq.did);
		expect(saved.map((entry) => entry.rkey)).toEqual(reversed);
	});

	it("rejects a channel list that doesn't match the category", async () => {
		const { store, hq, category, keysIn } = await setup();
		const before = keysIn(category.rkey);
		await expect(
			store.channels.reorder(hq.did, category.rkey, before.slice(1)),
		).rejects.toThrow();
		expect(keysIn(category.rkey)).toEqual(before);
	});

	it("puts the old order back when saving fails", async () => {
		let release: (() => void) | undefined;
		const { store, hq, category, keysIn, categoryKeys } = await setup(
			(base) => ({
				...base,
				reorderChannels: () =>
					new Promise<void>((_, reject) => {
						release = () => reject(new Error("offline"));
					}),
				reorderCategories: async () => {
					throw new Error("offline");
				},
			}),
		);
		const before = keysIn(category.rkey);
		const reversed = [...before].reverse();
		const saving = store.channels.reorder(hq.did, category.rkey, reversed);
		expect(keysIn(category.rkey)).toEqual(reversed);
		release?.();
		await expect(saving).rejects.toThrow("offline");
		expect(keysIn(category.rkey)).toEqual(before);

		const categoriesBefore = categoryKeys();
		await expect(
			store.categories.reorder(hq.did, [...categoriesBefore].reverse()),
		).rejects.toThrow("offline");
		expect(categoryKeys()).toEqual(categoriesBefore);
	});
});
