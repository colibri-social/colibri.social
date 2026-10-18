import { parseBlueskyPostUrl } from "../adapters/bluesky-post";
import type { BlueskyPostView } from "../types";
import { asDatetime, asDid } from "./refs";

type PostSeed = Omit<BlueskyPostView, "createdAt" | "url"> & {
	rkey: string;
	minutesAgo: number;
};

const SEEDS: PostSeed[] = [
	{
		rkey: "3lbdolomites2k",
		author: {
			did: asDid("did:plc:dolomitesguide7q2x4m"),
			handle: "dolomites.bsky.social",
			displayName: "Dolomites Guide",
			verified: true,
		},
		text: "Tre Cime loop is open again after the early snow. Microspikes recommended on the north side until the weekend.",
		minutesAgo: 180,
		images: [
			{
				url: "https://picsum.photos/seed/tre-cime-north/1200/800",
				width: 1200,
				height: 800,
				alt: "The three peaks under fresh snow",
			},
		],
		replyCount: 12,
		repostCount: 48,
		likeCount: 312,
	},
];

export const BLUESKY_POST_URL = `https://bsky.app/profile/${SEEDS[0]?.author.handle}/post/${SEEDS[0]?.rkey}`;

export const findBlueskyPost = (
	url: string,
	now: number,
): BlueskyPostView | undefined => {
	const ref = parseBlueskyPostUrl(url);
	if (!ref) return undefined;
	const seed = SEEDS.find(
		(entry) =>
			entry.rkey === ref.rkey &&
			(entry.author.handle === ref.authority ||
				entry.author.did === ref.authority),
	);
	if (!seed) return undefined;
	const { rkey, minutesAgo, ...post } = seed;
	return {
		...post,
		url: `https://bsky.app/profile/${seed.author.handle}/post/${rkey}`,
		createdAt: asDatetime(now - minutesAgo * 60_000),
	};
};
