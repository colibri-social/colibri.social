import { colibri } from "./lexicons";
import type { LinkEmbed } from "./views";
import type { ColibriClient } from "./xrpc";

const NEGATIVE_TTL_MS = 30_000;

const resolved = new Map<string, LinkEmbed>();
const negativeUntil = new Map<string, number>();
const inflight = new Map<string, Promise<LinkEmbed | undefined>>();

export const peekMetadata = (uri: string): LinkEmbed | undefined =>
	resolved.get(uri);

export const warmMetadata = async (
	xrpc: ColibriClient,
	uris: Array<string>,
): Promise<void> => {
	const pending = uris
		.filter((uri) => resolved.get(uri) === undefined)
		.map((uri) => getMetadataDeduped(xrpc, uri));

	if (pending.length === 0) return;
	await Promise.allSettled(pending);
};

export const getMetadataDeduped = (
	xrpc: ColibriClient,
	uri: string,
): Promise<LinkEmbed | undefined> => {
	const hit = resolved.get(uri);
	if (hit !== undefined) return Promise.resolve(hit);

	const until = negativeUntil.get(uri);
	if (until !== undefined) {
		if (until > Date.now()) return Promise.resolve(undefined);
		negativeUntil.delete(uri);
	}

	const existing = inflight.get(uri);
	if (existing) return existing;

	const promise = xrpc
		.call(colibri.embed.getMetadata.main, { params: { uri } })
		.then((result) => {
			if (!result.ok || result.data?.embed === undefined) {
				negativeUntil.set(uri, Date.now() + NEGATIVE_TTL_MS);
				return undefined;
			}
			resolved.set(uri, result.data.embed);
			return result.data.embed;
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
