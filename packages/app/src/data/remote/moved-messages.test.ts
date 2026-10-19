import { colibri } from "@colibri-social/lib";
import { describe, expect, it } from "vitest";
import type { MessageView, SpaceRef } from "../types";
import {
	createFakeLive,
	createFakeSession,
	json,
	type RecordedCall,
} from "./fake-session";
import { createRemoteSource } from "./source";

const VIEWER = "did:plc:viewer";
const OTHER = "did:plc:other";
const COMMUNITY = "did:plc:space";
const SOURCE =
	`at://${COMMUNITY}/space/social.colibri.beta.channel.text/general` as SpaceRef;
const DESTINATION =
	`at://${COMMUNITY}/space/social.colibri.beta.channel.thread/t1` as SpaceRef;

const profileOf = (did: string) => ({
	did,
	handle: `${did.slice(8)}.test`,
	displayName: did.slice(8),
	isBot: false,
	syncBluesky: false,
});

const moved = (rkey: string, author = OTHER) =>
	({
		uri: `${SOURCE}/${author}/social.colibri.beta.message/${rkey}`,
		rkey,
		channel: SOURCE,
		author: profileOf(author),
		text: "moved here",
		createdAt: "2026-10-14T10:00:00.000Z",
		attachments: [],
		reactions: [],
		labels: [],
	}) as unknown as MessageView;

const setup = async (
	messages: MessageView[],
	configure?: (fake: ReturnType<typeof createFakeSession>) => void,
) => {
	const fake = createFakeSession(VIEWER);
	fake.on(
		colibri.actor.getProfile.main.nsid,
		json({ profile: profileOf(VIEWER) }),
	);
	fake.on(colibri.actor.getPreferences.main.nsid, json({ preferences: {} }));
	configure?.(fake);
	const source = await createRemoteSource({
		session: fake.session,
		appViewDid: "did:web:spaces-api.colibri.social",
		live: createFakeLive().live,
	});
	fake.on(colibri.channel.listMessages.main.nsid, json({ messages }));
	await source.listMessages({ channel: DESTINATION });
	return { fake, source };
};

const bodyOf = (calls: RecordedCall[]) => {
	expect(calls).toHaveLength(1);
	return (calls[0] as RecordedCall).body as Record<string, unknown>;
};

describe("writes on a moved message", () => {
	it("hides a message viewed in the space it moved to", async () => {
		const label = { val: "hidden", src: COMMUNITY };
		const { fake, source } = await setup([moved("8")], (fake) =>
			fake.on(colibri.community.applyLabel.main.nsid, json({ label })),
		);

		const hidden = await source.setHidden({
			channel: DESTINATION,
			rkey: "8",
			hidden: true,
		});

		expect(
			bodyOf(fake.callsTo(colibri.community.applyLabel.main.nsid)).space,
		).toBe(SOURCE);
		expect(hidden.channel).toBe(SOURCE);
		expect(hidden.labels).toEqual([label]);
	});

	it("labels moderated link previews in the message's own space", async () => {
		const label = { val: "embeds-suppressed", src: COMMUNITY };
		const { fake, source } = await setup([moved("9")], (fake) =>
			fake.on(colibri.community.applyLabel.main.nsid, json({ label })),
		);

		await source.setModeratedEmbeds({
			channel: DESTINATION,
			rkey: "9",
			uris: ["https://example.com"],
		});

		expect(
			bodyOf(fake.callsTo(colibri.community.applyLabel.main.nsid)).space,
		).toBe(SOURCE);
	});

	it("rewrites the author's record in the space it lives in", async () => {
		const { fake, source } = await setup([moved("4", VIEWER)], (fake) => {
			fake.on(
				"com.atproto.space.getRecord",
				json({ uri: "x", value: { text: "a", createdAt: "t" } }),
			);
			fake.on("com.atproto.space.putRecord", json({ uri: "x", cid: "c" }));
		});

		await source.setSuppressedEmbeds({
			channel: DESTINATION,
			rkey: "4",
			uris: ["https://example.com"],
		});

		const read = fake.callsTo("com.atproto.space.getRecord");
		expect(read).toHaveLength(1);
		expect(read[0]?.params.get("space")).toBe(SOURCE);
		expect(bodyOf(fake.callsTo("com.atproto.space.putRecord")).space).toBe(
			SOURCE,
		);
	});

	it("writes and removes reactions in the message's own space", async () => {
		const { fake, source } = await setup([moved("7")], (fake) => {
			fake.on("com.atproto.space.createRecord", json({ uri: "x", cid: "c" }));
			fake.on("com.atproto.space.deleteRecord", json({}));
		});

		await source.react({
			channel: DESTINATION,
			rkey: "7",
			emoji: "🔥",
			add: true,
		});
		await source.react({
			channel: DESTINATION,
			rkey: "7",
			emoji: "🔥",
			add: false,
		});

		const created = bodyOf(fake.callsTo("com.atproto.space.createRecord"));
		expect(created.space).toBe(SOURCE);
		expect((created.record as Record<string, unknown>).target).toEqual({
			did: OTHER,
			rkey: "7",
		});
		expect(bodyOf(fake.callsTo("com.atproto.space.deleteRecord")).space).toBe(
			SOURCE,
		);
	});

	it("edits the author's moved message in the space it lives in", async () => {
		const { fake, source } = await setup([moved("5", VIEWER)], (fake) => {
			fake.on(
				"com.atproto.space.getRecord",
				json({ uri: "x", value: { text: "a", createdAt: "t" } }),
			);
			fake.on("com.atproto.space.putRecord", json({ uri: "x", cid: "c" }));
		});

		const next = await source.editMessage({
			channel: DESTINATION,
			rkey: "5",
			text: "edited",
		});

		const read = fake.callsTo("com.atproto.space.getRecord");
		expect(read).toHaveLength(1);
		expect(read[0]?.params.get("space")).toBe(SOURCE);
		const put = bodyOf(fake.callsTo("com.atproto.space.putRecord"));
		expect(put.space).toBe(SOURCE);
		expect((put.record as Record<string, unknown>).text).toBe("edited");
		expect(next.channel).toBe(SOURCE);
		expect(next.text).toBe("edited");
	});

	it("deletes the author's moved message in the space it lives in", async () => {
		const { fake, source } = await setup([moved("6", VIEWER)], (fake) =>
			fake.on("com.atproto.space.deleteRecord", json({})),
		);

		await source.deleteMessage({ channel: DESTINATION, rkey: "6" });

		expect(bodyOf(fake.callsTo("com.atproto.space.deleteRecord")).space).toBe(
			SOURCE,
		);
	});
});
