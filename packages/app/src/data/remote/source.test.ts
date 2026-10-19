import { type ColibriError, colibri } from "@colibri-social/lib";
import { describe, expect, it } from "vitest";
import { DEFAULT_COMPOSER } from "../preferences/types";
import { type DataSource, TransferOwnershipError } from "../source";
import type { MessageView, SpaceRef } from "../types";
import {
	createFakeLive,
	createFakeSession,
	json,
	type RecordedCall,
	xrpcError,
} from "./fake-session";
import { createRemoteSource, isNotEnabled } from "./source";

const VIEWER = "did:plc:viewer";
const OTHER = "did:plc:other";
const COMMUNITY = "did:plc:space";
const CHANNEL =
	`at://${COMMUNITY}/space/social.colibri.beta.channel.text/general` as SpaceRef;
const VOICE =
	`at://${COMMUNITY}/space/social.colibri.beta.channel.voice/lounge` as SpaceRef;
const THREAD =
	`at://${COMMUNITY}/space/social.colibri.beta.channel.thread/t1` as SpaceRef;

const profileOf = (did: string) => ({
	did,
	handle: `${did.slice(8)}.test`,
	displayName: did.slice(8),
	isBot: false,
	syncBluesky: false,
});

const message = (rkey: string, author = OTHER, text = "hello") =>
	({
		uri: `${CHANNEL}/${author}/social.colibri.beta.message/${rkey}`,
		rkey,
		channel: CHANNEL,
		author: profileOf(author),
		text,
		createdAt: "2026-10-14T10:00:00.000Z",
		attachments: [],
		reactions: [],
		labels: [],
	}) as unknown as MessageView;

const setup = async (
	configure?: (fake: ReturnType<typeof createFakeSession>) => void,
) => {
	const fake = createFakeSession(VIEWER);
	const live = createFakeLive();
	fake.on(
		colibri.actor.getProfile.main.nsid,
		json({ profile: profileOf(VIEWER) }),
	);
	fake.on(
		colibri.actor.getPreferences.main.nsid,
		json({
			preferences: {
				notificationLevel: "all",
				communityOrder: [],
				mutes: [],
				gifFavorites: [{ id: "gif-1", url: "https://gif.test/1.gif" }],
			},
		}),
	);
	configure?.(fake);
	const source = await createRemoteSource({
		session: fake.session,
		appViewDid: "did:web:spaces-api.colibri.social",
		live: live.live,
	});
	return { fake, live, source };
};

const withMessages = async (
	source: DataSource,
	fake: ReturnType<typeof createFakeSession>,
	messages: MessageView[],
) => {
	fake.on(colibri.channel.listMessages.main.nsid, json({ messages }));
	await source.listMessages({ channel: CHANNEL });
};

const only = (calls: RecordedCall[]) => {
	expect(calls).toHaveLength(1);
	return calls[0] as RecordedCall;
};

