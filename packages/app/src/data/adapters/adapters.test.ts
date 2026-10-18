import { describe, expect, it, vi } from "vitest";
import { isVisibleRole, rolesOf, topHoistedRole, visibleRoles } from "../roles";
import type {
	AttachmentView,
	Facet,
	ForwardView,
	LinkEmbed,
	MemberView,
	ProfileView,
	ReactionView,
	RoleView,
} from "../types";
import {
	embedSuppression,
	gifOfAttachments,
	inlineMediaOf,
	isGifSiteUrl,
	splitAttachments,
	toLinkEmbedProps,
	visibleEmbeds,
} from "./attachments";
import {
	bridgePlatformName,
	displayNameOf,
	toMessageAuthor,
	viaLabel,
} from "./authors";
import { parseBlueskyPostUrl, toBlueskyPost } from "./bluesky-post";
import {
	fromComposerValue,
	linkUris,
	mentionsDid,
	mentionsRole,
	previewText,
	spoileredLinkUris,
	toTextValue,
	utf8Length,
	validFacets,
} from "./facets";
import { toForwardDisplay } from "./forward";
import {
	customReactionResolver,
	toggleReaction,
	toReactionGroups,
	toReactions,
} from "./reactions";
import { formatAge } from "./time";

vi.mock("@colibri-social/ui", () => ({
	isRoleBadgeIconName: (name: string) =>
		["shield-check", "star", "crown"].includes(name),
}));

const encoder = new TextEncoder();

const facet = (
	text: string,
	part: string,
	features: Facet["features"],
): Facet => {
	const start = text.indexOf(part);
	const byteStart = encoder.encode(text.slice(0, start)).length;
	return {
		index: { byteStart, byteEnd: byteStart + utf8Length(part) },
		features,
	} as Facet;
};

const bold = [
	{ $type: "social.colibri.beta.richtext.facet#bold" },
] as Facet["features"];

const profile = (did: string, extra: Partial<ProfileView> = {}) =>
	({
		did,
		handle: `${did.split(":").pop()}.test`,
		displayName: did.split(":").pop(),
		isBot: false,
		syncBluesky: false,
		...extra,
	}) as ProfileView;

const role = (rkey: string, position: number, extra: Partial<RoleView> = {}) =>
	({ rkey, name: rkey, permissions: [], position, ...extra }) as RoleView;

const member = (actor: ProfileView, roles: string[], nickname?: string) =>
	({
		actor,
		roles,
		joinedAt: "2026-01-01T00:00:00.000Z",
		nickname,
	}) as MemberView;

describe("facet lookups", () => {
	const text = "Ping @Core and https://a.test and https://a.test";
	const facets = [
		facet(text, "@Core", [
			{ $type: "social.colibri.beta.richtext.facet#role", role: "core" },
		] as Facet["features"]),
		facet(text, "https://a.test", [
			{
				$type: "social.colibri.beta.richtext.facet#link",
				uri: "https://a.test",
			},
		] as Facet["features"]),
	];

	it("matches role mentions against the viewer's roles", () => {
		expect(mentionsRole(facets, ["core"])).toBe(true);
		expect(mentionsRole(facets, ["guides"])).toBe(false);
		expect(mentionsRole(facets, [])).toBe(false);
	});

	it("lists link targets once", () => {
		expect(linkUris([...facets, ...facets])).toEqual(["https://a.test"]);
		expect(linkUris(undefined)).toEqual([]);
	});
});

