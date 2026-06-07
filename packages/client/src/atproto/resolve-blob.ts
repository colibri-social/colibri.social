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
