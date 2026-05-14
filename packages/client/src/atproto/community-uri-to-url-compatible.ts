import { AT_URI } from "lib";

/**
 * Converts a community's AT URI to a url-safe representation.
 * @param uri The URI of the community.
 * @returns A URL-safe version that can be used to reconstruct the URI.
 */
export const communityUriToUrlCompatible = (
	uri: AT_URI<"social.colibri.community">,
) => {
	const split = uri.split("/");

	return `${split[2]}-${split[4]}`;
};
