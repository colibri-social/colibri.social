import type { JsonBlobRef } from "@atproto/lexicon";

const blobCid = (blob: JsonBlobRef): string =>
	"cid" in blob
		? blob.cid
		: "$link" in blob.ref
			? String(blob.ref.$link)
			: blob.ref.link().toString();

export const pdsBlobUrl = (
	pdsHost: string | undefined,
	did: string,
	blob?: JsonBlobRef,
): string | undefined => {
	if (!pdsHost || !blob) return undefined;

	const origin = pdsHost.startsWith("http") ? pdsHost : `https://${pdsHost}`;

	return `${origin.replace(/\/+$/, "")}/xrpc/com.atproto.sync.getBlob?did=${did}&cid=${blobCid(blob)}`;
};
