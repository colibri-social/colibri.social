import type { JsonBlobRef } from "@atproto/lexicon";
import { getAppViewHost } from "../utils/appview";

/**
 * A downscaled, square rendition the AppView can derive from an image blob.
 * Matches the `size` prop on {@link Avatar}.
 */
export type BlobVariant = "small" | "base" | "large";

const blobCid = (blob: JsonBlobRef): string =>
	"cid" in blob
		? blob.cid
		: "$link" in blob.ref
			? String(blob.ref.$link)
			: blob.ref.link().toString();

/**
 * Resolves a blob to it's URL given a DID.
 * @param did The DID of the owner
 * @param blob The blob to get the URL for
 * @param variant Optional downscaled rendition to request. Omit for the
 * original bytes, required for anything that isn't a square image (banners,
 * attachments, media that needs Range requests).
 * @returns The URL to the file
 */
export const resolveBlob = (
	did: string,
	blob?: JsonBlobRef,
	variant?: BlobVariant,
): string | undefined => {
	if (!blob) return undefined;

	const appView = getAppViewHost("http");
	const query = variant ? `&variant=${variant}` : "";

	return `${appView}/xrpc/com.atproto.sync.getBlob?did=${did}&cid=${blobCid(blob)}${query}`;
};

export const resolveBlobDownload = (
	did: string,
	blob?: JsonBlobRef,
	filename?: string,
): string | undefined => {
	const url = resolveBlob(did, blob);
	if (!url || !filename) return url;

	return `${url}&filename=${encodeURIComponent(filename)}`;
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

export const resolveEmbedVideo = (url: string): string => {
	const appView = getAppViewHost("http");

	return `${appView}/xrpc/social.colibri.embed.getVideo?url=${encodeURIComponent(url)}`;
};
