import type { Did } from "../types";
import {
	type EmojiCatalogView,
	type EmojiPackView,
	type EmojiView,
	repoOfUri,
	rkeyOfUri,
} from "./model";

export type PackTarget = { did: Did; rkey: string };

export type SharedPack = { pack: EmojiPackView; emojis: EmojiView[] };

export const packTargetOf = (id: string): PackTarget => ({
	did: repoOfUri(id),
	rkey: rkeyOfUri(id),
});

export const sharedPackIn = (
	catalog: EmojiCatalogView | undefined,
	target: PackTarget,
): SharedPack | undefined => {
	const pack = catalog?.packs.find(
		(entry) =>
			repoOfUri(entry.id) === target.did && rkeyOfUri(entry.id) === target.rkey,
	);
	if (!catalog || !pack) return undefined;
	const byId = new Map(catalog.emojis.map((emoji) => [emoji.id, emoji]));
	return {
		pack,
		emojis: pack.emojis.flatMap((id) => {
			const emoji = byId.get(id);
			return emoji ? [emoji] : [];
		}),
	};
};
