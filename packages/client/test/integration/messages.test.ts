import { beforeAll, describe, expect, it } from "vitest";
import { colibri } from "../../src/atproto/lexicons";
import { buildMessageRecord } from "../../src/atproto/message-record";
import { nextTid } from "../../src/atproto/outbox/tid";
import { spaceSkey } from "../../src/atproto/space-ref";
import type { ChannelView, CommunityView } from "../../src/atproto/views";
import {
	createActor,
	type ServerDescription,
	type TestActor,
	unique,
	waitForStack,
} from "./harness";

const SETTLE_TIMEOUT_MS = 30_000;

let server: ServerDescription;
let owner: TestActor;
let community: CommunityView;
let textChannel: ChannelView;

const settle = async <T>(
	label: string,
	attempt: () => Promise<T | undefined>,
): Promise<T> => {
	const deadline = Date.now() + SETTLE_TIMEOUT_MS;
	while (Date.now() < deadline) {
		const result = await attempt();
		if (result !== undefined) return result;
		await new Promise((resolve) => setTimeout(resolve, 500));
	}
	throw new Error(`${label} did not settle within ${SETTLE_TIMEOUT_MS}ms`);
};

beforeAll(async () => {
	server = await waitForStack();
	owner = await createActor(server.did, "owner");

	const created = await owner.xrpc.call(colibri.community.create.main, {
		body: { name: unique("Space ").slice(0, 32) },
	});
	if (!created.ok) {
		throw new Error(
			`community.create failed: ${created.error.code} ${created.error.serverMessage ?? ""}`,
		);
	}
	community = created.data.community;

	textChannel = await settle("the starter channels", async () => {
		const res = await owner.xrpc.call(colibri.community.listChannels.main, {
			params: { community: community.did },
		});
		if (!res.ok) return undefined;
		return res.data.channels.find(
			(channel) => channel.type === "social.colibri.beta.channel.text",
		);
	});
});

describe("community.create", () => {
	it("provisions a community the client can read back", () => {
		expect(community.did.startsWith("did:")).toBe(true);
		expect(community.managingApp).toBe(server.did);
		expect(community.viewer.isMember).toBe(true);
		expect(community.viewer.isOwner).toBe(true);
	});

	it("gives it channel spaces, not channel records", () => {
		expect(textChannel.space).toContain(`at://${community.did}/space/`);
		expect(textChannel.space).toContain("social.colibri.beta.channel.text");
		expect(spaceSkey(textChannel.space)).toBeTruthy();
		expect(textChannel.viewer.canRead).toBe(true);
	});
});

describe("writing a message into a channel space", () => {
	it("round-trips through the author's repo and back out of listMessages", async () => {
		const rkey = nextTid();
		const text = `integration ${unique("")}`;

		const record = buildMessageRecord({
			text,
			createdAt: new Date().toISOString(),
		});

		await owner.agent.com.atproto.space.createRecord({
			space: textChannel.space,
			repo: owner.did,
			collection: "social.colibri.beta.message",
			rkey,
			record,
		});

		const served = await settle("the written message", async () => {
			const res = await owner.xrpc.call(colibri.channel.listMessages.main, {
				params: { channel: textChannel.space },
			});
			if (!res.ok) return undefined;
			return res.data.messages.find(
				(message) => "rkey" in message && message.rkey === rkey,
			);
		});

		expect("text" in served && served.text).toBe(text);
		expect("author" in served && served.author.did).toBe(owner.did);
		expect("channel" in served && served.channel).toBe(textChannel.space);
	});
});
