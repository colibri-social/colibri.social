import type { BlobRef } from "./types.js";

export const extractBlobCid = (blob: unknown): string | undefined => {
	if (!blob || typeof blob !== "object") return undefined;
	const ref = (blob as { ref?: unknown }).ref;

	if (ref && typeof ref === "object") {
		const link = (ref as { $link?: unknown }).$link;
		if (typeof link === "string") return link;

		const asString = (ref as { toString(): string }).toString();
		if (asString && asString !== "[object Object]") return asString;
	}

	const cid = (blob as { cid?: unknown }).cid;
	if (typeof cid === "string") return cid;

	return undefined;
};

export interface BlobUrlOptions {
	did: string;
	pds: string;
}

export const blobUrl = (
	blob: BlobRef | undefined,
	options: BlobUrlOptions,
): string | undefined => {
	const cid = extractBlobCid(blob);
	if (!cid) return undefined;
	return `${options.pds}/xrpc/com.atproto.sync.getBlob?did=${options.did}&cid=${cid}`;
};

export type ResolveBlob = (blob?: BlobRef) => string | undefined;
