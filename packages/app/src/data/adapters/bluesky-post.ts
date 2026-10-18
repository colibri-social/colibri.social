import type { BlueskyPost } from "@colibri-social/ui";
import {
	BSKY_ALTERNATIVES,
	type ResolvedBlueskyClient,
} from "../bluesky-client";
import type { BlueskyPostView } from "../types";
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

export const toBlueskyPost = (
	view: BlueskyPostView,
	client: Pick<ResolvedBlueskyClient, "base">,
	now: Date = new Date(),
): BlueskyPost => {
	const ref = parseBlueskyPostUrl(view.url);
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
