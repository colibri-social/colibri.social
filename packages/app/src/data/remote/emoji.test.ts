import { colibri, EMOJI_COLLECTIONS } from "@colibri-social/lib";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EmojiError, emojiRegistry } from "../emoji";
import type { LiveEvent } from "../source";
import { catalogFromWire, emojiBlobLocator, emojiFailure } from "./emoji";
import {
	createFakeLive,
	createFakeSession,
	json,
	xrpcError,
} from "./fake-session";
import { createRemoteSource } from "./source";

const VIEWER = "did:plc:viewer";
const COMMUNITY = "did:plc:space";
const CID = "bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiibsojllbf5xhqzy6a";
const COPY_CID = "bafkreicopycopycopycopycopycopycopycopycopycopycopycopycopy";
const ITEM = "blue.moji.collection.item";
const PACK = "blue.moji.packs.pack";
const MEMBERSHIP = "blue.moji.packs.packitem";

const wireEmoji = (owner: string, name: string, extra: object = {}) => ({
	uri: `at://${owner}/${ITEM}/${name}`,
	cid: `cid-${name}`,
	provider: "blue.moji",
	owner,
	name,
	images: [
		{
			cid: CID,
			format: "png",
			mimeType: "image/png",
			size: 10,
			animated: false,
		},
	],
	createdAt: "2026-10-18T00:00:00.000Z",
	...extra,
});

type WirePack = {
	uri: string;
	provider: string;
	owner: string;
	name: string;
	emojis: string[];
	createdAt: string;
};

const wireCatalog = (
	owner: string,
	emojis: ReturnType<typeof wireEmoji>[] = [],
	packs: WirePack[] = [],
) => ({
	catalog: { owner, emojis, packs },
});

const setup = async (
	configure?: (fake: ReturnType<typeof createFakeSession>) => void,
) => {
	const fake = createFakeSession(VIEWER);
	const live = createFakeLive();
	fake.on(
		colibri.actor.getProfile.main.nsid,
		json({ profile: { did: VIEWER, handle: "viewer.test", isBot: false } }),
	);
	fake.on(colibri.actor.getPreferences.main.nsid, json({ preferences: {} }));
	configure?.(fake);
	const source = await createRemoteSource({
		session: fake.session,
		appViewDid: "did:web:spaces-api.colibri.social",
		live: live.live,
	});
	const events: LiveEvent[] = [];
	source.subscribe((event) => events.push(event));
	return { fake, live, source, events };
};

const catalogFor = (
	fake: ReturnType<typeof createFakeSession>,
	catalogs: Record<string, object>,
) =>
	fake.on(colibri.emoji.getCatalog.main.nsid, (call) =>
		json(
			catalogs[call.params.get("owner") ?? ""] ??
				wireCatalog(call.params.get("owner") ?? ""),
		),
	);

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("catalog views", () => {
	it("builds image URLs on the AppView's blob endpoint", () => {
		const locate = emojiBlobLocator("https://spaces-api.colibri.social");
		const catalog = catalogFromWire(
			wireCatalog(COMMUNITY, [wireEmoji(COMMUNITY, "wave")]).catalog,
			locate,
		);
		expect(catalog.community).toBe(COMMUNITY);
		expect(catalog.emojis[0]).toMatchObject({
			id: `at://${COMMUNITY}/${ITEM}/wave`,
			ref: { provider: "blue.moji", owner: COMMUNITY },
			name: "wave",
			image: `https://spaces-api.colibri.social/xrpc/social.colibri.beta.blob.get?did=${encodeURIComponent(COMMUNITY)}&cid=${CID}`,
		});
	});

	it("drops an emoji without any image", () => {
		const catalog = catalogFromWire(
			wireCatalog(COMMUNITY, [wireEmoji(COMMUNITY, "ghost", { images: [] })])
				.catalog,
			emojiBlobLocator(undefined),
		);
		expect(catalog.emojis).toEqual([]);
	});
});

