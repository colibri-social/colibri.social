import { classifyThrown, createLogger } from "@colibri-social/lib";
import { parseBlueskyPostUrl } from "../adapters/bluesky-post";
import type {
	BlueskyPostFacet,
	BlueskyPostFacetFeature,
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

type RecordFacet = {
	index?: { byteStart?: unknown; byteEnd?: unknown };
	features?: Array<{
		$type?: string;
		uri?: unknown;
		did?: unknown;
		tag?: unknown;
	}>;
};

type ThreadPost = {
	uri: string;
	author: PostAuthor;
	record: { text?: string; createdAt?: string; facets?: RecordFacet[] };
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

const featureOf = (
	feature: NonNullable<RecordFacet["features"]>[number],
): BlueskyPostFacetFeature | undefined => {
	switch (feature.$type) {
		case "app.bsky.richtext.facet#link":
			return typeof feature.uri === "string"
				? { $type: feature.$type, uri: feature.uri }
				: undefined;
		case "app.bsky.richtext.facet#mention":
			return typeof feature.did === "string"
				? { $type: feature.$type, did: feature.did }
				: undefined;
		case "app.bsky.richtext.facet#tag":
			return typeof feature.tag === "string"
				? { $type: feature.$type, tag: feature.tag }
				: undefined;
		default:
			return undefined;
	}
};

const facetsOf = (post: ThreadPost): BlueskyPostFacet[] | undefined => {
	const facets = (post.record.facets ?? []).flatMap(
		(facet): BlueskyPostFacet[] => {
			const byteStart = facet.index?.byteStart;
			const byteEnd = facet.index?.byteEnd;
			if (typeof byteStart !== "number" || typeof byteEnd !== "number")
				return [];
			const features = (facet.features ?? []).flatMap((feature) => {
				const known = featureOf(feature);
				return known ? [known] : [];
			});
			return features.length
				? [{ index: { byteStart, byteEnd }, features }]
				: [];
		},
	);
	return facets.length ? facets : undefined;
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
	const facets = facetsOf(post);
	if (facets) view.facets = facets;
	return view;
};

export const fetchBlueskyPost = async (
	url: string,
	fetcher: typeof fetch = fetch,
	extraHost?: string,
): Promise<BlueskyPostView | undefined> => {
	const ref = parseBlueskyPostUrl(url, extraHost);
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