describe("createRemoteSource", () => {
	it("loads the viewer and GIF favorites up front", async () => {
		const { source } = await setup();
		expect(source.viewer().did).toBe(VIEWER);
		expect(source.gifFavorites().map((gif) => gif.id)).toEqual(["gif-1"]);
	});

	it("still starts when preferences fail to load", async () => {
		const { source } = await setup((fake) =>
			fake.on(colibri.actor.getPreferences.main.nsid, json({}, 500)),
		);
		expect(source.gifFavorites()).toEqual([]);
	});

	it("lists communities, channels, categories, roles and members", async () => {
		const { fake, source } = await setup((fake) => {
			fake.on(
				colibri.actor.listCommunities.main.nsid,
				json({ communities: [{ did: COMMUNITY }] }),
			);
			fake.on(
				colibri.community.listChannels.main.nsid,
				json({ channels: [{ space: CHANNEL }] }),
			);
			fake.on(
				colibri.community.listCategories.main.nsid,
				json({ categories: [{ rkey: "c1" }] }),
			);
			fake.on(
				colibri.community.listRoles.main.nsid,
				json({ roles: [{ rkey: "r1" }] }),
			);
			fake.on(
				colibri.community.listMembers.main.nsid,
				json({ members: [{ actor: profileOf(OTHER) }], cursor: "next" }),
			);
		});

		expect(await source.listCommunities()).toEqual([{ did: COMMUNITY }]);
		expect(await source.listChannels(COMMUNITY)).toEqual([{ space: CHANNEL }]);
		expect(await source.listCategories(COMMUNITY)).toEqual([{ rkey: "c1" }]);
		expect(await source.listRoles(COMMUNITY)).toEqual([{ rkey: "r1" }]);
		const members = await source.listMembers(COMMUNITY, { limit: 10 });
		expect(members.cursor).toBe("next");
		const call = only(fake.callsTo(colibri.community.listMembers.main.nsid));
		expect(call.params.get("limit")).toBe("10");
	});

	it("passes procedure input in the body", async () => {
		const { fake, source } = await setup((fake) => {
			fake.on(
				colibri.channel.create.main.nsid,
				json({ channel: { space: CHANNEL } }),
			);
			fake.on(colibri.category.delete.main.nsid, json({}));
			fake.on(colibri.role.update.main.nsid, json({ role: { rkey: "r1" } }));
		});

		await source.createChannel({
			community: COMMUNITY,
			type: "social.colibri.beta.channel.text",
			name: "general",
			category: "c1",
		});
		await source.deleteCategory({ community: COMMUNITY, category: "c1" });
		await source.updateRole({ community: COMMUNITY, role: "r1", name: "Mods" });

		expect(only(fake.callsTo(colibri.channel.create.main.nsid)).body).toEqual({
			community: COMMUNITY,
			type: "social.colibri.beta.channel.text",
			name: "general",
			category: "c1",
		});
		expect(only(fake.callsTo(colibri.category.delete.main.nsid)).body).toEqual({
			community: COMMUNITY,
			category: "c1",
		});
		expect(only(fake.callsTo(colibri.role.update.main.nsid)).body).toEqual({
			community: COMMUNITY,
			role: "r1",
			name: "Mods",
		});
	});

	it("registers and removes push endpoints through the body", async () => {
		const { fake, source } = await setup((fake) => {
			fake.on(colibri.notification.registerPush.main.nsid, json({}));
			fake.on(colibri.notification.unregisterPush.main.nsid, json({}));
		});

		await source.registerPush({
			provider: "apns",
			platform: "ios",
			token: "ab12",
			environment: "sandbox",
		});
		await source.unregisterPush({ provider: "apns", token: "ab12" });

		expect(
			only(fake.callsTo(colibri.notification.registerPush.main.nsid)).body,
		).toEqual({
			provider: "apns",
			platform: "ios",
			token: "ab12",
			environment: "sandbox",
		});
		expect(
			only(fake.callsTo(colibri.notification.unregisterPush.main.nsid)).body,
		).toEqual({ provider: "apns", token: "ab12" });
	});

	it("pages messages with the AppView cursor", async () => {
		const { fake, source } = await setup((fake) =>
			fake.on(
				colibri.channel.listMessages.main.nsid,
				json({ messages: [message("3"), message("2")], cursor: "2" }),
			),
		);

		const page = await source.listMessages({
			channel: CHANNEL,
			limit: 2,
			cursor: "4",
		});

		expect(page.items.map((item) => item.rkey)).toEqual(["3", "2"]);
		expect(page.cursor).toBe("2");
		const call = only(fake.callsTo(colibri.channel.listMessages.main.nsid));
		expect(call.params.get("channel")).toBe(CHANNEL);
		expect(call.params.get("cursor")).toBe("4");
	});

	it("loads messages around one and keeps both cursors", async () => {
		const { fake, source } = await setup((fake) =>
			fake.on(
				colibri.channel.listMessages.main.nsid,
				json({
					messages: [message("6"), message("5"), message("4")],
					cursor: "4",
					forwardCursor: "6",
				}),
			),
		);

		const page = await source.listMessages({
			channel: CHANNEL,
			limit: 3,
			around: "5",
		});

		expect(page.cursor).toBe("4");
		expect(page.forwardCursor).toBe("6");
		const call = only(fake.callsTo(colibri.channel.listMessages.main.nsid));
		expect(call.params.get("around")).toBe("5");
	});

	it("writes a message record into the channel space", async () => {
		const { fake, source } = await setup((fake) =>
			fake.on(
				"com.atproto.space.createRecord",
				json({ uri: "at://x", cid: "c" }),
			),
		);
		await withMessages(source, fake, [message("2")]);

		const view = await source.sendMessage({
			channel: CHANNEL,
			text: "hi there",
			parent: "2",
		});

		const call = only(fake.callsTo("com.atproto.space.createRecord"));
		const body = call.body as Record<string, any>;
		expect(call.headers.has("atproto-proxy")).toBe(false);
		expect(body.space).toBe(CHANNEL);
		expect(body.repo).toBe(VIEWER);
		expect(body.collection).toBe("social.colibri.beta.message");
		expect(body.rkey).toBe(view.rkey);
		expect(body.record.text).toBe("hi there");
		expect(body.record.parent).toEqual({ did: OTHER, rkey: "2" });
		expect(view.author.did).toBe(VIEWER);
		expect(view.uri).toBe(
			`${CHANNEL}/${VIEWER}/social.colibri.beta.message/${view.rkey}`,
		);
		expect((view.parent as MessageView | undefined)?.rkey).toBe("2");
	});

	it("attaches uploaded blobs to a sent message", async () => {
		const blob = {
			$type: "blob",
			ref: { $link: "bafy" },
			mimeType: "image/png",
			size: 3,
		};
		const { fake, source } = await setup((fake) => {
			fake.on("com.atproto.repo.uploadBlob", json({ blob }));
			fake.on("com.atproto.space.createRecord", json({ uri: "x", cid: "c" }));
		});
		const progress: number[] = [];

		const attachment = await source.uploadBlob(
			new File(["png"], "cat.png", { type: "image/png" }),
			{ onProgress: (fraction) => progress.push(fraction) },
		);
		await source.sendMessage({
			channel: CHANNEL,
			text: "",
			attachments: [attachment],
		});

		expect(progress).toEqual([0, 1]);
		expect(attachment.mimeType).toBe("image/png");
		const upload = only(fake.callsTo("com.atproto.repo.uploadBlob"));
		expect(upload.headers.get("content-type")).toBe("image/png");
		const record = (
			only(fake.callsTo("com.atproto.space.createRecord")).body as Record<
				string,
				any
			>
		).record;
		expect(record.attachments).toEqual([{ blob, name: "cat.png" }]);
	});

	it("writes the alt text of an attachment into the record", async () => {
		const blob = {
			$type: "blob",
			ref: { $link: "bafy" },
			mimeType: "image/png",
			size: 3,
		};
		const { fake, source } = await setup((fake) => {
			fake.on("com.atproto.repo.uploadBlob", json({ blob }));
			fake.on("com.atproto.space.createRecord", json({ uri: "x", cid: "c" }));
		});

		const uploaded = await source.uploadBlob(
			new File(["png"], "bird.png", { type: "image/png" }),
		);
		await source.sendMessage({
			channel: CHANNEL,
			text: "",
			attachments: [{ ...uploaded, alt: "A colibri at a flower" }],
		});

		const record = (
			only(fake.callsTo("com.atproto.space.createRecord")).body as Record<
				string,
				any
			>
		).record;
		expect(record.attachments).toEqual([
			{ blob, name: "bird.png", alt: "A colibri at a flower" },
		]);
	});

	it("reads the account host from the session before the DID document", async () => {
		const fake = createFakeSession(VIEWER);
		fake.on(
			colibri.actor.getProfile.main.nsid,
			json({ profile: profileOf(VIEWER) }),
		);
		const source = await createRemoteSource({
			session: { ...fake.session, accountHost: () => "pds.example.com" },
			appViewDid: "did:web:spaces-api.colibri.social",
			live: createFakeLive().live,
		});
		expect(await source.accountHost()).toBe("pds.example.com");
	});

	it("writes the spoiler flag of an attachment into the record", async () => {
		const blob = {
			$type: "blob",
			ref: { $link: "bafy" },
			mimeType: "image/png",
			size: 3,
		};
		const { fake, source } = await setup((fake) => {
			fake.on("com.atproto.repo.uploadBlob", json({ blob }));
			fake.on("com.atproto.space.createRecord", json({ uri: "x", cid: "c" }));
		});

		const hidden = await source.uploadBlob(
			new File(["png"], "ending.png", { type: "image/png" }),
		);
		const plain = await source.uploadBlob(
			new File(["png"], "cat.png", { type: "image/png" }),
		);
		const view = await source.sendMessage({
			channel: CHANNEL,
			text: "",
			attachments: [{ ...hidden, spoiler: true }, plain],
		});

		const record = (
			only(fake.callsTo("com.atproto.space.createRecord")).body as Record<
				string,
				any
			>
		).record;
		expect(record.attachments).toEqual([
			{ blob, name: "ending.png", spoiler: true },
			{ blob, name: "cat.png" },
		]);
		expect(
			(view.attachments[0] as { spoiler?: boolean } | undefined)?.spoiler,
		).toBe(true);
	});

	it("refuses attachments it did not upload", async () => {
		const { source } = await setup();
		const failure = await source
			.sendMessage({
				channel: CHANNEL,
				text: "",
				attachments: [
					{
						url: "https://elsewhere.test/a.png",
						mimeType: "image/png",
					} as never,
				],
			})
			.then(
				() => undefined,
				(error: unknown) => error as ColibriError,
			);
		expect(failure?.code).toBe("UploadFailed");
	});

	it("edits a message by rewriting its stored record", async () => {
		const { fake, source } = await setup((fake) => {
			fake.on(
				"com.atproto.space.getRecord",
				json({
					uri: "x",
					value: {
						$type: "social.colibri.beta.message",
						text: "old",
						createdAt: "2026-10-14T10:00:00.000Z",
						facets: [{ index: {} }],
					},
				}),
			);
			fake.on("com.atproto.space.putRecord", json({ uri: "x", cid: "c" }));
		});
		await withMessages(source, fake, [message("5", VIEWER, "old")]);

		const next = await source.editMessage({
			channel: CHANNEL,
			rkey: "5",
			text: "new",
		});

		const record = (
			only(fake.callsTo("com.atproto.space.putRecord")).body as Record<
				string,
				any
			>
		).record;
		expect(record.text).toBe("new");
		expect(record.createdAt).toBe("2026-10-14T10:00:00.000Z");
		expect(record.facets).toBeUndefined();
		expect(record.updatedAt).toBeTypeOf("string");
		expect(next.text).toBe("new");
		expect(next.updatedAt).toBe(record.updatedAt);
	});

	it("replays writes for messages it hasn't loaded", async () => {
		const { fake, source } = await setup((fake) => {
			fake.on(
				"com.atproto.space.getRecord",
				json({
					uri: "x",
					value: {
						$type: "social.colibri.beta.message",
						text: "old",
						createdAt: "2026-10-14T10:00:00.000Z",
					},
				}),
			);
			fake.on("com.atproto.space.putRecord", json({ uri: "x", cid: "c" }));
			fake.on("com.atproto.space.createRecord", json({ uri: "x", cid: "c" }));
		});

		const edited = await source.editMessage({
			channel: CHANNEL,
			rkey: "5",
			text: "new",
		});
		await source.sendMessage({
			channel: CHANNEL,
			rkey: "6",
			text: "reply",
			parent: "4",
			parentAuthor: OTHER,
		});
		await source.react({
			channel: CHANNEL,
			rkey: "4",
			emoji: "🔥",
			add: true,
			author: OTHER,
			reaction: "r1",
		});

		expect(edited.text).toBe("new");
		expect(edited.createdAt).toBe("2026-10-14T10:00:00.000Z");
		const [reply, reaction] = fake
			.callsTo("com.atproto.space.createRecord")
			.map((call) => call.body as Record<string, any>);
		expect(reply?.record.parent).toEqual({ did: OTHER, rkey: "4" });
		expect(reaction?.rkey).toBe("r1");
		expect(reaction?.record.target).toEqual({ did: OTHER, rkey: "4" });
	});

	it("deletes a message record and treats a missing one as gone", async () => {
		const { fake, source } = await setup((fake) =>
			fake.on(
				"com.atproto.space.deleteRecord",
				json({ error: "NotFound" }, 404),
			),
		);
		await source.deleteMessage({ channel: CHANNEL, rkey: "5" });
		const call = only(fake.callsTo("com.atproto.space.deleteRecord"));
		expect(call.body).toEqual({
			space: CHANNEL,
			repo: VIEWER,
			collection: "social.colibri.beta.message",
			rkey: "5",
		});
	});

	it("adds and removes a reaction record", async () => {
		const { fake, source } = await setup((fake) => {
			fake.on("com.atproto.space.createRecord", json({ uri: "x", cid: "c" }));
			fake.on("com.atproto.space.deleteRecord", json({}));
		});
		await withMessages(source, fake, [message("7")]);

		await source.react({ channel: CHANNEL, rkey: "7", emoji: "🔥", add: true });
		await source.react({
			channel: CHANNEL,
			rkey: "7",
			emoji: "🔥",
			add: false,
		});

		const created = only(fake.callsTo("com.atproto.space.createRecord"))
			.body as Record<string, any>;
		expect(created.collection).toBe("social.colibri.beta.reaction");
		expect(created.record).toEqual({
			$type: "social.colibri.beta.reaction",
			emoji: "🔥",
			target: { did: OTHER, rkey: "7" },
		});
		const removed = only(fake.callsTo("com.atproto.space.deleteRecord"))
			.body as Record<string, any>;
		expect(removed.rkey).toBe(created.rkey);
	});

	it("finds an older reaction record before removing it", async () => {
		const { fake, source } = await setup((fake) => {
			fake.on(
				"com.atproto.space.listRecords",
				json({
					records: [
						{
							uri: `${CHANNEL}/${VIEWER}/social.colibri.beta.reaction/old`,
							value: { emoji: "🔥", target: { did: OTHER, rkey: "7" } },
						},
					],
				}),
			);
			fake.on("com.atproto.space.deleteRecord", json({}));
		});
		await withMessages(source, fake, [message("7")]);

		await source.react({
			channel: CHANNEL,
			rkey: "7",
			emoji: "🔥",
			add: false,
		});

		const call = only(fake.callsTo("com.atproto.space.listRecords"));
		expect(call.params.get("collection")).toBe("social.colibri.beta.reaction");
		expect(
			(only(fake.callsTo("com.atproto.space.deleteRecord")).body as any).rkey,
		).toBe("old");
	});

	it("hides and unhides a message with a label", async () => {
		const label = { val: "hidden", src: COMMUNITY };
		const { fake, source } = await setup((fake) => {
			fake.on(colibri.community.applyLabel.main.nsid, json({ label }));
			fake.on(colibri.community.negateLabel.main.nsid, json({}));
		});
		await withMessages(source, fake, [message("8")]);

		const hidden = await source.setHidden({
			channel: CHANNEL,
			rkey: "8",
			hidden: true,
		});
		const shown = await source.setHidden({
			channel: CHANNEL,
			rkey: "8",
			hidden: false,
		});

		expect(
			only(fake.callsTo(colibri.community.applyLabel.main.nsid)).body,
		).toEqual({
			space: CHANNEL,
			subject: {
				did: OTHER,
				collection: "social.colibri.beta.message",
				rkey: "8",
			},
			val: "hidden",
		});
		expect(hidden.labels).toEqual([label]);
		expect(shown.labels).toEqual([]);
	});

	it("replaces a moderator's link preview label", async () => {
		const label = { val: "embeds-suppressed", src: COMMUNITY };
		const { fake, source } = await setup((fake) => {
			fake.on(colibri.community.applyLabel.main.nsid, json({ label }));
			fake.on(colibri.community.negateLabel.main.nsid, json({}));
		});
		await withMessages(source, fake, [
			{ ...message("9"), labels: [label] } as unknown as MessageView,
		]);

		const next = await source.setModeratedEmbeds({
			channel: CHANNEL,
			rkey: "9",
			uris: ["https://example.com"],
		});

		expect(fake.callsTo(colibri.community.negateLabel.main.nsid)).toHaveLength(
			1,
		);
		const applied = only(fake.callsTo(colibri.community.applyLabel.main.nsid))
			.body as Record<string, any>;
		expect(applied.scope).toEqual(["https://example.com"]);
		expect(next.labels).toEqual([label]);
	});

	it("stores author link preview removals on the record", async () => {
		const { fake, source } = await setup((fake) => {
			fake.on(
				"com.atproto.space.getRecord",
				json({ uri: "x", value: { text: "a", createdAt: "t" } }),
			);
			fake.on("com.atproto.space.putRecord", json({ uri: "x", cid: "c" }));
		});
		await withMessages(source, fake, [message("4", VIEWER)]);

		const next = await source.setSuppressedEmbeds({
			channel: CHANNEL,
			rkey: "4",
			uris: ["https://example.com"],
		});

		const record = (
			only(fake.callsTo("com.atproto.space.putRecord")).body as Record<
				string,
				any
			>
		).record;
		expect(record.suppressedEmbeds).toEqual(["https://example.com"]);
		expect(next.suppressedEmbeds).toEqual(["https://example.com"]);
	});

	it("needs the message loaded before acting on it", async () => {
		const { source } = await setup();
		const failure = await source
			.setHidden({ channel: CHANNEL, rkey: "missing", hidden: true })
			.then(
				() => undefined,
				(error: unknown) => error as ColibriError,
			);
		expect(failure?.code).toBe("MessageNotFound");
	});

	it("forwards a message with its text snapshot", async () => {
		const { fake, source } = await setup((fake) =>
			fake.on("com.atproto.space.createRecord", json({ uri: "x", cid: "c" })),
		);
		await withMessages(source, fake, [message("6", OTHER, "original")]);

		const view = await source.forwardMessage({
			from: CHANNEL,
			rkey: "6",
			to: VOICE,
			text: "look",
		});

		const body = only(fake.callsTo("com.atproto.space.createRecord"))
			.body as Record<string, any>;
		expect(body.space).toBe(VOICE);
		expect(body.record.text).toBe("look");
		expect(body.record.forward.source).toEqual({
			space: CHANNEL,
			did: OTHER,
			rkey: "6",
		});
		expect(body.record.forward.text).toBe("original");
		expect(view.forward?.sourceCommunity).toBe(COMMUNITY);
	});

	const DEV =
		`at://${COMMUNITY}/space/social.colibri.beta.channel.text/dev` as SpaceRef;
	const readSetup = (
		configure?: (fake: ReturnType<typeof createFakeSession>) => void,
	) =>
		setup((fake) => {
			fake.on(
				colibri.channel.listUnreadStatus.main.nsid,
				json({
					statuses: [
						{
							channel: VOICE,
							hasUnread: false,
							unreadMentions: 0,
							cursor: "5",
						},
					],
				}),
			);
			fake.on(colibri.channel.putReadCursors.main.nsid, json({ statuses: [] }));
			fake.on("com.atproto.space.putRecord", json({ uri: "at://x", cid: "c" }));
			configure?.(fake);
		});
	const lastCursors = (fake: ReturnType<typeof createFakeSession>) => {
		const body = fake.callsTo(colibri.channel.putReadCursors.main.nsid).at(-1)
			?.body as { community: string; cursors: { channel: string }[] };
		return {
			community: body.community,
			cursors: [...body.cursors].sort((a, b) =>
				a.channel.localeCompare(b.channel),
			),
		};
	};

	it("marks a channel read at its newest loaded message and keeps the Space's other cursors", async () => {
		const { fake, source } = await readSetup();
		await withMessages(source, fake, [message("3"), message("9")]);

		await source.markRead(CHANNEL);
		await source.flushReadCursors();

		expect(lastCursors(fake)).toEqual({
			community: COMMUNITY,
			cursors: [
				{ channel: "general", cursor: "9" },
				{ channel: "lounge", cursor: "5" },
			],
		});
		const record = fake.callsTo("com.atproto.space.putRecord").at(-1)
			?.body as Record<string, any>;
		expect(record.collection).toBe("social.colibri.beta.channel.read");
		expect(record.rkey).toBe(COMMUNITY);
		expect(record.space).toBe(
			`at://${VIEWER}/space/social.colibri.beta.actor.preferences/self`,
		);
		expect(record.record.cursors).toHaveLength(2);
	});

	it("pushes a cursor another session moved instead of the older local one", async () => {
		const { fake, live, source } = await readSetup();
		await withMessages(source, fake, [message("3"), message("7")]);

		await source.markRead(CHANNEL);
		live.emit({
			$type: "readCursorEvent",
			community: COMMUNITY,
			cursors: [{ channel: "general", cursor: "9" }],
		});
		await source.flushReadCursors();

		expect(lastCursors(fake).cursors).toEqual([
			{ channel: "general", cursor: "9" },
			{ channel: "lounge", cursor: "5" },
		]);
	});

	it("sends both channels after reading one and then another", async () => {
		const { fake, source } = await readSetup((fake) =>
			fake.on(
				colibri.channel.listMessages.main.nsid,
				json({ messages: [message("12")] }),
				json({ messages: [{ ...message("14"), channel: DEV }] }),
			),
		);

		await source.markRead(CHANNEL);
		await source.flushReadCursors();
		await source.markRead(DEV);
		await source.flushReadCursors();

		expect(lastCursors(fake).cursors).toEqual([
			{ channel: "dev", cursor: "14" },
			{ channel: "general", cursor: "12" },
			{ channel: "lounge", cursor: "5" },
		]);
		expect(
			fake.callsTo(colibri.channel.listUnreadStatus.main.nsid),
		).toHaveLength(1);
	});

	it("fetches the newest message when marking an unloaded channel read", async () => {
		const { fake, source } = await readSetup((fake) =>
			fake.on(
				colibri.channel.listMessages.main.nsid,
				json({ messages: [message("12")] }),
			),
		);

		await source.markRead(CHANNEL);
		await source.flushReadCursors();

		const listed = only(fake.callsTo(colibri.channel.listMessages.main.nsid));
		expect(listed.params.get("limit")).toBe("1");
		expect(lastCursors(fake).cursors[0]).toEqual({
			channel: "general",
			cursor: "12",
		});
	});

	it("creates the preferences space once when it's missing, then retries", async () => {
		const { fake, source } = await readSetup((fake) => {
			fake.on(
				"com.atproto.space.putRecord",
				xrpcError(400, "SpaceNotFound"),
				json({ uri: "at://x", cid: "c" }),
			);
			fake.on(
				"com.atproto.simplespace.createSpace",
				json({ uri: "at://space" }),
			);
		});
		await withMessages(source, fake, [message("9")]);

		await source.markRead(CHANNEL);
		await source.flushReadCursors();

		const created = only(fake.callsTo("com.atproto.simplespace.createSpace"));
		expect(created.body).toMatchObject({
			spaceType: "social.colibri.beta.actor.preferences",
			skey: "self",
		});
		expect(fake.callsTo("com.atproto.space.putRecord")).toHaveLength(2);
		expect(fake.callsTo(colibri.channel.putReadCursors.main.nsid)).toHaveLength(
			1,
		);
	});

	it("creates the space only once for concurrent writes", async () => {
		const OTHER_COMMUNITY = "did:plc:second";
		const elsewhere =
			`at://${OTHER_COMMUNITY}/space/social.colibri.beta.channel.text/general` as SpaceRef;
		const { fake, source } = await readSetup((fake) => {
			fake.on(
				"com.atproto.space.putRecord",
				xrpcError(400, "SpaceNotFound"),
				xrpcError(400, "SpaceNotFound"),
				json({ uri: "at://x", cid: "c" }),
			);
			fake.on("com.atproto.simplespace.createSpace", async () => {
				await new Promise((resolve) => setTimeout(resolve, 20));
				return json({ uri: "at://space" });
			});
			fake.on(
				colibri.channel.listMessages.main.nsid,
				json({ messages: [message("9")] }),
			);
		});

		await Promise.all([source.markRead(CHANNEL), source.markRead(elsewhere)]);
		await source.flushReadCursors();

		expect(fake.callsTo("com.atproto.simplespace.createSpace")).toHaveLength(1);
		expect(fake.callsTo(colibri.channel.putReadCursors.main.nsid)).toHaveLength(
			2,
		);
	});

	it("still pushes to the AppView when the space can't be created", async () => {
		const { fake, source } = await readSetup((fake) => {
			fake.on("com.atproto.space.putRecord", xrpcError(400, "SpaceNotFound"));
			fake.on(
				"com.atproto.simplespace.createSpace",
				xrpcError(500, "InternalServerError"),
			);
		});
		await withMessages(source, fake, [message("9")]);

		await source.markRead(CHANNEL);
		await source.flushReadCursors();

		expect(fake.callsTo(colibri.channel.putReadCursors.main.nsid)).toHaveLength(
			1,
		);
	});

	it("loads channel previews for a Space in one request", async () => {
		const { fake, source } = await setup((fake) =>
			fake.on(
				colibri.channel.listSummaries.main.nsid,
				json({
					summaries: [
						{
							channel: CHANNEL,
							rkey: "20",
							author: OTHER,
							text: "  latest\n line ",
							attachmentCount: 0,
							forward: false,
							createdAt: "2026-10-17T10:00:00.000Z",
						},
						{
							channel: CHANNEL,
							rkey: "21",
							author: OTHER,
							text: "",
							attachmentKind: "image",
							attachmentCount: 2,
							forward: false,
							createdAt: "2026-10-17T10:01:00.000Z",
						},
					],
				}),
			),
		);

		const summaries = await source.listChannelSummaries(COMMUNITY);

		expect(summaries).toEqual([
			expect.objectContaining({ rkey: "20", text: "latest line" }),
			expect.objectContaining({
				rkey: "21",
				text: "Sent 2 images",
				attachment: "image",
			}),
		]);
		const call = only(fake.callsTo(colibri.channel.listSummaries.main.nsid));
		expect(call.params.get("community")).toBe(COMMUNITY);
		expect(fake.callsTo(colibri.channel.listMessages.main.nsid)).toHaveLength(
			0,
		);
	});

	it("lists threads for a channel within its community", async () => {
		const { fake, source } = await setup((fake) =>
			fake.on(
				colibri.thread.listThreads.main.nsid,
				json({ threads: [{ space: THREAD }] }),
			),
		);

		expect(await source.listThreads(CHANNEL)).toEqual([{ space: THREAD }]);
		const call = only(fake.callsTo(colibri.thread.listThreads.main.nsid));
		expect(call.params.get("community")).toBe(COMMUNITY);
		expect(call.params.get("channel")).toBe(CHANNEL);
	});

	it("follows and leaves a thread with its follow record", async () => {
		const { fake, source } = await setup((fake) => {
			fake.on("com.atproto.space.putRecord", json({ uri: "x", cid: "c" }));
			fake.on("com.atproto.space.deleteRecord", json({}));
		});

		await source.followThread({ thread: THREAD, follow: true });
		await source.followThread({ thread: THREAD, follow: false });

		const put = only(fake.callsTo("com.atproto.space.putRecord"))
			.body as Record<string, any>;
		expect(put.space).toBe(THREAD);
		expect(put.collection).toBe("social.colibri.beta.thread.follow");
		expect(put.rkey).toBe("self");
		expect(
			(only(fake.callsTo("com.atproto.space.deleteRecord")).body as any).rkey,
		).toBe("self");
	});

	it("pages notifications and marks them seen", async () => {
		const { fake, source } = await setup((fake) => {
			fake.on(
				colibri.notification.listNotifications.main.nsid,
				json({ notifications: [{ id: "n1" }], cursor: "c2" }),
			);
			fake.on(colibri.notification.updateSeen.main.nsid, json({ unread: 0 }));
		});

		const page = await source.listNotifications({ limit: 5 });
		await source.updateSeen({ seenAt: "2026-10-14T10:00:00.000Z" as never });

		expect(page).toEqual({ items: [{ id: "n1" }], cursor: "c2" });
		expect(
			only(fake.callsTo(colibri.notification.updateSeen.main.nsid)).body,
		).toEqual({ seenAt: "2026-10-14T10:00:00.000Z" });
	});

	it("handles invitations and joining", async () => {
		const preview = {
			invitation: { code: "abc" },
			community: { did: COMMUNITY },
		};
		const { fake, source } = await setup((fake) => {
			fake.on(colibri.community.getInvitation.main.nsid, json(preview));
			fake.on(
				colibri.community.join.main.nsid,
				json({ status: "joined", member: { actor: profileOf(VIEWER) } }),
			);
		});

		expect(await source.getInvitation("abc")).toEqual(preview);
		const joined = await source.joinCommunity({
			community: COMMUNITY,
			invitation: "abc",
		});
		expect(joined.status).toBe("joined");
		expect(only(fake.callsTo(colibri.community.join.main.nsid)).body).toEqual({
			community: COMMUNITY,
			invitation: "abc",
		});
	});

	it("uploads Space images as raw bodies", async () => {
		const { fake, source } = await setup((fake) =>
			fake.on(
				colibri.community.putImage.main.nsid,
				json({ community: { did: COMMUNITY } }),
			),
		);
		const file = new File(["png"], "logo.png", { type: "image/png" });

		await source.putCommunityImage({
			community: COMMUNITY,
			kind: "picture",
			file,
		});

		const call = only(fake.callsTo(colibri.community.putImage.main.nsid));
		expect(call.params.get("kind")).toBe("picture");
		expect(call.headers.get("content-type")).toBe("image/png");
	});

	it("saves the profile record and reloads the viewer", async () => {
		const blob = {
			$type: "blob",
			ref: { $link: "bafy" },
			mimeType: "image/png",
			size: 3,
		};
		const { fake, source } = await setup((fake) => {
			fake.on(
				"com.atproto.repo.getRecord",
				json({
					uri: "x",
					value: {
						$type: "social.colibri.beta.actor.profile",
						displayName: "Old",
						banner: { ref: { $link: "old" } },
					},
				}),
			);
			fake.on("com.atproto.repo.uploadBlob", json({ blob }));
			fake.on("com.atproto.repo.putRecord", json({ uri: "x", cid: "c" }));
		});
		const avatar = await source.uploadBlob(
			new File(["png"], "me.png", { type: "image/png" }),
		);

		await source.putProfile({
			displayName: "New",
			avatar,
			banner: null,
			syncBluesky: false,
		});

		const body = only(fake.callsTo("com.atproto.repo.putRecord"))
			.body as Record<string, any>;
		expect(body.collection).toBe("social.colibri.beta.actor.profile");
		expect(body.rkey).toBe("self");
		expect(body.record).toEqual({
			$type: "social.colibri.beta.actor.profile",
			displayName: "New",
			avatar: blob,
			syncBluesky: false,
		});
		expect(fake.callsTo(colibri.actor.getProfile.main.nsid)).toHaveLength(2);
	});

	it.each([
		{ existing: {}, pronouns: "she/her", expected: "she/her" },
		{ existing: { pronouns: "he/him" }, pronouns: null, expected: undefined },
		{ existing: { pronouns: "he/him" }, pronouns: "", expected: "" },
		{
			existing: { pronouns: "he/him" },
			pronouns: undefined,
			expected: "he/him",
		},
	])("writes pronouns $pronouns over $existing", async ({
		existing,
		pronouns,
		expected,
	}) => {
		const { fake, source } = await setup((fake) => {
			fake.on(
				"com.atproto.repo.getRecord",
				json({ uri: "x", value: { syncBluesky: true, ...existing } }),
			);
			fake.on("com.atproto.repo.putRecord", json({ uri: "x", cid: "c" }));
		});

		await source.putProfile({ syncBluesky: true, pronouns });

		const body = only(fake.callsTo("com.atproto.repo.putRecord"))
			.body as Record<string, any>;
		expect(body.record.pronouns).toBe(expected);
	});

	it.each([
		{ existing: {}, preferredBadge: "team", expected: "team" },
		{
			existing: { preferredBadge: "team" },
			preferredBadge: null,
			expected: undefined,
		},
		{
			existing: { preferredBadge: "team" },
			preferredBadge: undefined,
			expected: "team",
		},
	])("writes preferred badge $preferredBadge over $existing", async ({
		existing,
		preferredBadge,
		expected,
	}) => {
		const { fake, source } = await setup((fake) => {
			fake.on(
				"com.atproto.repo.getRecord",
				json({ uri: "x", value: { syncBluesky: true, ...existing } }),
			);
			fake.on("com.atproto.repo.putRecord", json({ uri: "x", cid: "c" }));
		});

		await source.putProfile({ syncBluesky: true, preferredBadge });

		const body = only(fake.callsTo("com.atproto.repo.putRecord"))
			.body as Record<string, any>;
		expect(body.record.preferredBadge).toBe(expected);
	});

	const profileRecords =
		(byCollection: Record<string, unknown>) => (call: RecordedCall) => {
			const value = byCollection[call.params.get("collection") ?? ""];
			return value === undefined
				? xrpcError(400, "RecordNotFound")
				: json({ uri: "x", value });
		};

	it.each([
		{ record: { displayName: "Me", pronouns: "" } },
		{ record: { displayName: "Me", syncBluesky: true } },
	])("treats $record as a complete profile", async ({ record }) => {
		const { fake, source } = await setup((fake) =>
			fake.on(
				"com.atproto.repo.getRecord",
				profileRecords({ "social.colibri.beta.actor.profile": record }),
			),
		);

		await expect(source.loadProfileSetup()).resolves.toEqual({
			complete: true,
		});
		expect(fake.callsTo("com.atproto.repo.getRecord")).toHaveLength(1);
	});

	it("seeds an incomplete profile from the old record and Bluesky", async () => {
		const image = (cid: string) => ({
			$type: "blob",
			ref: { $link: cid },
			mimeType: "image/png",
			size: 3,
		});
		const { fake, source } = await setup((fake) => {
			fake.on(
				"com.atproto.repo.getRecord",
				profileRecords({
					"social.colibri.actor.profile": {
						displayName: "Old name",
						description: "Old bio",
						avatar: image("old-avatar"),
						theme: { accentColor: "#ff0000" },
					},
					"app.bsky.actor.profile": { displayName: "Sky name" },
				}),
			);
			fake.on(
				"com.atproto.sync.getBlob",
				(call) =>
					new Response(call.params.get("cid"), {
						headers: { "content-type": "image/png" },
					}),
			);
		});

		const setupState = await source.loadProfileSetup();

		if (setupState.complete) throw new Error("expected an incomplete profile");
		expect(setupState.colibri).toMatchObject({
			displayName: "Old name",
			description: "Old bio",
			theme: { accentColor: "#ff0000" },
		});
		expect(await setupState.colibri?.avatar?.text()).toBe("old-avatar");
		expect(setupState.colibri?.banner).toBeUndefined();
		expect(setupState.bluesky).toMatchObject({ displayName: "Sky name" });
		expect(
			only(fake.callsTo("com.atproto.sync.getBlob")).params.get("did"),
		).toBe(VIEWER);
	});

	it("offers Bluesky only when the old profile mirrored it", async () => {
		const { source } = await setup((fake) =>
			fake.on(
				"com.atproto.repo.getRecord",
				profileRecords({
					"social.colibri.actor.profile": { syncBluesky: true },
					"app.bsky.actor.profile": { displayName: "Sky name" },
				}),
			),
		);

		const setupState = await source.loadProfileSetup();

		expect(setupState).toEqual({
			complete: false,
			colibri: undefined,
			bluesky: expect.objectContaining({ displayName: "Sky name" }),
		});
	});

	it("reads the default community from the AppView", async () => {
		const { source } = await setup((fake) =>
			fake.on(
				colibri.server.describeServer.main.nsid,
				json({ did: "did:web:appview.test", defaultCommunity: COMMUNITY }),
			),
		);

		await expect(source.defaultCommunity()).resolves.toBe(COMMUNITY);
	});

	it("sets status through the AppView and voice through the socket", async () => {
		const presence = { onlineState: "online", status: { text: "hi" } };
		const { live, source } = await setup((fake) =>
			fake.on(colibri.actor.setStatus.main.nsid, json({ presence })),
		);

		expect(await source.setStatus({ text: "hi" })).toEqual(presence);
		const voiced = await source.setVoice({ channel: VOICE, muted: true });
		source.typing(CHANNEL);

		expect(voiced.voice).toEqual({ channel: VOICE, muted: true });
		expect(voiced.status).toEqual({ text: "hi" });
		expect(live.sent).toEqual([
			{
				$type: "social.colibri.beta.sync.defs#setPresence",
				voice: { channel: VOICE, muted: true },
			},
			expect.objectContaining({ channel: CHANNEL }),
		]);
		expect(source.viewer().presence?.voice?.channel).toBe(VOICE);
	});

	it("writes the settings record, then pushes GIF favorites", async () => {
		const saved = [{ id: "gif-2", url: "https://gif.test/2.gif" }];
		const { fake, source } = await setup((fake) => {
			fake.on("com.atproto.space.putRecord", json({ uri: "at://x", cid: "c" }));
			fake.on(
				colibri.actor.putSettings.main.nsid,
				json({
					preferences: {
						notificationLevel: "all",
						communityOrder: [],
						mutes: [],
						gifFavorites: saved,
					},
				}),
			);
		});

		source.setGifFavorite(
			{ id: "gif-2", url: "https://gif.test/2.gif" } as never,
			true,
		);
		source.setGifFavorite({ id: "gif-1" } as never, false);
		expect(source.gifFavorites().map((gif) => gif.id)).toEqual(["gif-2"]);
		await source.preferences.settled();

		expect(source.gifFavorites().map((gif) => gif.id)).toEqual(["gif-2"]);
		const record = fake.callsTo("com.atproto.space.putRecord").at(-1)
			?.body as any;
		expect(record.collection).toBe("social.colibri.beta.actor.settings");
		expect(record.rkey).toBe("self");
		expect(record.record.gifFavorites).toEqual(saved);
		const calls = fake.callsTo(colibri.actor.putSettings.main.nsid);
		expect((calls.at(-1)?.body as any).gifFavorites).toEqual(saved);
	});

	it("takes GIF favorites changed in another session", async () => {
		const { live, source } = await setup();

		live.emit({
			$type: "preferencesEvent",
			preferences: {
				notificationLevel: "all",
				communityOrder: [],
				shareActivity: false,
				mutes: [],
				spaceLevels: {},
				spaceModeration: {},
				client: {},
				composer: DEFAULT_COMPOSER,
				gifFavorites: [{ id: "gif-3", url: "https://gif.test/3.gif" }] as never,
			},
		});

		expect(source.gifFavorites().map((gif) => gif.id)).toEqual(["gif-3"]);
	});

	it("writes only the client preferences record for a client change", async () => {
		const empty = {
			preferences: {
				notificationLevel: "all",
				communityOrder: [],
				mutes: [],
				gifFavorites: [],
			},
		};
		const { fake, source } = await setup((fake) => {
			fake.on("com.atproto.space.putRecord", json({ uri: "at://x", cid: "c" }));
			fake.on(colibri.actor.putSettings.main.nsid, json(empty));
		});

		await source.preferences.setControls({ swipeLeftAction: "reply" });

		const records = fake
			.callsTo("com.atproto.space.putRecord")
			.map((call) => call.body as any);
		expect(records.map((record) => record.collection)).toEqual([
			"social.colibri.beta.actor.clientPreferences",
		]);
		expect(records[0].rkey).toBe("self");
		expect(records[0].record.controls).toEqual({ swipeLeftAction: "reply" });
		const push = fake.callsTo(colibri.actor.putSettings.main.nsid).at(-1)
			?.body as any;
		expect(push).toEqual({
			clientPreferences: { controls: { swipeLeftAction: "reply" } },
		});
	});

	it("writes a Space level record keyed by the Space, then removes it", async () => {
		const empty = {
			preferences: {
				notificationLevel: "all",
				communityOrder: [],
				mutes: [],
				gifFavorites: [],
			},
		};
		const { fake, source } = await setup((fake) => {
			fake.on("com.atproto.space.putRecord", json({ uri: "at://x", cid: "c" }));
			fake.on("com.atproto.space.deleteRecord", json({}));
			fake.on(colibri.actor.putSpaceNotification.main.nsid, json(empty));
		});

		await source.preferences.setSpaceLevel(COMMUNITY, "mentionsAndReplies");
		await source.preferences.setSpaceLevel(COMMUNITY, undefined);

		const put = fake.callsTo("com.atproto.space.putRecord").at(-1)?.body as any;
		expect(put.collection).toBe("social.colibri.beta.actor.spaceNotification");
		expect(put.rkey).toBe(COMMUNITY);
		expect(put.record.level).toBe("mentionsAndReplies");
		const removed = fake.callsTo("com.atproto.space.deleteRecord").at(-1)
			?.body as any;
		expect(removed.rkey).toBe(COMMUNITY);
		expect(
			fake
				.callsTo(colibri.actor.putSpaceNotification.main.nsid)
				.map((call) => call.body),
		).toEqual([
			{ community: COMMUNITY, level: "mentionsAndReplies" },
			{ community: COMMUNITY, removeLevel: true },
		]);
	});

	it("writes a Space moderation record keyed by the Space, then removes it", async () => {
		const empty = {
			preferences: {
				notificationLevel: "all",
				communityOrder: [],
				mutes: [],
				gifFavorites: [],
			},
		};
		const nsid = "social.colibri.beta.actor.putSpaceModeration";
		const { fake, source } = await setup((fake) => {
			fake.on("com.atproto.space.putRecord", json({ uri: "at://x", cid: "c" }));
			fake.on("com.atproto.space.deleteRecord", json({}));
			fake.on(nsid, json(empty));
		});

		await source.preferences.setSpaceModeration(COMMUNITY, true);
		await source.preferences.setSpaceModeration(COMMUNITY, undefined);

		const put = fake.callsTo("com.atproto.space.putRecord").at(-1)?.body as any;
		expect(put.collection).toBe("social.colibri.beta.actor.spaceModeration");
		expect(put.rkey).toBe(COMMUNITY);
		expect(put.record.hideModeratedMessages).toBe(true);
		const removed = fake.callsTo("com.atproto.space.deleteRecord").at(-1)
			?.body as any;
		expect(removed.rkey).toBe(COMMUNITY);
		expect(fake.callsTo(nsid).map((call) => call.body)).toEqual([
			{ community: COMMUNITY, hideModeratedMessages: true },
			{ community: COMMUNITY, remove: true },
		]);
	});

	it("searches GIFs or lists trending ones", async () => {
		const { fake, source } = await setup((fake) => {
			fake.on(
				colibri.embed.searchGifs.main.nsid,
				json({ gifs: [{ id: "s" }] }),
			);
			fake.on(
				colibri.embed.trendingGifs.main.nsid,
				json({ gifs: [{ id: "t" }] }),
			);
		});

		expect(await source.listGifs("cats")).toEqual([{ id: "s" }]);
		expect(await source.listGifs("  ")).toEqual([{ id: "t" }]);
		expect(
			only(fake.callsTo(colibri.embed.searchGifs.main.nsid)).params.get("q"),
		).toBe("cats");
	});

	it("keeps its message index in step with live events", async () => {
		const { fake, live, source } = await setup((fake) =>
			fake.on(colibri.community.applyLabel.main.nsid, json({ label: {} })),
		);
		live.emit({
			$type: "messageEvent",
			event: "create",
			channel: CHANNEL,
			message: message("30"),
		});

		await source.setHidden({ channel: CHANNEL, rkey: "30", hidden: true });

		expect(fake.callsTo(colibri.community.applyLabel.main.nsid)).toHaveLength(
			1,
		);
	});

	it("rejects features the AppView does not offer yet", async () => {
		const { source } = await setup();
		const failure = await source
			.listDiscoverable()
			.catch((error: unknown) => error);
		expect(isNotEnabled(failure)).toBe(true);
		expect((failure as ColibriError).code).toBe("NotEnabled");
	});

	it("transfers ownership and returns both members", async () => {
		const member = (did: string, roles: string[]) => ({
			actor: profileOf(did),
			roles,
			joinedAt: "2026-01-01T00:00:00.000Z",
		});
		const { fake, source } = await setup((fake) =>
			fake.on(
				colibri.community.transferOwnership.main.nsid,
				json({
					owner: member(OTHER, ["owner", "mod"]),
					previousOwner: member(VIEWER, ["mod"]),
				}),
			),
		);

		const result = await source.transferOwnership({
			community: COMMUNITY,
			subject: OTHER,
		});

		expect(
			only(fake.callsTo(colibri.community.transferOwnership.main.nsid)).body,
		).toEqual({ community: COMMUNITY, subject: OTHER });
		expect(result.owner.actor.did).toBe(OTHER);
		expect(result.owner.roles).toEqual(["owner", "mod"]);
		expect(result.previousOwner.actor.did).toBe(VIEWER);
		expect(result.previousOwner.roles).toEqual(["mod"]);
	});

	it("turns ownership transfer refusals into transfer errors", async () => {
		const cases: [Response, string][] = [
			[xrpcError(400, "AlreadyOwner"), "AlreadyOwner"],
			[xrpcError(400, "Banned"), "Banned"],
			[xrpcError(400, "MemberNotFound"), "MemberNotFound"],
			[xrpcError(404, "CommunityNotFound"), "CommunityNotFound"],
			[xrpcError(403, "Forbidden"), "Forbidden"],
		];
		for (const [reply, code] of cases) {
			const { source } = await setup((fake) =>
				fake.on(colibri.community.transferOwnership.main.nsid, reply),
			);
			const failure = await source
				.transferOwnership({ community: COMMUNITY, subject: OTHER })
				.catch((error: unknown) => error);
			expect(failure).toBeInstanceOf(TransferOwnershipError);
			expect((failure as TransferOwnershipError).code).toBe(code);
		}
	});

	it("keeps other ownership transfer failures as Colibri errors", async () => {
		const { source } = await setup((fake) =>
			fake.on(
				colibri.community.transferOwnership.main.nsid,
				xrpcError(400, "CredentialsUnavailable"),
			),
		);
		const failure = await source
			.transferOwnership({ community: COMMUNITY, subject: OTHER })
			.catch((error: unknown) => error);
		expect(failure).not.toBeInstanceOf(TransferOwnershipError);
		expect((failure as ColibriError).code).toBe("CredentialsUnavailable");
	});

	it("watches the viewer's communities and swaps the set on reload", async () => {
		const { live, source } = await setup((fake) =>
			fake.on(
				colibri.actor.listCommunities.main.nsid,
				json({ communities: [{ did: COMMUNITY }] }),
			),
		);

		await source.listCommunities();
		await source.listCommunities();

		expect(live.watched.map((entry) => entry.released)).toEqual([true, false]);
		expect(live.watched[1]?.target).toEqual({ communities: [COMMUNITY] });
	});

	it("watches a channel separately from telling the server what is in view", async () => {
		const { live, source } = await setup();

		const release = source.watchChannel(CHANNEL);
		source.viewChannel(CHANNEL);
		source.viewChannel();
		expect(live.watched).toEqual([
			{ target: { channels: [CHANNEL] }, released: false },
		]);
		release();
		release();

		expect(live.watched).toEqual([
			{ target: { channels: [CHANNEL] }, released: true },
		]);
		expect(live.sent).toEqual([
			{ $type: "social.colibri.beta.sync.defs#viewChannel", channel: CHANNEL },
			{ $type: "social.colibri.beta.sync.defs#viewChannel" },
		]);
	});

	it("keeps controls locally", async () => {
		const { source } = await setup();
		source.preferences.setControls({ developerMode: true });
		expect(source.preferences.controls().developerMode).toBe(true);
		expect(source.preferences.controls().swipeLeftAction).toBe("members");
	});
});