describe("links inside spoilers", () => {
	const link = (uri: string) =>
		[
			{ $type: "social.colibri.beta.richtext.facet#link", uri },
		] as Facet["features"];
	const spoiler = [
		{ $type: "social.colibri.beta.richtext.facet#spoiler" },
	] as Facet["features"];

	it("skips a link wrapped in a spoiler", () => {
		const text = "Ending: https://end.test is wild";
		const facets = [
			facet(text, "https://end.test", link("https://end.test")),
			facet(text, "https://end.test is wild", spoiler),
		];
		expect(linkUris(facets)).toEqual([]);
		expect([...spoileredLinkUris(facets)]).toEqual(["https://end.test"]);
	});

	it("skips a link that only partly overlaps a spoiler", () => {
		const text = "see https://end.test now";
		const facets = [
			facet(text, "https://end.test", link("https://end.test")),
			facet(text, "see https://end", spoiler),
		];
		expect(linkUris(facets)).toEqual([]);
	});

	it("skips a facet carrying both link and spoiler features", () => {
		const text = "https://end.test";
		const facets = [
			facet(text, text, [...link("https://end.test"), ...spoiler]),
		];
		expect(linkUris(facets)).toEqual([]);
		expect(spoileredLinkUris(facets).has("https://end.test")).toBe(true);
	});

	it("keeps a link that only touches the spoiler's edge", () => {
		const text = "secret https://a.test";
		const facets = [
			facet(text, "secret ", spoiler),
			facet(text, "https://a.test", link("https://a.test")),
		];
		expect(linkUris(facets)).toEqual(["https://a.test"]);
		expect(spoileredLinkUris(facets).size).toBe(0);
	});

	it("keeps a link that also appears outside the spoiler", () => {
		const text = "https://a.test and again https://a.test.";
		const second = text.lastIndexOf("https://a.test");
		const byteStart = utf8Length(text.slice(0, second));
		const facets = [
			facet(text, "https://a.test", link("https://a.test")),
			{
				index: { byteStart, byteEnd: byteStart + utf8Length("https://a.test") },
				features: [...link("https://a.test"), ...spoiler],
			} as Facet,
		];
		expect(linkUris(facets)).toEqual(["https://a.test"]);
		expect(spoileredLinkUris(facets).size).toBe(0);
	});
});

describe("facets", () => {
	it("keeps byte ranges on character boundaries", () => {
		const text = "héllo 🐦 world";
		const good = facet(text, "🐦", bold);
		const broken = {
			...good,
			index: {
				byteStart: good.index.byteStart + 1,
				byteEnd: good.index.byteEnd,
			},
		} as Facet;
		const outside = {
			...good,
			index: { byteStart: 0, byteEnd: 999 },
		} as Facet;
		expect(validFacets(text, [good, broken, outside])).toEqual([good]);
	});

	it("passes valid facets through unchanged", () => {
		const text = "see **this**";
		const value = toTextValue(text, [facet(text, "this", bold)]);
		expect(value.facets).toHaveLength(1);
	});

	it("shifts facets when trimming composer output", () => {
		const raw = "  hi 🐦 there  ";
		const value = fromComposerValue({
			text: raw,
			facets: [facet(raw, "🐦", bold)],
		});
		expect(value.text).toBe("hi 🐦 there");
		const range = value.facets[0]?.index;
		expect(
			new TextDecoder().decode(
				encoder.encode(value.text).slice(range?.byteStart, range?.byteEnd),
			),
		).toBe("🐦");
	});

	it("detects mentions of a DID", () => {
		const text = "hey @lou";
		const mention = facet(text, "@lou", [
			{
				$type: "social.colibri.beta.richtext.facet#mention",
				did: "did:plc:lou",
			},
		] as Facet["features"]);
		expect(mentionsDid([mention], "did:plc:lou")).toBe(true);
		expect(mentionsDid([mention], "did:plc:other")).toBe(false);
	});

	it("collapses and truncates previews on grapheme-safe code points", () => {
		expect(previewText("a\n\nb   c")).toBe("a b c");
		expect(previewText("🐦".repeat(5), 3)).toBe("🐦🐦🐦...");
	});
});

