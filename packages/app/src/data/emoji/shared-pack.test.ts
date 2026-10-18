import { describe, expect, it } from "vitest";
import type { Datetime, Did } from "../types";
import type { EmojiCatalogView, EmojiView } from "./model";
import { packTargetOf, sharedPackIn } from "./shared-pack";

const OWNER = "did:plc:lou" as Did;
const PACK = `at://${OWNER}/blue.moji.packs.pack/3kowls`;

const emoji = (rkey: string): EmojiView => ({
	id: `at://${OWNER}/blue.moji.collection.item/${rkey}`,
	ref: {
		provider: "blue.moji",
		uri: `at://${OWNER}/blue.moji.collection.item/${rkey}`,
		owner: OWNER,
	},
	name: rkey,
	images: [],
	image: `https://cdn.test/${rkey}.png`,
	createdAt: "2026-10-18T00:00:00.000Z" as Datetime,
});

const catalog: EmojiCatalogView = {
	community: OWNER,
	emojis: [emoji("kek"), emoji("owl"), emoji("loose")],
	packs: [
		{
			id: PACK,
			provider: "blue.moji",
			name: "Night owls",
			emojis: [emoji("owl").id, emoji("gone").id, emoji("kek").id],
			createdAt: "2026-10-18T00:00:00.000Z" as Datetime,
		},
	],
};

describe("shared packs", () => {
	it("splits a pack id into owner and rkey", () => {
		expect(packTargetOf(PACK)).toEqual({ did: OWNER, rkey: "3kowls" });
	});

	it("finds the pack and its emoji in pack order, skipping missing ones", () => {
		const shared = sharedPackIn(catalog, { did: OWNER, rkey: "3kowls" });
		expect(shared?.pack.name).toBe("Night owls");
		expect(shared?.emojis.map((entry) => entry.name)).toEqual(["owl", "kek"]);
	});

	it("returns nothing for an unknown rkey, another owner or no catalog", () => {
		expect(sharedPackIn(catalog, { did: OWNER, rkey: "nope" })).toBeUndefined();
		expect(
			sharedPackIn(catalog, { did: "did:plc:other" as Did, rkey: "3kowls" }),
		).toBeUndefined();
		expect(
			sharedPackIn(undefined, { did: OWNER, rkey: "3kowls" }),
		).toBeUndefined();
	});
});
