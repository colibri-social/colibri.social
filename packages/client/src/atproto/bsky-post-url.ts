import {
	BSKY_ALTERNATIVES,
	type ResolvedBlueskyClient,
} from "./bluesky-alternatives";

export type BskyPostRef = {
	authority: string;
	rkey: string;
};

export const BSKY_HOSTS = new Set(BSKY_ALTERNATIVES.map((a) => a.base));

let customBskyHost: string | null = null;

export const setCustomBskyHost = (host: string | null) => {
	customBskyHost = host;
};

export const isBskyHost = (host: string): boolean =>
	BSKY_HOSTS.has(host) || host === customBskyHost;

/**
 * Recognizes a Bluesky post permalink on any supported client domain and pulls
 * out the profile authority + record key. Returns `null` for anything else.
 */
export const parseBskyPostUrl = (uri: string): BskyPostRef | null => {
	let url: URL;
	try {
		url = new URL(uri);
	} catch {
		return null;
	}

	if (!isBskyHost(url.hostname)) return null;

	const match = url.pathname.match(/^\/profile\/([^/]+)\/post\/([^/]+)\/?$/);
	if (!match) return null;

	return { authority: decodeURIComponent(match[1]), rkey: match[2] };
};

/**
 * Builds a post permalink pointing at the user's preferred Bluesky client.
 */
export const buildBskyPostUrl = (
	client: ResolvedBlueskyClient,
	authority: string,
	rkey: string,
): string => `https://${client.base}/profile/${authority}/post/${rkey}`;

/**
 * Builds a profile permalink pointing at the user's preferred Bluesky client.
 * `identifier` may be a handle or a DID — every supported client resolves both.
 */
export const buildBskyProfileUrl = (
	client: ResolvedBlueskyClient,
	identifier: string,
): string => `https://${client.base}/profile/${identifier}`;

export const rewriteBskyUrl = (
	uri: string,
	client: ResolvedBlueskyClient,
): string => {
	let url: URL;
	try {
		url = new URL(uri);
	} catch {
		return uri;
	}

	if (!isBskyHost(url.hostname)) return uri;
	if (url.hostname === client.base) return uri;

	url.hostname = client.base;
	return url.toString();
};
