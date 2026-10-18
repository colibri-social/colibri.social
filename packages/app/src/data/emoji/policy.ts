import type { CustomEmojiPolicy, Did, Facet } from "../types";
import { repoOfUri } from "./model";
import { isEmojiFeature } from "./references";

export const DEFAULT_EMOJI_POLICY: CustomEmojiPolicy = "all";

export const emojiPolicy = (value: string | undefined): CustomEmojiPolicy =>
	value === "local" || value === "none" ? value : DEFAULT_EMOJI_POLICY;

export const allowsEmojiUri = (
	policy: CustomEmojiPolicy,
	community: Did,
	uri: string,
) => {
	if (policy === "none") return false;
	if (policy === "local") return repoOfUri(uri) === community;
	return true;
};

export const filterEmojiFacets = (
	facets: readonly Facet[],
	allows: (uri: string) => boolean,
): Facet[] =>
	facets.flatMap((facet) => {
		const features = facet.features.filter((feature) => {
			const value = feature as { $type?: string; uri?: unknown };
			if (!isEmojiFeature(value)) return true;
			return typeof value.uri === "string" && allows(value.uri);
		});
		if (features.length === facet.features.length) return [facet];
		return features.length > 0 ? [{ ...facet, features }] : [];
	});
