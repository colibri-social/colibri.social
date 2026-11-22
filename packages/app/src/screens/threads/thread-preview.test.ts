import { describe, expect, it } from "vitest";
import type { ChannelSummary } from "../../data/channel-summary";
import { servedThreadSummary, threadSummary } from "../../data/thread-summary";
import type { Did, Facet, MemberView, ThreadView } from "../../data/types";
import { type ThreadPreviewSources, threadPreview } from "./thread-preview";

const THREAD = "at://did:plc:hq/social.colibri.thread/t1";
const VIEWER = "did:plc:viewer" as Did;
const MEMBER = "did:plc:member" as Did;
const KEK = "at://did:plc:hq/blue.moji.collection.item/kek";
const OWL = "at://did:plc:hq/blue.moji.collection.item/owl";

const emojiFacet = (byteStart: number, byteEnd: number, uri: string) => ({
	index: { byteStart, byteEnd },
	features: [{ $type: "social.colibri.beta.richtext.facet#customEmoji", uri }],
});

const served = (overrides: Record<string, unknown> = {}) => ({
	channel: THREAD,
	rkey: "r2",
	author: MEMBER,
	text: "hello there",
	attachmentCount: 0,
	forward: false,
	createdAt: "2026-10-20T10:00:00.000Z",
	...overrides,
});

const thread = (lastMessage?: unknown): ThreadView =>
	({
		space: THREAD,
		channel: "at://did:plc:hq/social.colibri.channel/c1",
		community: "did:plc:hq",
		name: "side conversation",
		createdBy: MEMBER,
		createdAt: "2026-10-20T09:00:00.000Z",
		lastActivityAt: "2026-10-20T10:00:00.000Z",
		messageCount: 2,
		participants: [MEMBER],
		viewer: {},
		...(lastMessage === undefined ? {} : { lastMessage }),
	}) as unknown as ThreadView;

const live = (overrides: Partial<ChannelSummary> = {}): ChannelSummary =>
	({
		channel: THREAD,
		rkey: "r3",
		author: VIEWER,
		text: "newer",
		createdAt: "2026-10-20T11:00:00.000Z",
		...overrides,
	}) as ChannelSummary;

const member = {
	actor: {
		did: MEMBER,
		handle: "member.test",
		displayName: "Robin",
		avatar: "https://cdn.test/robin.webp",
	},
	nickname: undefined,
	roles: [],
} as unknown as MemberView;

const sources = (
	overrides: Partial<ThreadPreviewSources> = {},
): ThreadPreviewSources => ({
	viewer: { did: VIEWER, handle: "viewer.test", displayName: "Lou" },
	member: (did) => (did === MEMBER ? member : undefined),
	live: () => undefined,
	emoji: (feature: Facet["features"][number]) =>
		"uri" in feature && feature.uri === KEK
			? { name: "kek", src: "https://cdn.test/kek.webp" }
			: "uri" in feature && feature.uri === OWL
				? { name: "", src: "" }
				: undefined,
	...overrides,
});

describe("servedThreadSummary", () => {
	it("reads the served last message", () => {
		expect(servedThreadSummary(thread(served()))).toEqual({
			channel: THREAD,
			rkey: "r2",
			author: MEMBER,
			text: "hello there",
			createdAt: "2026-10-20T10:00:00.000Z",
		});
	});

	it("falls back to attachment text", () => {
		expect(
			servedThreadSummary(
				thread(
					served({ text: "", attachmentKind: "image", attachmentCount: 2 }),
				),
			),
		).toMatchObject({ text: "Sent 2 images", attachment: "image" });
	});

	it("ignores a thread without the field", () => {
		expect(servedThreadSummary(thread())).toBeUndefined();
	});

	it("ignores a malformed field", () => {
		expect(servedThreadSummary(thread({ text: 4 }))).toBeUndefined();
		expect(servedThreadSummary(thread("hello"))).toBeUndefined();
		expect(
			servedThreadSummary(thread(served({ facets: "nope" }))),
		).toBeUndefined();
	});
});

describe("threadSummary", () => {
	it("prefers a newer live summary", () => {
		expect(threadSummary(thread(served()), live())?.rkey).toBe("r3");
	});

	it("keeps the served summary when the live one is older", () => {
		expect(
			threadSummary(
				thread(served()),
				live({ rkey: "r1", createdAt: "2026-10-20T08:00:00.000Z" }),
			)?.rkey,
		).toBe("r2");
	});

	it("uses the live summary before the field exists", () => {
		expect(threadSummary(thread(), live())?.rkey).toBe("r3");
		expect(threadSummary(thread(), undefined)).toBeUndefined();
	});
});

describe("threadPreview", () => {
	it("names a member author and carries their avatar", () => {
		expect(threadPreview(thread(served()), sources())).toEqual({
			name: "Robin",
			avatarSrc: "https://cdn.test/robin.webp",
			text: "hello there",
			parts: ["hello there"],
		});
	});

	it("names the viewer from their own profile", () => {
		expect(
			threadPreview(thread(served({ author: VIEWER })), sources())?.name,
		).toBe("Lou");
	});

	it("names an unknown author Someone", () => {
		expect(
			threadPreview(thread(served({ author: "did:plc:gone" })), sources())
				?.name,
		).toBe("Someone");
	});

	it("turns custom emoji into image parts and keeps unresolved ones as text", () => {
		const preview = threadPreview(
			thread(
				served({
					text: "hi :kek: :owl:",
					facets: [emojiFacet(3, 8, KEK), emojiFacet(9, 14, OWL)],
				}),
			),
			sources(),
		);
		expect(preview?.parts).toEqual([
			"hi ",
			{ name: "kek", src: "https://cdn.test/kek.webp" },
			" :owl:",
		]);
	});

	it("keeps a loading custom emoji as a pending part", () => {
		const preview = threadPreview(
			thread(
				served({
					text: "hi :owl:",
					facets: [emojiFacet(3, 8, OWL)],
				}),
			),
			sources({
				emoji: () => ({ name: "", src: "", pending: true }),
			}),
		);
		expect(preview?.parts).toEqual([
			"hi ",
			{ name: "", src: "", pending: true },
		]);
	});

	it("carries the attachment kind", () => {
		expect(
			threadPreview(
				thread(
					served({ text: "", attachmentKind: "file", attachmentCount: 1 }),
				),
				sources(),
			),
		).toMatchObject({ text: "Sent a file", attachment: "file" });
	});

	it("shows nothing when there is no last message", () => {
		expect(threadPreview(thread(), sources())).toBeUndefined();
	});
});
