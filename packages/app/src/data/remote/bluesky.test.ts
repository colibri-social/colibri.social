import { describe, expect, it, vi } from "vitest";
import {
	fetchBlueskyPost,
	PUBLIC_BSKY_APPVIEW,
	toBlueskyPostView,
} from "./bluesky";

const URL_OF_POST = "https://bsky.app/profile/alice.test/post/3abc";

const thread = {
	thread: {
		post: {
			uri: "at://did:plc:alice/app.bsky.feed.post/3abc",
			author: {
				did: "did:plc:alice",
				handle: "alice.test",
				displayName: "Alice",
				avatar: "https://cdn.test/a.jpg",
				verification: { verifiedStatus: "valid" },
			},
			record: { text: "Hello", createdAt: "2026-10-14T10:00:00.000Z" },
			embed: {
				$type: "app.bsky.embed.images#view",
				images: [
					{
						fullsize: "https://cdn.test/full.jpg",
						alt: "A bird",
						aspectRatio: { width: 4, height: 3 },
					},
				],
			},
			replyCount: 1,
			repostCount: 2,
			likeCount: 3,
		},
		parent: { post: { author: { did: "did:plc:bob", handle: "bob.test" } } },
	},
};

describe("fetchBlueskyPost", () => {
	it("loads the post from the public Bluesky API", async () => {
		const fetcher = vi.fn(
			async (url: string | URL | Request) =>
				new Response(
					String(url).startsWith(
						`${PUBLIC_BSKY_APPVIEW}/xrpc/app.bsky.feed.getPostThread?`,
					)
						? JSON.stringify(thread)
						: "{}",
				),
		);

		const post = await fetchBlueskyPost(URL_OF_POST, fetcher as typeof fetch);

		const requested = new URL(String(fetcher.mock.calls[0]?.[0]));
		expect(requested.searchParams.get("uri")).toBe(
			"at://alice.test/app.bsky.feed.post/3abc",
		);
		expect(post).toEqual({
			url: URL_OF_POST,
			author: {
				did: "did:plc:alice",
				handle: "alice.test",
				displayName: "Alice",
				avatar: "https://cdn.test/a.jpg",
				verified: true,
			},
			text: "Hello",
			createdAt: "2026-10-14T10:00:00.000Z",
			replyTo: "bob.test",
			images: [
				{
					url: "https://cdn.test/full.jpg",
					alt: "A bird",
					width: 4,
					height: 3,
				},
			],
			replyCount: 1,
			repostCount: 2,
			likeCount: 3,
		});
	});

	it("keeps link, mention and tag facets and drops unknown ones", () => {
		const view = toBlueskyPostView(URL_OF_POST, {
			post: {
				...thread.thread.post,
				record: {
					text: "a b c d",
					createdAt: "2026-10-14T10:00:00.000Z",
					facets: [
						{
							index: { byteStart: 0, byteEnd: 1 },
							features: [
								{
									$type: "app.bsky.richtext.facet#link",
									uri: "https://example.com",
								},
							],
						},
						{
							index: { byteStart: 2, byteEnd: 3 },
							features: [
								{ $type: "app.bsky.richtext.facet#mention", did: "did:plc:b" },
							],
						},
						{
							index: { byteStart: 4, byteEnd: 5 },
							features: [{ $type: "app.bsky.richtext.facet#tag", tag: "c" }],
						},
						{
							index: { byteStart: 6, byteEnd: 7 },
							features: [{ $type: "app.bsky.richtext.facet#bold" }],
						},
						{ features: [{ $type: "app.bsky.richtext.facet#tag", tag: "x" }] },
					],
				},
			},
		});
		expect(view?.facets).toEqual([
			{
				index: { byteStart: 0, byteEnd: 1 },
				features: [
					{ $type: "app.bsky.richtext.facet#link", uri: "https://example.com" },
				],
			},
			{
				index: { byteStart: 2, byteEnd: 3 },
				features: [
					{ $type: "app.bsky.richtext.facet#mention", did: "did:plc:b" },
				],
			},
			{
				index: { byteStart: 4, byteEnd: 5 },
				features: [{ $type: "app.bsky.richtext.facet#tag", tag: "c" }],
			},
		]);
	});

	it("loads posts linked from a custom client host", async () => {
		const fetcher = vi.fn(async () => new Response(JSON.stringify(thread)));
		const custom = "https://sky.example.org/profile/alice.test/post/3abc";
		expect(await fetchBlueskyPost(custom, fetcher as never)).toBeUndefined();
		expect(
			await fetchBlueskyPost(custom, fetcher as never, "sky.example.org"),
		).toMatchObject({ url: custom, text: "Hello" });
	});

	it("returns nothing for links that are not Bluesky posts", async () => {
		const fetcher = vi.fn();
		expect(
			await fetchBlueskyPost("https://example.com", fetcher as never),
		).toBeUndefined();
		expect(fetcher).not.toHaveBeenCalled();
	});

	it("returns nothing when the post can't be loaded", async () => {
		const failing = vi.fn(async () => new Response("{}", { status: 400 }));
		const offline = vi.fn(async () => {
			throw new TypeError("Failed to fetch");
		});
		expect(
			await fetchBlueskyPost(URL_OF_POST, failing as never),
		).toBeUndefined();
		expect(
			await fetchBlueskyPost(URL_OF_POST, offline as never),
		).toBeUndefined();
	});
});

