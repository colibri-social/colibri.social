import { classifyThrown, createLogger } from "@colibri-social/lib";
import { parseBlueskyPostUrl } from "../adapters/bluesky-post";
import type {
	BlueskyPostImage,
	BlueskyPostView,
	Datetime,
	Did,
} from "../types";

const log = createLogger("remote/bluesky");

export const PUBLIC_BSKY_APPVIEW = "https://public.api.bsky.app";

type PostAuthor = {
	did: string;
	handle: string;
	displayName?: string;
	avatar?: string;
	verification?: { verifiedStatus?: string };
};

type PostImage = {
	fullsize: string;
	alt?: string;
	aspectRatio?: { width: number; height: number };
};

type ThreadPost = {
	uri: string;
	author: PostAuthor;
	record: { text?: string; createdAt?: string };
	embed?: {
		$type?: string;
		images?: PostImage[];
		media?: { images?: PostImage[] };
	};
	replyCount?: number;
	repostCount?: number;
	likeCount?: number;
};

type ThreadNode = {
	$type?: string;
	post?: ThreadPost;
	parent?: ThreadNode;
};

const imagesOf = (post: ThreadPost): BlueskyPostImage[] | undefined => {
	const images = post.embed?.images ?? post.embed?.media?.images;
	if (!images?.length) return undefined;
	return images.map((image) => ({
		url: image.fullsize,
		...(image.alt ? { alt: image.alt } : {}),
		...(image.aspectRatio
			? { width: image.aspectRatio.width, height: image.aspectRatio.height }
			: {}),
	}));
};

export const toBlueskyPostView = (
	url: string,
	node: ThreadNode,
): BlueskyPostView | undefined => {
	const post = node.post;
	if (!post) return undefined;
	const view: BlueskyPostView = {
		url,
		author: {
			did: post.author.did as Did,
			handle: post.author.handle,
			...(post.author.displayName
				? { displayName: post.author.displayName }
				: {}),
			...(post.author.avatar ? { avatar: post.author.avatar } : {}),
			verified: post.author.verification?.verifiedStatus === "valid",
		},
		text: post.record.text ?? "",
		createdAt: (post.record.createdAt ?? new Date(0).toISOString()) as Datetime,
		replyCount: post.replyCount,
		repostCount: post.repostCount,
		likeCount: post.likeCount,
	};
	const replyTo = node.parent?.post?.author.handle;
	if (replyTo) view.replyTo = replyTo;
	const images = imagesOf(post);
	if (images) view.images = images;
	return view;
};

export const fetchBlueskyPost = async (
	url: string,
	fetcher: typeof fetch = fetch,
): Promise<BlueskyPostView | undefined> => {
	const ref = parseBlueskyPostUrl(url);
	if (!ref) return undefined;
	const uri = `at://${ref.authority}/app.bsky.feed.post/${ref.rkey}`;
	const query = new URLSearchParams({ uri, depth: "0", parentHeight: "1" });
	try {
		const response = await fetcher(
			`${PUBLIC_BSKY_APPVIEW}/xrpc/app.bsky.feed.getPostThread?${query}`,
		);
		if (!response.ok) return undefined;
		const body = (await response.json()) as { thread?: ThreadNode };
		return body.thread ? toBlueskyPostView(url, body.thread) : undefined;
	} catch (error) {
		log.warn("could not load a Bluesky post", {
			code: classifyThrown(error, { method: "app.bsky.feed.getPostThread" })
				.code,
		});
		return undefined;
	}
};
