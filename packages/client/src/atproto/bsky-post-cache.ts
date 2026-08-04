import type { AppBskyFeedDefs } from "@atproto/api";
import { createLogger } from "../utils/logger";
import {
	cacheEnabled,
	readBskyHandle,
	readBskyPost,
	writeBskyHandle,
	writeBskyPost,
} from "./cache/store";
import { getPosts } from "./xrpc/app/bsky/feed/getPosts";

const log = createLogger("bsky");

const PUBLIC_APPVIEW = "https://public.api.bsky.app";
const NEGATIVE_TTL_MS = 30_000;
const MAX_BATCH_SIZE = 25;
const POST_TTL_MS = 15 * 60 * 1000;
const HANDLE_TTL_MS = 24 * 60 * 60 * 1000;

const resolvedHandles = new Map<string, string>();
const negativeHandleUntil = new Map<string, number>();
const inflightHandles = new Map<string, Promise<string | undefined>>();

/**
 * Resolves a handle to a DID via a direct, unauthenticated call to the public
 * Bluesky AppView
 */
export const resolveHandleDeduped = (
	handle: string,
): Promise<string | undefined> => {
	const hit = resolvedHandles.get(handle);
	if (hit !== undefined) return Promise.resolve(hit);

	const until = negativeHandleUntil.get(handle);
	if (until !== undefined) {
		if (until > Date.now()) return Promise.resolve(undefined);
		negativeHandleUntil.delete(handle);
	}

	const existing = inflightHandles.get(handle);
	if (existing) return existing;

	const promise = (async () => {
		if (cacheEnabled()) {
			const cached = await readBskyHandle(handle);
			if (cached && Date.now() - cached.ts < HANDLE_TTL_MS) {
				resolvedHandles.set(handle, cached.did);
				return cached.did;
			}
		}

		try {
			const res = await fetch(
				`${PUBLIC_APPVIEW}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`,
			);
			if (!res.ok) throw new Error(`resolveHandle failed: ${res.status}`);
			const body = (await res.json()) as { did: string };
			resolvedHandles.set(handle, body.did);
			void writeBskyHandle(handle, { did: body.did, ts: Date.now() });
			return body.did;
		} catch (err) {
			log.warn("resolving a Bluesky handle failed", { handle, error: err });
			negativeHandleUntil.set(handle, Date.now() + NEGATIVE_TTL_MS);
			return undefined;
		}
	})().finally(() => {
		inflightHandles.delete(handle);
	});

	inflightHandles.set(handle, promise);
	return promise;
};

const resolvedPosts = new Map<string, AppBskyFeedDefs.PostView>();
const negativePostUntil = new Map<string, number>();
const inflightPosts = new Map<
	string,
	Promise<AppBskyFeedDefs.PostView | undefined>
>();

let pendingUris: Array<string> = [];
let pendingResolvers = new Map<
	string,
	Array<(post: AppBskyFeedDefs.PostView | undefined) => void>
>();
let flushScheduled = false;

const flushBatch = async () => {
	const uris = pendingUris;
	const resolvers = pendingResolvers;
	pendingUris = [];
	pendingResolvers = new Map();
	flushScheduled = false;

	const settle = (uri: string, post: AppBskyFeedDefs.PostView | undefined) => {
		if (post) {
			resolvedPosts.set(uri, post);
			void writeBskyPost(uri, { post, ts: Date.now() });
		} else {
			negativePostUntil.set(uri, Date.now() + NEGATIVE_TTL_MS);
		}
		for (const resolve of resolvers.get(uri) ?? []) resolve(post);
	};

	for (let i = 0; i < uris.length; i += MAX_BATCH_SIZE) {
		const batch = uris.slice(i, i + MAX_BATCH_SIZE);
		try {
			const posts = await getPosts(batch);
			const byUri = new Map(posts.map((p) => [p.uri, p]));
			for (const uri of batch) settle(uri, byUri.get(uri));
		} catch (err) {
			log.warn("fetching a batch of Bluesky posts failed", {
				size: batch.length,
				error: err,
			});
			for (const uri of batch) settle(uri, undefined);
		}
	}
};

export const peekPost = (
	authority: string,
	rkey: string,
): AppBskyFeedDefs.PostView | undefined => {
	const did = authority.startsWith("did:")
		? authority
		: resolvedHandles.get(authority);
	if (!did) return undefined;
	return resolvedPosts.get(`at://${did}/app.bsky.feed.post/${rkey}`);
};

export const fetchPostByRef = async (
	authority: string,
	rkey: string,
): Promise<AppBskyFeedDefs.PostView | undefined> => {
	let did = authority;
	if (!did.startsWith("did:")) {
		const resolved = await resolveHandleDeduped(authority);
		if (!resolved) return undefined;
		did = resolved;
	}
	return getPostDeduped(`at://${did}/app.bsky.feed.post/${rkey}`);
};

export const warmPosts = async (
	refs: Array<{ authority: string; rkey: string }>,
): Promise<void> => {
	const pending = refs
		.filter((ref) => peekPost(ref.authority, ref.rkey) === undefined)
		.map((ref) => fetchPostByRef(ref.authority, ref.rkey));

	if (pending.length === 0) return;
	await Promise.allSettled(pending);
};

/**
 * Fetches a single post by AT URI, but combines every call made within the
 * same microtask tick into one batched `getPosts` request (up to the API's
 * 25-URI cap) instead of firing one HTTP request per embed
 */
export const getPostDeduped = (
	atUri: string,
): Promise<AppBskyFeedDefs.PostView | undefined> => {
	const hit = resolvedPosts.get(atUri);
	if (hit !== undefined) return Promise.resolve(hit);

	const until = negativePostUntil.get(atUri);
	if (until !== undefined) {
		if (until > Date.now()) return Promise.resolve(undefined);
		negativePostUntil.delete(atUri);
	}

	const existing = inflightPosts.get(atUri);
	if (existing) return existing;

	const promise = (async () => {
		if (cacheEnabled()) {
			const cached = await readBskyPost(atUri);
			if (cached && Date.now() - cached.ts < POST_TTL_MS) {
				resolvedPosts.set(atUri, cached.post);
				return cached.post;
			}
		}

		return new Promise<AppBskyFeedDefs.PostView | undefined>((resolve) => {
			const resolvers = pendingResolvers.get(atUri);
			if (resolvers) {
				resolvers.push(resolve);
			} else {
				pendingUris.push(atUri);
				pendingResolvers.set(atUri, [resolve]);
			}

			if (!flushScheduled) {
				flushScheduled = true;
				queueMicrotask(flushBatch);
			}
		});
	})().finally(() => {
		inflightPosts.delete(atUri);
	});

	inflightPosts.set(atUri, promise);
	return promise;
};
