import { classifyThrown, createLogger } from "@colibri-social/lib";
import { resolvePdsHost } from "../../auth/identity";
import { parseBlueskyPostUrl } from "../adapters/bluesky-post";
import type {
	BlueskyPostFacet,
	BlueskyPostFacetFeature,
	BlueskyPostImage,
	BlueskyPostVideo,
	BlueskyPostView,
	Datetime,
	Did,
} from "../types";

const log = createLogger("remote/bluesky");

export const PUBLIC_BSKY_APPVIEW = "https://public.api.bsky.app";

const IMAGES_VIEW = "app.bsky.embed.images#view";
const VIDEO_VIEW = "app.bsky.embed.video#view";
const RECORD_VIEW = "app.bsky.embed.record#view";
const RECORD_WITH_MEDIA_VIEW = "app.bsky.embed.recordWithMedia#view";
const VIEW_RECORD = "app.bsky.embed.record#viewRecord";
const POST_URI = /^at:\/\/([^/]+)\/app\.bsky\.feed\.post\/([^/]+)$/;

type PostAuthor = {
	did: string;
	handle: string;
	displayName?: string;
	avatar?: string;
	verification?: { verifiedStatus?: string };
};

type AspectRatio = { width: number; height: number };

type PostImage = {
	fullsize: string;
	alt?: string;
	aspectRatio?: AspectRatio;
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

type PostRecord = {
	$type?: string;
	text?: string;
	createdAt?: string;
	facets?: RecordFacet[];
};

type ViewRecord = {
	$type?: string;
	uri?: string;
	author?: PostAuthor;
	value?: PostRecord;
	embeds?: EmbedView[];
	indexedAt?: string;
};

type EmbedView = {
	$type?: string;
	images?: PostImage[];
	cid?: unknown;
	thumbnail?: unknown;
	alt?: unknown;
	aspectRatio?: AspectRatio;
	media?: EmbedView;
	record?: ViewRecord & { record?: ViewRecord };
};

type ThreadPost = {
	uri: string;
	author: PostAuthor;
	record: PostRecord;
	embed?: EmbedView;
	replyCount?: number;
	repostCount?: number;
	likeCount?: number;
};

type ThreadNode = {
	$type?: string;
	post?: ThreadPost;
	parent?: ThreadNode;
};

type PostMedia = Pick<BlueskyPostView, "images" | "video">;

type ResolvePds = (did: string) => Promise<string | undefined>;

const sizeOf = (aspectRatio: AspectRatio | undefined) => {
	return aspectRatio
		? { width: aspectRatio.width, height: aspectRatio.height }
		: {};
};

const imagesOf = (
	images: PostImage[] | undefined,
): BlueskyPostImage[] | undefined => {
	if (!images?.length) return undefined;

	return images.map((image) => ({
		url: image.fullsize,
		...(image.alt ? { alt: image.alt } : {}),
		...sizeOf(image.aspectRatio),
	}));
};

const videoOf = (
	embed: EmbedView,
	did: string,
): BlueskyPostVideo | undefined => {
	if (typeof embed.cid !== "string") return undefined;

	return {
		cid: embed.cid,
		did: did as Did,
		...(typeof embed.thumbnail === "string"
			? { thumbnail: embed.thumbnail }
			: {}),
		...(typeof embed.alt === "string" && embed.alt ? { alt: embed.alt } : {}),
		...sizeOf(embed.aspectRatio),
	};
};

const mediaOf = (embed: EmbedView | undefined, did: string): PostMedia => {
	switch (embed?.$type) {
		case IMAGES_VIEW: {
			const images = imagesOf(embed.images);

			return images ? { images } : {};
		}
		case VIDEO_VIEW: {
			const video = videoOf(embed, did);

			return video ? { video } : {};
		}
		case RECORD_WITH_MEDIA_VIEW:
			return mediaOf(embed.media, did);
		default:
			return {};
	}
};

const quotedRecordOf = (embed: EmbedView | undefined) => {
	switch (embed?.$type) {
		case RECORD_VIEW:
			return embed.record;
		case RECORD_WITH_MEDIA_VIEW:
			return embed.record?.record;
		default:
			return undefined;
	}
};

const authorOf = (author: PostAuthor): BlueskyPostView["author"] => {
	return {
		did: author.did as Did,
		handle: author.handle,
		...(author.displayName ? { displayName: author.displayName } : {}),
		...(author.avatar ? { avatar: author.avatar } : {}),
		verified: author.verification?.verifiedStatus === "valid",
	};
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

const facetsOf = (
	recordFacets: RecordFacet[] | undefined,
): BlueskyPostFacet[] | undefined => {
	const facets = (recordFacets ?? []).flatMap((facet): BlueskyPostFacet[] => {
		const byteStart = facet.index?.byteStart;
		const byteEnd = facet.index?.byteEnd;
		if (typeof byteStart !== "number" || typeof byteEnd !== "number") return [];
		const features = (facet.features ?? []).flatMap((feature) => {
			const known = featureOf(feature);
			return known ? [known] : [];
		});
		return features.length ? [{ index: { byteStart, byteEnd }, features }] : [];
	});
	return facets.length ? facets : undefined;
};

const quoteOf = (embed: EmbedView | undefined): BlueskyPostView | undefined => {
	const record = quotedRecordOf(embed);
	const match = record?.uri?.match(POST_URI);

	if (record?.$type !== VIEW_RECORD || !record.author || !match?.[2])
		return undefined;
	if (record.value?.$type && record.value.$type !== "app.bsky.feed.post")
		return undefined;

	const facets = facetsOf(record.value?.facets);

	return {
		url: `https://bsky.app/profile/${record.author.did}/post/${match[2]}`,
		author: authorOf(record.author),
		text: record.value?.text ?? "",
		createdAt: (record.value?.createdAt ??
			record.indexedAt ??
			new Date(0).toISOString()) as Datetime,
		...(facets ? { facets } : {}),
		...mediaOf(record.embeds?.[0], record.author.did),
	};
};

export const toBlueskyPostView = (
	url: string,
	node: ThreadNode,
): BlueskyPostView | undefined => {
	const post = node.post;

	if (!post) return undefined;

	const view: BlueskyPostView = {
		url,
		author: authorOf(post.author),
		text: post.record.text ?? "",
		createdAt: (post.record.createdAt ?? new Date(0).toISOString()) as Datetime,
		replyCount: post.replyCount,
		repostCount: post.repostCount,
		likeCount: post.likeCount,
		...mediaOf(post.embed, post.author.did),
	};
	const replyTo = node.parent?.post?.author.handle;
	const facets = facetsOf(post.record.facets);
	const quote = quoteOf(post.embed);

	if (replyTo) view.replyTo = replyTo;
	if (facets) view.facets = facets;
	if (quote) view.quote = quote;

	return view;
};

const pdsCaches = new WeakMap<
	ResolvePds,
	Map<string, Promise<string | undefined>>
>();

const pdsHostOf = (did: string, resolvePds: ResolvePds) => {
	const cache = pdsCaches.get(resolvePds) ?? new Map();

	pdsCaches.set(resolvePds, cache);

	const cached = cache.get(did);

	if (cached) return cached;

	const pending = resolvePds(did).catch((error: unknown) => {
		log.warn("could not resolve the server of a Bluesky video", {
			code: classifyThrown(error).code,
		});

		return undefined;
	});

	cache.set(did, pending);
	void pending.then((host) => {
		if (!host) cache.delete(did);
	});

	return pending;
};

const withVideoSource = async (
	video: BlueskyPostVideo,
	resolvePds: ResolvePds,
): Promise<BlueskyPostVideo> => {
	const host = await pdsHostOf(video.did, resolvePds);

	if (!host) {
		log.info("a Bluesky video falls back to its thumbnail", {
			code: "PdsUnavailable",
		});

		return video;
	}

	const query = new URLSearchParams({ did: video.did, cid: video.cid });

	return {
		...video,
		src: `https://${host}/xrpc/com.atproto.sync.getBlob?${query}`,
	};
};

const withVideoSources = async (
	view: BlueskyPostView,
	resolvePds: ResolvePds = resolvePdsHost,
): Promise<BlueskyPostView> => {
	const [video, quote] = await Promise.all([
		view.video ? withVideoSource(view.video, resolvePds) : undefined,
		view.quote ? withVideoSources(view.quote, resolvePds) : undefined,
	]);

	return {
		...view,
		...(video ? { video } : {}),
		...(quote ? { quote } : {}),
	};
};

export const fetchBlueskyPost = async (
	url: string,
	fetcher: typeof fetch = fetch,
	extraHost?: string,
	resolvePds: ResolvePds = resolvePdsHost,
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
		const view = body.thread ? toBlueskyPostView(url, body.thread) : undefined;

		return view ? await withVideoSources(view, resolvePds) : undefined;
	} catch (error) {
		log.warn("could not load a Bluesky post", {
			code: classifyThrown(error, { method: "app.bsky.feed.getPostThread" })
				.code,
		});
		return undefined;
	}
};
