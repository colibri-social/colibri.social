import {
	type BlueskyClientID,
	BSKY_ALTERNATIVES,
	getBskyAlternativeClientInfo,
} from "./bluesky-alternatives";

export type BskyPostRef = {
	authority: string;
	rkey: string;
};

const BSKY_HOSTS = new Set(BSKY_ALTERNATIVES.map((a) => a.base));

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

	if (!BSKY_HOSTS.has(url.hostname)) return null;

	const match = url.pathname.match(/^\/profile\/([^/]+)\/post\/([^/]+)\/?$/);
	if (!match) return null;

	return { authority: decodeURIComponent(match[1]), rkey: match[2] };
};

/**
 * Builds a post permalink pointing at the user's preferred Bluesky client.
 */
export const buildBskyPostUrl = (
	client: BlueskyClientID,
	authority: string,
	rkey: string,
): string => {
	const info = getBskyAlternativeClientInfo(client);
	return `https://${info.base}/profile/${authority}/post/${rkey}`;
};

export const rewriteBskyUrl = (
	uri: string,
	client: BlueskyClientID,
): string => {
	let url: URL;
	try {
		url = new URL(uri);
	} catch {
		return uri;
	}

	if (!BSKY_HOSTS.has(url.hostname)) return uri;

	const target = getBskyAlternativeClientInfo(client).base;
	if (url.hostname === target) return uri;

	url.hostname = target;
	return url.toString();
};
