import type { JsonBlobRef } from "@atproto/lexicon";
import { getAppViewHost } from "../utils/appview";

/**
 * Resolves a blob to it's URL given a DID.
 * @param did The DID of the owner
 * @param blob The blob to get the URL for
 * @returns The URL to the file
 */
export const resolveBlob = (
	did: string,
	blob?: JsonBlobRef,
): string | undefined => {
	if (!blob) return undefined;

	const appView = getAppViewHost("http");
	const cid = "cid" in blob ? blob.cid : blob.ref.$link;

	return `${appView}/xrpc/com.atproto.sync.getBlob?did=${did}&cid=${cid}`;
};

/**
 * Builds the AppView-proxied URL for a remote embed preview image. The image is
 * streamed through the AppView (`social.colibri.embed.getImage`) so the client's
 * IP is never exposed to the remote image host. Unauthenticated, like
 * {@link resolveBlob}, since it's loaded directly via an `<img src>`.
 * @param url The absolute remote image URL (as returned by `embed.getMetadata`).
 * @returns The proxied URL to use as an image source.
 */
export const resolveEmbedImage = (url: string): string => {
	const appView = getAppViewHost("http");

	return `${appView}/xrpc/social.colibri.embed.getImage?url=${encodeURIComponent(url)}`;
};