describe("authors", () => {
	const roles = new Map([
		["admin", role("admin", 10, { color: "#ff0000" })],
		[
			"mod",
			role("mod", 5, {
				color: "#00ff00",
				badge: {
					$type: "social.colibri.beta.community.defs#roleIconBadge",
					icon: "shield-check",
				} as RoleView["badge"],
			}),
		],
		["plain", role("plain", 20)],
	]);

	it("takes color and badge from the single highest colored role", () => {
		const actor = profile("did:plc:ada", { theme: { accentColor: "#123456" } });
		const members = new Map([
			[actor.did, member(actor, ["mod", "admin", "plain"], "Ada L.")],
		]);
		expect(toMessageAuthor(actor, { members, roles })).toEqual({
			name: "Ada L.",
			avatarSrc: undefined,
			seed: "did:plc:ada",
			nameColor: "#123456",
			role: {
				id: "admin",
				name: "admin",
				color: "#ff0000",
				badge: undefined,
			},
			owner: false,
		});
	});

	it("skips the owner role and falls through to the next colored role", () => {
		const actor = profile("did:plc:owner");
		const withOwner = new Map(roles).set(
			"owner",
			role("owner", 99, {
				color: "#ffd857",
				protected: true,
				badge: {
					$type: "social.colibri.beta.community.defs#roleIconBadge",
					icon: "crown",
				} as RoleView["badge"],
			}),
		);
		const members = new Map([[actor.did, member(actor, ["owner", "mod"])]]);
		expect(toMessageAuthor(actor, { members, roles: withOwner }).role).toEqual({
			id: "mod",
			name: "mod",
			color: "#00ff00",
			badge: { kind: "icon", name: "shield-check", color: undefined },
		});
		const ownerOnly = new Map([[actor.did, member(actor, ["owner"])]]);
		expect(
			toMessageAuthor(actor, { members: ownerOnly, roles: withOwner }).role,
		).toBeUndefined();
		expect(
			toMessageAuthor(actor, { members: ownerOnly, roles: withOwner }).owner,
		).toBe(true);
		const other = profile("did:plc:other");
		expect(
			toMessageAuthor(other, {
				members: new Map([[other.did, member(other, ["mod"])]]),
				roles: withOwner,
			}).owner,
		).toBe(false);
	});

	it("never takes color or the top role from the default role", () => {
		const actor = profile("did:plc:joiner");
		const withDefault = new Map(roles).set(
			"members",
			role("members", 50, {
				color: "#abcdef",
				default: true,
			} as Partial<RoleView>),
		);
		const onlyDefault = new Map([[actor.did, member(actor, ["members"])]]);
		expect(
			toMessageAuthor(actor, { members: onlyDefault, roles: withDefault }).role,
		).toBeUndefined();
		const withMod = new Map([[actor.did, member(actor, ["members", "mod"])]]);
		expect(
			toMessageAuthor(actor, { members: withMod, roles: withDefault }).role?.id,
		).toBe("mod");
	});

	it("leaves the default role out of role chips but keeps it for admin screens", () => {
		const members = role("members", 1, {
			hoisted: true,
			default: true,
		} as Partial<RoleView>);
		const mod = role("mod", 5);
		const byKey = new Map([
			["members", members],
			["mod", mod],
		]);
		const actor = profile("did:plc:joiner");
		expect(
			rolesOf(member(actor, ["members", "mod"]), (rkey) => byKey.get(rkey)),
		).toEqual([mod]);
		expect(visibleRoles([mod, members])).toEqual([mod]);
		expect(topHoistedRole([members])).toBeUndefined();
		expect(isVisibleRole(members)).toBe(true);
	});

	it("falls back to display name, then handle", () => {
		expect(displayNameOf({ displayName: " ", handle: "x.test" })).toBe(
			"x.test",
		);
		expect(displayNameOf(undefined)).toBe("Unknown user");
	});

	it("labels bridged authors", () => {
		expect(bridgePlatformName("matrix")).toBe("Matrix");
		expect(bridgePlatformName("zulip")).toBe("Zulip");
		expect(
			viaLabel(
				profile("did:plc:b", {
					bridge: { registration: "3l", platform: "matrix", remoteId: "@b" },
				} as Partial<ProfileView>),
			),
		).toBe("Matrix");
	});
});