const QUOTE_URI = "at://did:plc:carol/app.bsky.feed.post/3quote";

const carol = {
	did: "did:plc:carol",
	handle: "carol.test",
	displayName: "Carol",
};

const videoView = {
	$type: "app.bsky.embed.video#view",
	cid: "bafyvideo",
	playlist: "https://video.test/playlist.m3u8",
	thumbnail: "https://video.test/thumb.jpg",
	alt: "A heron",
	aspectRatio: { width: 16, height: 9 },
};

const imagesView = {
	$type: "app.bsky.embed.images#view",
	images: [{ fullsize: "https://cdn.test/quote.jpg", alt: "A crow" }],
};

const viewRecord = (embeds?: unknown[]) => ({
	$type: "app.bsky.embed.record#viewRecord",
	uri: QUOTE_URI,
	cid: "bafyquote",
	author: carol,
	value: {
		$type: "app.bsky.feed.post",
		text: "Quoted",
		createdAt: "2026-10-13T10:00:00.000Z",
	},
	...(embeds ? { embeds } : {}),
	indexedAt: "2026-10-13T10:00:01.000Z",
});

const threadWith = (embed: unknown) => ({
	thread: { post: { ...thread.thread.post, embed } },
});

const respondWith = (body: unknown) => async (): Promise<Response> =>
	new Response(JSON.stringify(body));

const pdsOf = (hosts: Record<string, string>) =>
	vi.fn(async (did: string) => hosts[did]);

