import type { JsonBlobRef } from "@atproto/lexicon";

/**
 * Resolves a blob to it's URL given a DID.
 * @param did The DID of the owner
 * @param blob The blob to get the URL for
 * @returns The URL to the file
 */
export const resolveBlob = (did: string, blob: JsonBlobRef): string => {
	let cid = "cid" in blob ? blob.cid : blob.ref.$link;

	return `https://colibri.social/xrpc/com.atproto.sync.getBlob?did=${did}&cid=${cid}`;
};
