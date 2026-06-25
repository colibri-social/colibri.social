import type { JsonBlobRef } from "@atproto/lexicon";
import { type Accessor, createResource } from "solid-js";
import { getAppViewHost } from "../utils/appview";

type DidService = { id: string; type: string; serviceEndpoint: string };
type DidDocument = { service?: DidService[] };

// did -> resolved PDS service endpoint (no trailing slash). Cached for the
// session so each author's DID is only resolved once.
const pdsCache = new Map<string, string>();
const inflight = new Map<string, Promise<string | undefined>>();

const fetchDidDocument = async (
	did: string,
): Promise<DidDocument | undefined> => {
	try {
		const url = did.startsWith("did:web:")
			? `https://${did.slice("did:web:".length)}/.well-known/did.json`
			: `https://plc.directory/${did}`;
		const res = await fetch(url);
		return res.ok ? ((await res.json()) as DidDocument) : undefined;
	} catch {
		return undefined;
	}
};

const pdsFromDoc = (doc: DidDocument): string | undefined =>
	doc.service?.find(
		(s) => s.id === "#atproto_pds" || s.type === "AtprotoPersonalDataServer",
	)?.serviceEndpoint;

/**
 * Resolves a DID to its PDS service endpoint, caching the result for the
 * session. Returns `undefined` if the DID can't be resolved or has no PDS.
 */
export const resolvePdsEndpoint = async (
	did: string,
): Promise<string | undefined> => {
	const cached = pdsCache.get(did);
	if (cached) return cached;

	const existing = inflight.get(did);
	if (existing) return existing;

	const promise = (async () => {
		const doc = await fetchDidDocument(did);
		const endpoint = doc && pdsFromDoc(doc);
		if (!endpoint) return undefined;

		const clean = endpoint.replace(/\/+$/, "");
		pdsCache.set(did, clean);
		return clean;
	})();

	inflight.set(did, promise);
	try {
		return await promise;
	} finally {
		inflight.delete(did);
	}
};

const blobCid = (blob: JsonBlobRef): string =>
	"cid" in blob ? blob.cid : blob.ref.$link;

/**
 * Reactively resolves a blob to a URL served *directly by the owner's PDS*.
 * Unlike the AppView proxy (`resolveBlob`), the PDS honours HTTP range
 * requests, which media needs for seeking and a correct duration. Falls back
 * to the AppView if the PDS can't be resolved. `undefined` until resolved.
 */
export const createBlobUrl = (
	did: Accessor<string>,
	blob: Accessor<JsonBlobRef | undefined>,
): Accessor<string | undefined> => {
	const [url] = createResource(
		() => {
			const b = blob();
			// Single primitive key keeps the resource from refetching on every
			// reactive tick (object sources compare by reference).
			return b ? `${did()}\n${blobCid(b)}` : undefined;
		},
		async (key) => {
			const [did, cid] = key.split("\n");
			const host = (await resolvePdsEndpoint(did)) ?? getAppViewHost("http");
			return `${host}/xrpc/com.atproto.sync.getBlob?did=${did}&cid=${cid}`;
		},
	);

	return url;
};

/**
 * Like {@link createBlobUrl} but resolves a whole list of blobs that share one
 * owner DID (e.g. every image in a message) with a single PDS lookup. Returns
 * `undefined` until resolved, then a URL array aligned with `blobs`.
 */
export const createBlobUrls = (
	did: Accessor<string>,
	blobs: Accessor<JsonBlobRef[]>,
): Accessor<string[] | undefined> => {
	const [urls] = createResource(
		() => {
			const cids = blobs().map(blobCid);
			return cids.length ? `${did()}\n${cids.join(",")}` : undefined;
		},
		async (key) => {
			const [d, cidList] = key.split("\n");
			const host = (await resolvePdsEndpoint(d)) ?? getAppViewHost("http");
			return cidList
				.split(",")
				.map(
					(cid) => `${host}/xrpc/com.atproto.sync.getBlob?did=${d}&cid=${cid}`,
				);
		},
	);

	return urls;
};