describe("Bluesky post embeds", () => {
	it("loads a video from the author's PDS with its thumbnail and size", async () => {
		const resolvePds = pdsOf({ "did:plc:alice": "pds.alice.test" });
		const post = await fetchBlueskyPost(
			URL_OF_POST,
			respondWith(threadWith(videoView)) as never,
			undefined,
			resolvePds,
		);

		expect(post?.images).toBeUndefined();
		expect(post?.video).toEqual({
			cid: "bafyvideo",
			did: "did:plc:alice",
			src: "https://pds.alice.test/xrpc/com.atproto.sync.getBlob?did=did%3Aplc%3Aalice&cid=bafyvideo",
			thumbnail: "https://video.test/thumb.jpg",
			alt: "A heron",
			width: 16,
			height: 9,
		});
	});

	it("keeps the video thumbnail when the PDS can't be found", async () => {
		const resolvePds = vi.fn(async () => undefined);
		const post = await fetchBlueskyPost(
			URL_OF_POST,
			respondWith(threadWith(videoView)) as never,
			undefined,
			resolvePds,
		);

		expect(post?.video).toMatchObject({
			cid: "bafyvideo",
			thumbnail: "https://video.test/thumb.jpg",
		});
		expect(post?.video?.src).toBeUndefined();
	});

	it("keeps the video thumbnail when resolving the PDS throws", async () => {
		const resolvePds = vi.fn(async () => {
			throw new TypeError("Failed to fetch");
		});
		const post = await fetchBlueskyPost(
			URL_OF_POST,
			respondWith(threadWith(videoView)) as never,
			undefined,
			resolvePds,
		);

		expect(post?.text).toBe("Hello");
		expect(post?.video?.src).toBeUndefined();
	});

	it("reads images next to a quote from recordWithMedia", () => {
		const view = toBlueskyPostView(URL_OF_POST, {
			post: {
				...thread.thread.post,
				embed: {
					$type: "app.bsky.embed.recordWithMedia#view",
					media: imagesView,
					record: {
						$type: "app.bsky.embed.record#view",
						record: viewRecord(),
					},
				} as never,
			},
		});

		expect(view?.images).toEqual([
			{ url: "https://cdn.test/quote.jpg", alt: "A crow" },
		]);
		expect(view?.quote).toMatchObject({
			url: "https://bsky.app/profile/did:plc:carol/post/3quote",
			text: "Quoted",
		});
	});

	it("resolves videos in recordWithMedia and in the quote", async () => {
		const resolvePds = pdsOf({
			"did:plc:alice": "pds.alice.test",
			"did:plc:carol": "pds.carol.test",
		});
		const post = await fetchBlueskyPost(
			URL_OF_POST,
			respondWith(
				threadWith({
					$type: "app.bsky.embed.recordWithMedia#view",
					media: videoView,
					record: {
						$type: "app.bsky.embed.record#view",
						record: viewRecord([{ ...videoView, cid: "bafyquoted" }]),
					},
				}),
			) as never,
			undefined,
			resolvePds,
		);

		expect(post?.video?.src).toContain("pds.alice.test");
		expect(post?.quote?.video).toMatchObject({
			did: "did:plc:carol",
			src: "https://pds.carol.test/xrpc/com.atproto.sync.getBlob?did=did%3Aplc%3Acarol&cid=bafyquoted",
		});
	});

	it("reads a quoted post with its author, text and media", () => {
		const view = toBlueskyPostView(URL_OF_POST, {
			post: {
				...thread.thread.post,
				embed: {
					$type: "app.bsky.embed.record#view",
					record: viewRecord([imagesView]),
				} as never,
			},
		});

		expect(view?.images).toBeUndefined();
		expect(view?.quote).toEqual({
			url: "https://bsky.app/profile/did:plc:carol/post/3quote",
			author: {
				did: "did:plc:carol",
				handle: "carol.test",
				displayName: "Carol",
				verified: false,
			},
			text: "Quoted",
			createdAt: "2026-10-13T10:00:00.000Z",
			images: [{ url: "https://cdn.test/quote.jpg", alt: "A crow" }],
		});
	});

	it("stops at one level of quotes", () => {
		const view = toBlueskyPostView(URL_OF_POST, {
			post: {
				...thread.thread.post,
				embed: {
					$type: "app.bsky.embed.record#view",
					record: viewRecord([
						{
							$type: "app.bsky.embed.record#view",
							record: viewRecord(),
						},
					]),
				} as never,
			},
		});

		expect(view?.quote?.text).toBe("Quoted");
		expect(view?.quote?.quote).toBeUndefined();
	});

	it.each([
		{ $type: "app.bsky.embed.record#viewNotFound", uri: QUOTE_URI },
		{ $type: "app.bsky.embed.record#viewBlocked", uri: QUOTE_URI },
		{ $type: "app.bsky.embed.record#viewDetached", uri: QUOTE_URI },
		{
			$type: "app.bsky.feed.defs#generatorView",
			uri: "at://did:plc:carol/app.bsky.feed.generator/birds",
		},
		{
			$type: "app.bsky.graph.defs#listView",
			uri: "at://did:plc:carol/app.bsky.graph.list/3list",
		},
		{
			$type: "app.bsky.embed.record#viewRecord",
			uri: "at://did:plc:carol/app.bsky.graph.starterpack/3pack",
			author: carol,
			value: { $type: "app.bsky.graph.starterpack", name: "Birders" },
		},
	])("shows no quote for $type", (record) => {
		const view = toBlueskyPostView(URL_OF_POST, {
			post: {
				...thread.thread.post,
				embed: { $type: "app.bsky.embed.record#view", record } as never,
			},
		});

		expect(view).toBeDefined();
		expect(view?.quote).toBeUndefined();
	});
});
