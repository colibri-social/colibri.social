import type { XrpcClient } from "./xrpc";
import type { EmbedMetadata } from "./xrpc/social/colibri/embed/getMetadata";

const NEGATIVE_TTL_MS = 30_000;

const resolved = new Map<string, EmbedMetadata>();
const negativeUntil = new Map<string, number>();
const inflight = new Map<string, Promise<EmbedMetadata | undefined>>();

export const getMetadataDeduped = (
	xrpc: XrpcClient,
	uri: string,
): Promise<EmbedMetadata | undefined> => {
	const hit = resolved.get(uri);
	if (hit !== undefined) return Promise.resolve(hit);

	const until = negativeUntil.get(uri);
	if (until !== undefined) {
		if (until > Date.now()) return Promise.resolve(undefined);
		negativeUntil.delete(uri);
	}

	const existing = inflight.get(uri);
	if (existing) return existing;

	const promise = xrpc.social.colibri.embed
		.getMetadata(uri)
		.then((result) => {
			if (!result.ok || result.data === undefined) {
				negativeUntil.set(uri, Date.now() + NEGATIVE_TTL_MS);
				return undefined;
			}
			resolved.set(uri, result.data);
			return result.data;
		})
		.catch(() => {
			negativeUntil.set(uri, Date.now() + NEGATIVE_TTL_MS);
			return undefined;
		})
		.finally(() => {
			inflight.delete(uri);
		});

	inflight.set(uri, promise);
	return promise;
};
