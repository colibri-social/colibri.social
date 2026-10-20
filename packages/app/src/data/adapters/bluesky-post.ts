import type { BlueskyPost, RichTextSpan } from "@colibri-social/ui";
import {
	BSKY_ALTERNATIVES,
	type ResolvedBlueskyClient,
	rewriteBskyUrl,
} from "../bluesky-client";
import type { BlueskyPostFacet, BlueskyPostView } from "../types";
import { formatAge } from "./time";

export type BlueskyPostRef = { authority: string; rkey: string };

const POST_PATH = /^\/profile\/([^/]+)\/post\/([^/]+)\/?$/;

const KNOWN_HOSTS = new Set(BSKY_ALTERNATIVES.map((entry) => entry.base));

export const isBlueskyHost = (host: string, extra?: string) =>
	KNOWN_HOSTS.has(host) || (!!extra && host === extra);

export const parseBlueskyPostUrl = (
	uri: string,
	extraHost?: string,
): BlueskyPostRef | undefined => {
	let url: URL;
	try {
		url = new URL(uri);
	} catch {
		return undefined;
	}
	if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
	if (!isBlueskyHost(url.hostname, extraHost)) return undefined;
	const match = url.pathname.match(POST_PATH);
	if (!match?.[1] || !match[2]) return undefined;
	return { authority: decodeURIComponent(match[1]), rkey: match[2] };
};

export const blueskyPostUrl = (
	client: Pick<ResolvedBlueskyClient, "base">,
	authority: string,
	rkey: string,
) => `https://${client.base}/profile/${authority}/post/${rkey}`;

export const canonicalBlueskyPostUrl = (uri: string, extraHost?: string) => {
	const ref = parseBlueskyPostUrl(uri, extraHost);
	return ref
		? blueskyPostUrl({ base: "bsky.app" }, ref.authority, ref.rkey)
		: uri;
};

const WEB_URL = /^https?:\/\//i;

const facetHref = (
	facet: BlueskyPostFacet,
	client: Pick<ResolvedBlueskyClient, "base">,
): string | undefined => {
	for (const feature of facet.features) {
		switch (feature.$type) {
			case "app.bsky.richtext.facet#link":
				if (WEB_URL.test(feature.uri))
					return rewriteBskyUrl(feature.uri, client);
				break;
			case "app.bsky.richtext.facet#mention":
				return `https://${client.base}/profile/${feature.did}`;
			case "app.bsky.richtext.facet#tag":
				return `https://${client.base}/search?q=${encodeURIComponent(`#${feature.tag}`)}`;
		}
	}
	return undefined;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const blueskyTextSegments = (
	text: string,
	facets: readonly BlueskyPostFacet[] | undefined,
	client: Pick<ResolvedBlueskyClient, "base">,
): RichTextSpan[] => {
	if (!facets?.length) return text ? [{ text }] : [];
	const bytes = encoder.encode(text);
	const slice = (start: number, end?: number) =>
		decoder.decode(bytes.subarray(start, end));
	const sorted = [...facets].sort(
		(a, b) => a.index.byteStart - b.index.byteStart,
	);
	const segments: RichTextSpan[] = [];
	let cursor = 0;
	for (const facet of sorted) {
		const { byteStart, byteEnd } = facet.index;
		if (byteStart < cursor || byteEnd <= byteStart || byteEnd > bytes.length)
			continue;
		const href = facetHref(facet, client);
		if (!href) continue;
		if (byteStart > cursor) segments.push({ text: slice(cursor, byteStart) });
		segments.push({ text: slice(byteStart, byteEnd), href });
		cursor = byteEnd;
	}
	if (cursor < bytes.length) segments.push({ text: slice(cursor) });
	return segments;
};

export const toBlueskyPost = (
	view: BlueskyPostView,
	client: Pick<ResolvedBlueskyClient, "base">,
	now: Date = new Date(),
): BlueskyPost => {
	const ref = parseBlueskyPostUrl(view.url, client.base);
	return {
		author: {
			name: view.author.displayName?.trim() || view.author.handle,
			handle: view.author.handle,
			did: view.author.did,
			avatarSrc: view.author.avatar,
			verified: view.author.verified,
		},
		time: formatAge(view.createdAt, now),
		text: view.text,
		segments: view.facets?.length
			? blueskyTextSegments(view.text, view.facets, client)
			: undefined,
		url: ref ? blueskyPostUrl(client, view.author.handle, ref.rkey) : view.url,
		replyTo: view.replyTo,
		images: view.images?.map((image) => ({
			src: image.url,
			kind: "image",
			width: image.width,
			height: image.height,
			alt: image.alt,
		})),
		stats:
			view.replyCount === undefined &&
			view.repostCount === undefined &&
			view.likeCount === undefined
				? undefined
				: {
						replies: view.replyCount ?? 0,
						reposts: view.repostCount ?? 0,
						likes: view.likeCount ?? 0,
					},
	};
};