describe("attachments", () => {
	const attachment = (mimeType: string, extra: Partial<AttachmentView> = {}) =>
		({
			url: `https://example.com/files/${mimeType.replace("/", ".")}`,
			mimeType,
			...extra,
		}) as AttachmentView;

	it("splits by mime type and keeps dimensions", () => {
		const result = splitAttachments([
			attachment("image/png", { width: 800, height: 600 }),
			attachment("image/gif"),
			attachment("video/mp4", { width: 1280, height: 720 }),
			attachment("audio/mpeg", { name: "song.mp3", size: 1000 }),
			attachment("application/pdf", { name: "doc.pdf", size: 2048 }),
		]);
		expect(result.media.map((item) => item.kind)).toEqual([
			"image",
			"gif",
			"video",
		]);
		expect(result.media[0]).toMatchObject({ width: 800, height: 600 });
		expect(result.media[2]).toMatchObject({ mimeType: "video/mp4" });
		expect(result.audio[0]).toMatchObject({ name: "song.mp3", size: 1000 });
		expect(result.files[0]).toMatchObject({
			name: "doc.pdf",
			mimeType: "application/pdf",
		});
	});

	it("carries the spoiler flag to media, audio and files", () => {
		const result = splitAttachments([
			attachment("image/png", { spoiler: true }),
			attachment("image/jpeg"),
			attachment("audio/mpeg", { name: "song.mp3", spoiler: true }),
			attachment("application/pdf", { name: "doc.pdf", spoiler: true }),
		]);
		expect(result.media.map((item) => item.spoiler)).toEqual([true, undefined]);
		expect(result.audio[0]?.spoiler).toBe(true);
		expect(result.files[0]?.spoiler).toBe(true);
	});

	it("drops suppressed embeds and maps images", () => {
		const embeds = [
			{
				uri: "https://a.test",
				title: "A",
				image: { url: "https://a.test/i.png", width: 10, height: 5 },
			},
			{ uri: "https://b.test" },
		];
		const visible = visibleEmbeds(
			embeds as never,
			embedSuppression({ suppressedEmbeds: ["https://b.test"] as never }),
		);
		expect(visible).toHaveLength(1);
		expect(toLinkEmbedProps(visible[0] as never)).toEqual({
			url: "https://a.test",
			siteName: undefined,
			title: "A",
			description: undefined,
			image: { src: "https://a.test/i.png", width: 10, height: 5 },
		});
	});
});

describe("embed suppression", () => {
	const label = (scope?: string[]) => ({
		src: "did:web:app.test",
		val: "embeds-suppressed",
		scope,
		createdAt: "2026-10-14T00:00:00.000Z",
	});

	it("splits author and moderator suppression", () => {
		const state = embedSuppression({
			suppressedEmbeds: ["https://a.test"] as never,
			labels: [label(["https://a.test", "https://b.test"])] as never,
		});
		expect(state).toEqual({
			all: false,
			author: ["https://a.test"],
			moderator: ["https://b.test"],
		});
		const embeds = [
			{ uri: "https://a.test" },
			{ uri: "https://b.test" },
			{ uri: "https://c.test" },
		];
		expect(
			visibleEmbeds(embeds as never, state).map((embed) => embed.uri),
		).toEqual(["https://c.test"]);
	});

	it("hides every preview for an unscoped label", () => {
		const state = embedSuppression({ labels: [label()] as never });
		expect(state.all).toBe(true);
		expect(visibleEmbeds([{ uri: "https://a.test" }] as never, state)).toEqual(
			[],
		);
	});

	it("ignores unrelated labels", () => {
		expect(
			embedSuppression({
				labels: [{ ...label(["https://a.test"]), val: "hidden" }] as never,
			}),
		).toEqual({ all: false, author: [], moderator: [] });
	});
});

