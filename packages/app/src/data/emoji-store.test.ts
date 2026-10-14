import { describe, expect, it } from "vitest";
import type { EmojiCatalogView, EmojiView } from "./emoji";
import {
	FOLLOWED_EMOJI_LABEL,
	followedPickerPacks,
	pickerPacks,
} from "./emoji-store";
import type { Datetime, Did } from "./types";

const SPACE = "did:plc:space" as Did;
const VIEWER = "did:plc:viewer" as Did;

const emoji = (owner: Did, name: string, copyOf?: string): EmojiView => {
	const id = `at://${owner}/blue.moji.collection.item/${name}`;
	return {
		id,
		ref: { provider: "blue.moji", uri: id, owner },
		name,
		images: [{ src: `${name}.png`, format: "png", animated: false }],
		image: `${name}.png`,
		copyOf,
		createdAt: "2026-10-12T10:00:00.000Z" as Datetime,
	};
};

describe("picker packs", () => {
	const shipit = emoji(SPACE, "shipit");
	const space: EmojiCatalogView = {
		community: SPACE,
		emojis: [shipit],
		packs: [],
	};
	const followed: EmojiCatalogView = {
		community: VIEWER,
		emojis: [emoji(VIEWER, "shipit", shipit.id), emoji(VIEWER, "owl", "x")],
		packs: [],
	};

	it("adds followed emoji that the Space doesn't already offer", () => {
		expect(pickerPacks(space, "Colibri HQ")[0]?.name).toBe("Colibri HQ");
		const mine = followedPickerPacks(space, followed, FOLLOWED_EMOJI_LABEL);
		expect(mine).toHaveLength(1);
		expect(mine[0]?.name).toBe(FOLLOWED_EMOJI_LABEL);
		expect(mine[0]?.id.startsWith("followed:")).toBe(true);
		expect(mine[0]?.emojis.map((entry) => entry.name)).toEqual(["owl"]);
	});

	it("offers nothing when the viewer follows nothing new", () => {
		expect(
			followedPickerPacks(
				space,
				{ ...followed, emojis: [followed.emojis[0] as EmojiView] },
				FOLLOWED_EMOJI_LABEL,
			),
		).toEqual([]);
		expect(followedPickerPacks(space, undefined, FOLLOWED_EMOJI_LABEL)).toEqual(
			[],
		);
	});
});
