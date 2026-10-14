import { beforeEach, describe, expect, it } from "vitest";
import {
	EMOJI_PERMISSION,
	EmojiError,
	followedCopy,
	followedPack,
	packEmoji,
	ungroupedEmoji,
} from "../emoji";
import type { LiveEvent } from "../source";
import type { Did } from "../types";
import { createMockSource, setLatency } from "./source";

const NOW = Date.UTC(2026, 9, 10, 12, 0, 0);
const HQ = "did:plc:colibrihqspace2a4b6c8d" as Did;

beforeEach(() => setLatency(0));

const image = (name = "parrot.png") =>
	new File([new Uint8Array([137, 80, 78, 71])], name, { type: "image/png" });

const setup = () => {
	const mock = createMockSource({ now: NOW, live: false });
	const events: LiveEvent[] = [];
	const stop = mock.subscribe((event) => events.push(event));
	return { mock, events, stop };
};

describe("mock emoji", () => {
	it("seeds Space emoji with a pack and an ungrouped pool", async () => {
		const { mock, stop } = setup();
		const catalog = await mock.listEmoji(HQ);
		expect(catalog.emojis.map((emoji) => emoji.name)).toContain("colibri");
		const release = catalog.packs.find((pack) => pack.name === "Release day");
		if (!release) throw new Error("pack missing");
		expect(packEmoji(catalog, release).map((emoji) => emoji.name)).toEqual([
			"shipit",
			"lgtm",
			"party_bird",
		]);
		expect(ungroupedEmoji(catalog).map((emoji) => emoji.name)).not.toContain(
			"shipit",
		);
		stop();
	});

	it("uploads, renames and deletes emoji with name checks", async () => {
		const { mock, events, stop } = setup();
		const uploaded = await mock.uploadEmoji({
			community: HQ,
			name: "parrot",
			file: image(),
		});
		expect(uploaded.image.startsWith("blob:")).toBe(true);
		await expect(
			mock.uploadEmoji({ community: HQ, name: "parrot", file: image() }),
		).rejects.toMatchObject({ code: "NameTaken" });
		await expect(
			mock.uploadEmoji({ community: HQ, name: "Not OK", file: image() }),
		).rejects.toBeInstanceOf(EmojiError);
		await expect(
			mock.uploadEmoji({
				community: HQ,
				name: "broken",
				file: image("fail.png"),
			}),
		).rejects.toMatchObject({ code: "UploadFailed" });
		const renamed = await mock.renameEmoji({
			community: HQ,
			emoji: uploaded.id,
			name: "party_parrot",
		});
		expect(renamed.name).toBe("party_parrot");
		const emojiEvents = events.filter((event) => event.$type === "emojiEvent");
		expect(emojiEvents.length).toBe(2);
		const catalog = await mock.listEmoji(HQ);
		const release = catalog.packs.find((pack) => pack.name === "Release day");
		const shipit = catalog.emojis.find((emoji) => emoji.name === "shipit");
		if (!release || !shipit) throw new Error("seed missing");
		await mock.deleteEmoji({ community: HQ, emoji: shipit.id });
		const after = await mock.listEmoji(HQ);
		expect(after.emojis.some((emoji) => emoji.id === shipit.id)).toBe(false);
		expect(
			after.packs.find((pack) => pack.id === release.id)?.emojis,
		).not.toContain(shipit.id);
		stop();
	});

	it("creates, edits and deletes packs", async () => {
		const { mock, stop } = setup();
		const catalog = await mock.listEmoji(HQ);
		const [first, second] = ungroupedEmoji(catalog);
		if (!first || !second) throw new Error("seed missing");
		const pack = await mock.createEmojiPack({
			community: HQ,
			name: "  Mood  ",
			emojis: [first.id, first.id, "missing"],
		});
		expect(pack.name).toBe("Mood");
		expect(pack.emojis).toEqual([first.id]);
		const added = await mock.uploadEmoji({
			community: HQ,
			name: "mood_ring",
			file: image(),
			pack: pack.id,
		});
		const edited = await mock.updateEmojiPack({
			community: HQ,
			pack: pack.id,
			name: "Moods",
			emojis: [second.id, added.id],
		});
		expect(edited).toMatchObject({
			name: "Moods",
			emojis: [second.id, added.id],
		});
		await expect(
			mock.createEmojiPack({ community: HQ, name: " ", emojis: [] }),
		).rejects.toMatchObject({ code: "InvalidName" });
		await mock.deleteEmojiPack({ community: HQ, pack: pack.id });
		const after = await mock.listEmoji(HQ);
		expect(after.packs.some((entry) => entry.id === pack.id)).toBe(false);
		expect(after.emojis.some((emoji) => emoji.id === added.id)).toBe(true);
		stop();
	});

	it("rejects changes from members who can't manage the Space", async () => {
		const { mock, stop } = setup();
		const communities = await mock.listCommunities();
		const locked = communities.find(
			(entry) =>
				!entry.viewer?.isOwner &&
				!entry.viewer?.permissions?.includes(EMOJI_PERMISSION),
		);
		if (!locked) throw new Error("expected a Space without manage rights");
		await expect(
			mock.uploadEmoji({ community: locked.did, name: "nope", file: image() }),
		).rejects.toMatchObject({ code: "Forbidden" });
		stop();
	});
});