describe("gif attachments", () => {
	it("finds a lone GIF", () => {
		expect(
			gifOfAttachments([
				{
					url: "https://media.test/cat.gif",
					mimeType: "image/gif",
					name: "Cat typing.gif",
					width: 480,
					height: 270,
				},
			] as AttachmentView[]),
		).toEqual({
			id: "https://media.test/cat.gif",
			url: "https://media.test/cat.gif",
			previewUrl: "https://media.test/cat.gif",
			width: 480,
			height: 270,
			title: "Cat typing",
		});
	});

	it("skips other media and albums", () => {
		const gif = {
			url: "https://media.test/a.gif",
			mimeType: "image/gif",
		} as AttachmentView;
		expect(gifOfAttachments([gif, gif])).toBeUndefined();
		expect(
			gifOfAttachments([
				{ url: "https://media.test/a.png", mimeType: "image/png" },
			] as AttachmentView[]),
		).toBeUndefined();
		expect(gifOfAttachments(undefined)).toBeUndefined();
	});
});

describe("inline media embeds", () => {
	const embed = (value: Partial<LinkEmbed> & { uri: string }) =>
		value as LinkEmbed;
	const proxied =
		"https://appview.test/xrpc/social.colibri.beta.embed.getImage?url=x";

	it("shows a GIF site link as its animated image", () => {
		expect(
			inlineMediaOf(
				embed({
					uri: "https://tenor.com/view/touhou-fumo-plushie-plush-hello-gif-21004226",
					siteName: "Tenor",
					title: "Touhou Fumo GIF",
					image: { url: proxied, width: 438, height: 498 },
					video: {
						url: "https://appview.test/video",
						mimeType: "video/mp4",
						width: 498,
						height: 566,
					},
				}),
			),
		).toEqual({
			src: proxied,
			kind: "gif",
			width: 438,
			height: 498,
			alt: "Touhou Fumo GIF",
		});
	});

	it("shows direct image and video links as media", () => {
		expect(
			inlineMediaOf(
				embed({
					uri: "https://media.test/cat.webp?x=1",
					image: { url: proxied },
				}),
			),
		).toMatchObject({ kind: "gif", src: proxied });
		expect(
			inlineMediaOf(
				embed({ uri: "https://media.test/cat.JPG", image: { url: proxied } }),
			),
		).toMatchObject({ kind: "image", src: proxied });
		expect(
			inlineMediaOf(
				embed({
					uri: "https://media.test/clip.mp4",
					video: { url: "https://appview.test/video", mimeType: "video/mp4" },
				}),
			),
		).toMatchObject({ kind: "video", src: "https://appview.test/video" });
	});

	it("leaves ordinary pages and imageless GIF links as cards", () => {
		expect(
			inlineMediaOf(
				embed({
					uri: "https://example.com/post",
					title: "A post",
					image: { url: proxied },
				}),
			),
		).toBeUndefined();
		expect(
			inlineMediaOf(embed({ uri: "https://giphy.com/", title: "GIPHY" })),
		).toBeUndefined();
	});

	it("matches GIF sites and their subdomains only", () => {
		expect(isGifSiteUrl("https://media.giphy.com/media/x/giphy.gif")).toBe(
			true,
		);
		expect(isGifSiteUrl("https://klipy.com/gifs/anime-maid-7")).toBe(true);
		expect(isGifSiteUrl("https://nottenor.com/view/x")).toBe(false);
		expect(isGifSiteUrl("not a url")).toBe(false);
	});
});

describe("bluesky posts", () => {
	it("parses post links on known clients", () => {
		expect(
			parseBlueskyPostUrl("https://bsky.app/profile/ana.test/post/3labc"),
		).toEqual({ authority: "ana.test", rkey: "3labc" });
		expect(
			parseBlueskyPostUrl("https://mu.social/profile/did:plc:a/post/3l"),
		).toEqual({ authority: "did:plc:a", rkey: "3l" });
		expect(
			parseBlueskyPostUrl("https://example.com/profile/a/post/3l"),
		).toBeUndefined();
		expect(
			parseBlueskyPostUrl("https://bsky.app/profile/ana.test"),
		).toBeUndefined();
		expect(parseBlueskyPostUrl("not a url")).toBeUndefined();
	});

	it("maps a post and points it at the preferred client", () => {
		const post = toBlueskyPost(
			{
				url: "https://bsky.app/profile/did:plc:ana/post/3labc",
				author: {
					did: "did:plc:ana" as never,
					handle: "ana.test",
					displayName: "Ana",
				},
				text: "Hello",
				createdAt: "2026-10-14T10:00:00.000Z" as never,
				images: [{ url: "https://img.test/1.jpg", width: 4, height: 3 }],
				likeCount: 3,
			},
			{ base: "mu.social" },
			new Date("2026-10-14T12:00:00.000Z"),
		);
		expect(post).toMatchObject({
			author: { name: "Ana", handle: "ana.test", did: "did:plc:ana" },
			time: "2h",
			text: "Hello",
			url: "https://mu.social/profile/ana.test/post/3labc",
			images: [{ src: "https://img.test/1.jpg", kind: "image" }],
			stats: { replies: 0, reposts: 0, likes: 3 },
		});
	});
});

