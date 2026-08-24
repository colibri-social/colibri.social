import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	loadCommunityChannels,
	peekChannel,
	primeCommunityChannels,
	resetChannelReferences,
	resolveChannelChip,
} from "./channel-reference";
import { asSpaceRef } from "./lexicons";
import type { ColibriClient } from "./xrpc";

const DID = "did:plc:abc123";
const OTHER_DID = "did:plc:other";
const CHANNEL = `at://${DID}/space/social.colibri.beta.channel.text/general`;

const channel = (space: string, name: string) => ({
	space: asSpaceRef(space),
	name,
	type: "social.colibri.beta.channel.text",
	category: "main",
	viewer: { canRead: true, canPost: true },
});

const clientReturning = (
	impl: () => unknown,
): { client: ColibriClient; call: ReturnType<typeof vi.fn> } => {
	const call = vi.fn(async () => impl());
	return {
		call,
		client: { call } as unknown as ColibriClient,
	};
};

const ok = (channels: Array<ReturnType<typeof channel>>) => ({
	ok: true,
	data: { channels },
});

describe("channel-reference", () => {
	beforeEach(() => {
		resetChannelReferences();
		vi.useRealTimers();
	});

	it("resolves a channel primed from the community context", () => {
		primeCommunityChannels(DID, [channel(CHANNEL, "general")]);
		expect(peekChannel(CHANNEL)).toEqual({
			space: CHANNEL,
			name: "general",
			type: "social.colibri.beta.channel.text",
			communityDid: DID,
		});
	});

	it("issues no request for a primed community", async () => {
		const { client, call } = clientReturning(() => ok([]));
		primeCommunityChannels(DID, [channel(CHANNEL, "general")]);
		await loadCommunityChannels(client, DID);
		expect(call).not.toHaveBeenCalled();
	});

	it("collapses concurrent loads of the same community into one request", async () => {
		const { client, call } = clientReturning(() =>
			ok([channel(CHANNEL, "general")]),
		);
		await Promise.all([
			loadCommunityChannels(client, DID),
			loadCommunityChannels(client, DID),
			loadCommunityChannels(client, DID),
		]);
		expect(call).toHaveBeenCalledTimes(1);
		expect(peekChannel(CHANNEL)?.name).toBe("general");
	});

	it("refetches once the entry goes stale", async () => {
		vi.useFakeTimers();
		const { client, call } = clientReturning(() =>
			ok([channel(CHANNEL, "general")]),
		);
		await loadCommunityChannels(client, DID);
		await loadCommunityChannels(client, DID);
		expect(call).toHaveBeenCalledTimes(1);

		vi.advanceTimersByTime(300_001);
		await loadCommunityChannels(client, DID);
		expect(call).toHaveBeenCalledTimes(2);
	});

	it("holds off on retrying a failure until the cooldown passes", async () => {
		vi.useFakeTimers();
		const { client, call } = clientReturning(() => {
			throw new Error("offline");
		});

		await loadCommunityChannels(client, DID);
		await loadCommunityChannels(client, DID);
		expect(call).toHaveBeenCalledTimes(1);

		vi.advanceTimersByTime(30_001);
		await loadCommunityChannels(client, DID);
		expect(call).toHaveBeenCalledTimes(2);
	});

	it("treats a failed result the same as a throw", async () => {
		const { client } = clientReturning(() => ({
			ok: false,
			error: { code: "NetworkError" },
		}));
		await loadCommunityChannels(client, DID);
		expect(peekChannel(CHANNEL)).toBeUndefined();
	});

	it("drops channels that disappeared from a community on reprime", () => {
		primeCommunityChannels(DID, [
			channel(CHANNEL, "general"),
			channel(`${CHANNEL}-2`, "random"),
		]);
		primeCommunityChannels(DID, [channel(CHANNEL, "general")]);
		expect(peekChannel(`${CHANNEL}-2`)).toBeUndefined();
		expect(peekChannel(CHANNEL)).toBeDefined();
	});

	it("evicts the oldest community past the cap", () => {
		for (let i = 0; i < 21; i++) {
			primeCommunityChannels(
				`did:plc:c${i}`,
				[
					channel(
						`at://did:plc:c${i}/space/social.colibri.beta.channel.text/general`,
						"general",
					),
				],
				i,
			);
		}
		expect(
			peekChannel(
				"at://did:plc:c0/space/social.colibri.beta.channel.text/general",
			),
		).toBeUndefined();
		expect(
			peekChannel(
				"at://did:plc:c20/space/social.colibri.beta.channel.text/general",
			),
		).toBeDefined();
	});
});

describe("resolveChannelChip", () => {
	const SUPPORT = "support";
	const BUGS = "bugs";
	const OTHER = `at://${DID}/space/social.colibri.beta.channel.text/general-2`;

	const categorized = (space: string, name: string, category: string) => ({
		...channel(space, name),
		category,
	});

	const categories = [
		{ rkey: SUPPORT, name: "Support", channels: [] },
		{ rkey: BUGS, name: "Bugs", channels: [] },
	];

	it("adds the category when a local channel name collides", () => {
		const channels = [
			categorized(CHANNEL, "general", SUPPORT),
			categorized(OTHER, "general", BUGS),
		];

		expect(resolveChannelChip(CHANNEL, channels, [], DID, categories)).toEqual({
			label: "general",
			category: "Support",
		});
	});

	it("omits the category when the local channel name is unique", () => {
		const channels = [
			categorized(CHANNEL, "general", SUPPORT),
			categorized(OTHER, "random", BUGS),
		];

		expect(resolveChannelChip(CHANNEL, channels, [], DID, categories)).toEqual({
			label: "general",
		});
	});

	it("omits the category for a channel in another community", () => {
		const foreign = `at://${OTHER_DID}/space/social.colibri.beta.channel.text/general`;
		primeCommunityChannels(OTHER_DID, [channel(foreign, "general")]);

		expect(resolveChannelChip(foreign, [], [], DID, categories)).toEqual({
			label: "general",
		});
	});
});