describe("mock emoji records", () => {
	it("stores Space emoji as Bluemoji records and keeps packs through a rename", async () => {
		const { mock, stop } = setup();
		const catalog = await mock.listEmoji(HQ);
		const shipit = catalog.emojis.find((emoji) => emoji.name === "shipit");
		if (!shipit) throw new Error("emoji missing");
		expect(shipit.id).toBe(`at://${HQ}/blue.moji.collection.item/shipit`);
		expect(shipit.ref).toMatchObject({ provider: "blue.moji", owner: HQ });
		expect(
			mock.emojiBlobUrl({ did: HQ, cid: shipit.images[0]?.cid ?? "" }),
		).toBe(shipit.image);
		const release = catalog.packs.find((pack) => pack.name === "Release day");
		expect(release?.id).toMatch(/^at:\/\/.+\/blue\.moji\.packs\.pack\//);
		const renamed = await mock.renameEmoji({
			community: HQ,
			emoji: shipit.id,
			name: "launch",
		});
		expect(renamed.id).toBe(`at://${HQ}/blue.moji.collection.item/launch`);
		expect(renamed.image).toBe(shipit.image);
		const after = await mock.listEmoji(HQ);
		const pack = after.packs.find((entry) => entry.id === release?.id);
		if (!pack) throw new Error("pack missing");
		expect(packEmoji(after, pack).map((emoji) => emoji.name)).toEqual([
			"launch",
			"lgtm",
			"party_bird",
		]);
		stop();
	});
});

describe("following emoji", () => {
	it("copies followed emoji and packs into the viewer's Bluemoji collection", async () => {
		const { mock, stop } = setup();
		const viewer = mock.viewer().did as Did;
		const hq = await mock.listEmoji(HQ);
		const shipit = hq.emojis.find((emoji) => emoji.name === "shipit");
		const release = hq.packs.find((pack) => pack.name === "Release day");
		if (!shipit || !release) throw new Error("seed missing");

		const copy = await mock.followEmoji({ emoji: shipit.id });
		expect(copy.id).toBe(`at://${viewer}/blue.moji.collection.item/shipit`);
		expect(copy.copyOf).toBe(shipit.id);
		expect(followedCopy(await mock.listEmoji(viewer), shipit.id)?.id).toBe(
			copy.id,
		);
		expect((await mock.followEmoji({ emoji: shipit.id })).id).toBe(copy.id);

		await mock.followEmojiPack({ community: HQ, pack: release.id });
		const mine = await mock.listEmoji(viewer);
		expect(mine.emojis.map((emoji) => emoji.name).sort()).toEqual([
			"lgtm",
			"party_bird",
			"shipit",
		]);
		const followed = followedPack(mine, release);
		if (!followed) throw new Error("pack not followed");
		expect(packEmoji(mine, followed).map((emoji) => emoji.copyOf)).toEqual(
			release.emojis,
		);

		await mock.unfollowEmojiPack({ community: HQ, pack: release.id });
		const after = await mock.listEmoji(viewer);
		expect(after.emojis).toEqual([]);
		expect(after.packs).toEqual([]);
		stop();
	});
});