describe("errors", () => {
	it("turns AppView emoji errors into emoji errors", async () => {
		const { fake, source } = await setup((fake) => {
			fake.on(colibri.emoji.upload.main.nsid, xrpcError(400, "NameTaken"));
		});
		const failure = await source
			.uploadEmoji({
				community: COMMUNITY,
				name: "wave",
				file: new File([new Uint8Array([1])], "wave.png", {
					type: "image/png",
				}),
			})
			.catch((error: unknown) => error);
		expect(failure).toBeInstanceOf(EmojiError);
		expect((failure as EmojiError).code).toBe("NameTaken");
		expect(fake.callsTo(colibri.emoji.upload.main.nsid)).toHaveLength(1);
	});

	it("keeps other failures as they are", () => {
		const failure = emojiFailure(new Error("boom"), "emoji.upload");
		expect(failure).not.toBeInstanceOf(EmojiError);
	});
});

describe("a Space's emoji", () => {
	it("uploads the raw image to the AppView", async () => {
		const { fake, source } = await setup((fake) => {
			fake.on(
				colibri.emoji.upload.main.nsid,
				json({ emoji: wireEmoji(COMMUNITY, "wave") }),
			);
		});
		const file = new File([new Uint8Array([1, 2])], "wave.png", {
			type: "image/png",
		});

		const emoji = await source.uploadEmoji({
			community: COMMUNITY,
			name: "wave",
			file,
		});

		const call = fake.callsTo(colibri.emoji.upload.main.nsid)[0];
		expect(call?.params.get("community")).toBe(COMMUNITY);
		expect(call?.params.get("name")).toBe("wave");
		expect(call?.headers.get("content-type")).toBe("image/png");
		expect(emoji.id).toBe(`at://${COMMUNITY}/${ITEM}/wave`);
	});
});

