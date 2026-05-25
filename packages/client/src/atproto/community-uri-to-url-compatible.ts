import { AT_URI } from "lib";

/**
 * Converts a community's AT URI to a url-safe representation. Supports both the old
 * and new schema, if there is no "-", the `self`-key is omitted.
 * @param uri The URI of the community.
 * @returns A URL-safe version that can be used to reconstruct the URI.
 */
export const communityUriToUrlCompatible = (
	uri: AT_URI<"social.colibri.community">,
) => {
	const split = uri.split("/");

	if (split[4] === "self") return split[2];

	return `${split[2]}-${split[4]}`;
};

/**
 * Explodes a compact URL segment back to a community's URI.
 * @param segment The segment to explode
 * @returns A community URI
 */
export const urlSegmentToUri = (
	segment: string,
): AT_URI<"social.colibri.community"> => {
	const split = segment.split("-");

	if (split.length === 1)
		return `at://${split[0]}/social.colibri.community/self`;

	return `at://${split[0]}/social.colibri.community/${split[1]}`;
};