describe("reactions", () => {
	const ada = profile("did:plc:ada");
	const members = new Map([[ada.did, member(ada, [])]]);
	const views = [
		{
			emoji: "🐦",
			count: 2,
			reactors: ["did:plc:ada", "did:plc:viewer"],
			viewerReacted: true,
		},
		{
			emoji: "🌿",
			count: 1,
			reactors: [],
			bridgedReactors: [
				{ registration: "3l", platform: "matrix", remoteId: "@x", name: "Xan" },
			],
		},
	] as unknown as ReactionView[];

	it("maps chips with names and viewer state", () => {
		expect(toReactions(views, members)).toEqual([
			{ emoji: "🐦", count: 2, mine: true, reactors: ["ada", "Unknown user"] },
			{ emoji: "🌿", count: 1, mine: false, reactors: ["Xan"] },
		]);
	});

	it("builds viewer groups including bridged reactors", () => {
		const groups = toReactionGroups(views, members, "did:plc:viewer");
		expect(groups[0]?.reactors.find((reactor) => reactor.mine)?.id).toBe(
			"did:plc:viewer",
		);
		expect(groups[1]?.reactors[0]).toMatchObject({
			name: "Xan",
			via: "Matrix",
		});
	});

	it("toggles optimistically", () => {
		const removed = toggleReaction(views, "🐦", "did:plc:viewer", false);
		expect(removed[0]).toMatchObject({ count: 1, viewerReacted: false });
		const added = toggleReaction(views, "🔥", "did:plc:viewer", true);
		expect(added.at(-1)).toMatchObject({
			emoji: "🔥",
			count: 1,
			viewerReacted: true,
		});
		const gone = toggleReaction(
			[
				{
					emoji: "x",
					count: 1,
					reactors: ["did:plc:viewer"],
					viewerReacted: true,
				},
			] as unknown as ReactionView[],
			"x",
			"did:plc:viewer",
			false,
		);
		expect(gone).toEqual([]);
	});

	it("resolves a custom reaction by its emoji record before its name", () => {
		const uri = "at://did:plc:ada/social.colibri.beta.emoji/party";
		const byName = vi.fn(() => ({ name: "party", src: "/scope.gif" }));
		const byUri = vi.fn((wanted: string) =>
			wanted === uri ? { name: "party", src: "/ada.gif" } : undefined,
		);
		const resolve = customReactionResolver(byName, byUri);

		expect(resolve({ emoji: ":party:", customEmoji: { uri } })).toEqual({
			name: "party",
			src: "/ada.gif",
		});
		expect(
			resolve({
				emoji: ":party:",
				customEmoji: { uri: "at://did:plc:bob/social.colibri.beta.emoji/x" },
			}),
		).toBeUndefined();
		expect(byName).not.toHaveBeenCalled();
		expect(resolve({ emoji: ":party:" })).toEqual({
			name: "party",
			src: "/scope.gif",
		});
		expect(resolve({ emoji: "🎉", customEmoji: { uri } })).toBeUndefined();
	});
});

