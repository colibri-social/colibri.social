import { afterEach, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import type { Did } from "../../../data/types";
import EmojiPacksPage from "./emoji-packs";
import { cleanup, mountPage } from "./page-test-kit";

const HQ = "did:plc:colibrihqspace2a4b6c8d" as Did;

afterEach(cleanup);

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout)
			throw new Error("condition never held");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

it("explains how to get emoji while the viewer has none", async () => {
	await mountPage(() => <EmojiPacksPage platform="mobile" />);
	await expect.element(page.getByText("No emoji yet")).toBeVisible();
	await expect
		.element(page.getByRole("button", { name: "Upload Emoji" }))
		.toBeVisible();
});

it("lists a followed pack and removes it with its emoji", async () => {
	const { store } = await mountPage(() => <EmojiPacksPage platform="mobile" />);
	const hq = store.emoji.catalog(HQ);
	await until(() => (hq.value()?.packs.length ?? 0) > 0);
	const pack = hq.value()?.packs[0];
	if (!pack) throw new Error("the mock Space has no pack");

	await store.emoji.followPack(HQ, pack.id);

	const remove = page.getByRole("button", { name: `Remove ${pack.name}` });
	await expect.element(remove).toBeVisible();
	await userEvent.click(remove);
	await userEvent.click(page.getByRole("button", { name: "Remove pack" }));

	await expect.element(page.getByText("No emoji yet")).toBeVisible();
	expect(store.emoji.followed().value()?.emojis).toEqual([]);
});
