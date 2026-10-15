import { describe, expect, it, vi } from "vitest";
import { fetchBlueskyPost, PUBLIC_BSKY_APPVIEW } from "./bluesky";

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