describe("the viewer's emoji", () => {
	const stubImage = () =>
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(new Blob([new Uint8Array([1])], { type: "image/png" })),
			),
		);

	const pdsWrites = (fake: ReturnType<typeof createFakeSession>) => {
		fake.on(
			"com.atproto.repo.uploadBlob",
			json({
				blob: {
					$type: "blob",
					ref: { $link: COPY_CID },
					mimeType: "image/png",
					size: 1,
				},
			}),
		);
		fake.on("com.atproto.repo.putRecord", (call) => {
			const body = call.body as { collection: string; rkey: string };
			return json({
				uri: `at://${VIEWER}/${body.collection}/${body.rkey}`,
				cid: "cid-new",
			});
		});
		fake.on("com.atproto.repo.deleteRecord", json({}));
		fake.on("com.atproto.repo.listRecords", json({ records: [] }));
	};

	it("copies a followed emoji into the viewer's repo with its own blob", async () => {
		stubImage();
		const { fake, source, events } = await setup((fake) => {
			catalogFor(fake, {
				[COMMUNITY]: wireCatalog(COMMUNITY, [wireEmoji(COMMUNITY, "wave")]),
			});
			pdsWrites(fake);
		});

		const copy = await source.followEmoji({
			emoji: `at://${COMMUNITY}/${ITEM}/wave`,
		});

		const put = fake.callsTo("com.atproto.repo.putRecord")[0]?.body as {
			collection: string;
			rkey: string;
			record: {
				copyOf: string;
				formats: { png_128: { ref: { $link: string } } };
			};
		};
		expect(put.collection).toBe(ITEM);
		expect(put.rkey).toBe("wave");
		expect(put.record.copyOf).toBe(`at://${COMMUNITY}/${ITEM}/wave`);
		expect(put.record.formats.png_128.ref.$link).toBe(COPY_CID);
		expect(copy.copyOf).toBe(`at://${COMMUNITY}/${ITEM}/wave`);
		const event = events.findLast((entry) => entry.$type === "emojiEvent");
		expect(event?.$type === "emojiEvent" && event.catalog.community).toBe(
			VIEWER,
		);
	});

	it("gives a copy a free name when the viewer already has one", async () => {
		stubImage();
		const { fake, source } = await setup((fake) => {
			catalogFor(fake, {
				[COMMUNITY]: wireCatalog(COMMUNITY, [wireEmoji(COMMUNITY, "wave")]),
				[VIEWER]: wireCatalog(VIEWER, [wireEmoji(VIEWER, "wave")]),
			});
			pdsWrites(fake);
		});

		await source.followEmoji({ emoji: `at://${COMMUNITY}/${ITEM}/wave` });

		const put = fake.callsTo("com.atproto.repo.putRecord")[0]?.body as {
			rkey: string;
		};
		expect(put.rkey).toBe("wave_2");
	});

	it("follows a pack as copies plus a pack and its memberships", async () => {
		stubImage();
		const pack = {
			uri: `at://${COMMUNITY}/${PACK}/3pack`,
			provider: "blue.moji",
			owner: COMMUNITY,
			name: "Waves",
			emojis: [
				`at://${COMMUNITY}/${ITEM}/wave`,
				`at://${COMMUNITY}/${ITEM}/hello`,
			],
			createdAt: "2026-10-18T00:00:00.000Z",
		};
		const { fake, source } = await setup((fake) => {
			catalogFor(fake, {
				[COMMUNITY]: wireCatalog(
					COMMUNITY,
					[wireEmoji(COMMUNITY, "wave"), wireEmoji(COMMUNITY, "hello")],
					[pack],
				),
			});
			pdsWrites(fake);
		});

		const followed = await source.followEmojiPack({
			community: COMMUNITY,
			pack: pack.uri,
		});

		const collections = fake
			.callsTo("com.atproto.repo.putRecord")
			.map((call) => (call.body as { collection: string }).collection);
		expect(collections).toEqual([ITEM, ITEM, PACK, MEMBERSHIP, MEMBERSHIP]);
		expect(followed.emojis).toEqual([
			`at://${VIEWER}/${ITEM}/wave`,
			`at://${VIEWER}/${ITEM}/hello`,
		]);
	});

	it("unfollows by deleting the copy", async () => {
		const { fake, source } = await setup((fake) => {
			catalogFor(fake, {
				[VIEWER]: wireCatalog(VIEWER, [
					wireEmoji(VIEWER, "wave", {
						copyOf: `at://${COMMUNITY}/${ITEM}/wave`,
					}),
				]),
			});
			pdsWrites(fake);
		});

		await source.unfollowEmoji({ emoji: `at://${COMMUNITY}/${ITEM}/wave` });

		const deleted = fake.callsTo("com.atproto.repo.deleteRecord")[0]?.body as {
			collection: string;
			rkey: string;
		};
		expect(deleted).toMatchObject({ collection: ITEM, rkey: "wave" });
	});

	it("uploads a personal emoji straight to the viewer's repo", async () => {
		const { fake, source } = await setup((fake) => {
			catalogFor(fake, {});
			pdsWrites(fake);
		});
		const file = new File([new Uint8Array([1])], "mine.png", {
			type: "image/png",
		});

		const emoji = await source.uploadEmoji({
			community: VIEWER,
			name: "mine",
			file,
		});

		expect(fake.callsTo(colibri.emoji.upload.main.nsid)).toEqual([]);
		expect(fake.callsTo("com.atproto.repo.uploadBlob")).toHaveLength(1);
		expect(emoji.id).toBe(`at://${VIEWER}/${ITEM}/mine`);
	});
});

describe("scopes", () => {
	it("asks for every collection the emoji providers write", () => {
		const written = emojiRegistry.providers.flatMap((provider) =>
			Object.values(provider.collections).filter(
				(collection): collection is string => !!collection,
			),
		);
		expect([...EMOJI_COLLECTIONS].sort()).toEqual([...new Set(written)].sort());
	});
});