describe("forward", () => {
	const base = {
		source: {
			space: "at://did:plc:here/space/social.colibri.beta.channel.text/mods",
			did: "did:plc:ada",
			rkey: "1",
		},
		createdAt: "2026-01-01T00:00:00.000Z",
		text: "hi",
		attachments: [],
	};
	const context = {
		currentCommunity: "did:plc:here",
		channelBySpace: () => undefined,
		communities: new Map([
			[
				"did:plc:other",
				{
					did: "did:plc:other",
					name: "Night Owls",
					picture: "p",
					handle: "nightowls.art",
				} as never,
			],
			[
				"did:plc:here",
				{
					did: "did:plc:here",
					name: "HQ",
					handle: "hq.colibri.social",
				} as never,
			],
		]),
	};

	it("never exposes the original author", () => {
		const display = toForwardDisplay(
			{ ...base, sourceName: "general" } as unknown as ForwardView,
			context,
		);
		expect(JSON.stringify(display)).not.toContain("did:plc:ada");
		expect(display).not.toHaveProperty("author");
	});

	it("shows the Space for a source in another Space you belong to", () => {
		const display = toForwardDisplay(
			{
				...base,
				sourceName: "showcase",
				sourceCommunity: "did:plc:other",
			} as unknown as ForwardView,
			context,
		);
		expect(display.source).toEqual({
			channel: "showcase",
			space: "Night Owls",
			spaceIconSrc: "p",
		});
	});

	it("falls back to a visible local channel", () => {
		const display = toForwardDisplay(base as unknown as ForwardView, {
			...context,
			channelBySpace: () => ({ name: "mods" }) as never,
		});
		expect(display.source).toEqual({ channel: "mods" });
	});

	it("hides the source without access", () => {
		const display = toForwardDisplay(base as unknown as ForwardView, context);
		expect(display.source).toBeUndefined();
	});
	it("targets a channel in the current Space", () => {
		const display = toForwardDisplay(base as unknown as ForwardView, {
			...context,
			channelBySpace: () => ({ name: "mods" }) as never,
		});
		expect(display.target).toEqual({
			space: "did:plc:here",
			channel: "mods",
			channelType: "social.colibri.beta.channel.text",
		});
	});

	it("targets a thread through its parent channel", () => {
		const display = toForwardDisplay(
			{
				...base,
				source: {
					...base.source,
					space:
						"at://did:plc:here/space/social.colibri.beta.channel.thread/t1",
				},
			} as unknown as ForwardView,
			{
				...context,
				threadNameBySpace: () => "Spring tuning",
				threadChannelBySpace: () =>
					"at://did:plc:here/space/social.colibri.beta.channel.text/dev",
			},
		);
		expect(display.target).toEqual({
			space: "did:plc:here",
			channel: "dev",
			channelType: "social.colibri.beta.channel.text",
			thread: "t1",
		});
	});

	it("targets a channel in another Space you belong to", () => {
		const display = toForwardDisplay(
			{
				...base,
				source: {
					...base.source,
					space:
						"at://did:plc:other/space/social.colibri.beta.channel.text/showcase",
				},
				sourceName: "showcase",
				sourceCommunity: "did:plc:other",
			} as unknown as ForwardView,
			context,
		);
		expect(display.target).toEqual({
			space: "did:plc:other",
			channel: "showcase",
			channelType: "social.colibri.beta.channel.text",
		});
	});

	it("has no target outside your Spaces or without access", () => {
		expect(
			toForwardDisplay(
				{
					...base,
					sourceName: "elsewhere",
					sourceCommunity: "did:plc:stranger",
				} as unknown as ForwardView,
				context,
			).target,
		).toBeUndefined();
		expect(
			toForwardDisplay(base as unknown as ForwardView, context).target,
		).toBeUndefined();
	});
});

describe("formatAge", () => {
	const now = new Date("2026-10-10T12:00:00Z");
	it("formats compact ages", () => {
		expect(formatAge("2026-10-10T11:59:30Z", now)).toBe("now");
		expect(formatAge("2026-10-10T11:15:00Z", now)).toBe("45m");
		expect(formatAge("2026-10-10T03:00:00Z", now)).toBe("9h");
		expect(formatAge("2026-10-07T12:00:00Z", now)).toBe("3d");
		expect(formatAge("2026-09-20T12:00:00Z", now)).toBe("2w");
	});
});
