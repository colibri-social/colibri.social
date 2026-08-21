import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	loadCommunityChannels,
	peekChannel,
	primeCommunityChannels,
	resetChannelReferences,
	resolveChannelChip,
} from "./channel-reference";
import type { XrpcClient } from "./xrpc";

const DID = "did:plc:abc123";
const COMMUNITY = `at://${DID}/social.colibri.community/self`;
const CHANNEL = `at://${DID}/social.colibri.channel/general`;

const channel = (uri: string, name: string) => ({
	uri,
	name,
	type: "social.colibri.channel.text",
	category: `at://${DID}/social.colibri.category/main`,
});

const clientReturning = (
	impl: () => unknown,
): { client: XrpcClient; getData: ReturnType<typeof vi.fn> } => {
	const getData = vi.fn(async () => impl());
	return {
		getData,
		client: {
			social: { colibri: { community: { getData } } },
		} as unknown as XrpcClient,
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
		primeCommunityChannels(COMMUNITY, [channel(CHANNEL, "general")]);
		expect(peekChannel(CHANNEL)).toEqual({
			uri: CHANNEL,
			name: "general",
			type: "social.colibri.channel.text",
			communityUri: COMMUNITY,
		});
	});

	it("issues no request for a primed community", async () => {
		const { client, getData } = clientReturning(() => ok([]));
		primeCommunityChannels(COMMUNITY, [channel(CHANNEL, "general")]);
		await loadCommunityChannels(client, COMMUNITY);
		expect(getData).not.toHaveBeenCalled();
	});

	it("collapses concurrent loads of the same community into one request", async () => {
		const { client, getData } = clientReturning(() =>
			ok([channel(CHANNEL, "general")]),
		);
		await Promise.all([
			loadCommunityChannels(client, COMMUNITY),
			loadCommunityChannels(client, COMMUNITY),
			loadCommunityChannels(client, COMMUNITY),
		]);
		expect(getData).toHaveBeenCalledTimes(1);
		expect(peekChannel(CHANNEL)?.name).toBe("general");
	});

	it("refetches once the entry goes stale", async () => {
		vi.useFakeTimers();
		const { client, getData } = clientReturning(() =>
			ok([channel(CHANNEL, "general")]),
		);
		await loadCommunityChannels(client, COMMUNITY);
		await loadCommunityChannels(client, COMMUNITY);
		expect(getData).toHaveBeenCalledTimes(1);

		vi.advanceTimersByTime(300_001);
		await loadCommunityChannels(client, COMMUNITY);
		expect(getData).toHaveBeenCalledTimes(2);
	});

	it("holds off on retrying a failure until the cooldown passes", async () => {
		vi.useFakeTimers();
		const { client, getData } = clientReturning(() => {
			throw new Error("offline");
		});

		await loadCommunityChannels(client, COMMUNITY);
		await loadCommunityChannels(client, COMMUNITY);
		expect(getData).toHaveBeenCalledTimes(1);

		vi.advanceTimersByTime(30_001);
		await loadCommunityChannels(client, COMMUNITY);
		expect(getData).toHaveBeenCalledTimes(2);
	});

	it("treats a failed result the same as a throw", async () => {
		const { client } = clientReturning(() => ({
			ok: false,
			error: { code: "NetworkError" },
		}));
		await loadCommunityChannels(client, COMMUNITY);
		expect(peekChannel(CHANNEL)).toBeUndefined();
	});

	it("drops channels that disappeared from a community on reprime", () => {
		primeCommunityChannels(COMMUNITY, [
			channel(CHANNEL, "general"),
			channel(`${CHANNEL}-2`, "random"),
		]);
		primeCommunityChannels(COMMUNITY, [channel(CHANNEL, "general")]);
		expect(peekChannel(`${CHANNEL}-2`)).toBeUndefined();
		expect(peekChannel(CHANNEL)).toBeDefined();
	});

	it("evicts the oldest community past the cap", () => {
		for (let i = 0; i < 21; i++) {
			primeCommunityChannels(
				`at://did:plc:c${i}/social.colibri.community/self`,
				[
					channel(
						`at://did:plc:c${i}/social.colibri.channel/general`,
						"general",
					),
				],
				i,
			);
		}
		expect(
			peekChannel("at://did:plc:c0/social.colibri.channel/general"),
		).toBeUndefined();
		expect(
			peekChannel("at://did:plc:c20/social.colibri.channel/general"),
		).toBeDefined();
	});
});

describe("resolveChannelChip", () => {
	const SUPPORT = `at://${DID}/social.colibri.category/support`;
	const BUGS = `at://${DID}/social.colibri.category/bugs`;
	const OTHER = `at://${DID}/social.colibri.channel/general-2`;

	const categorized = (uri: string, name: string, category: string) => ({
		...channel(uri, name),
		category,
	});

	const categories = [
		{ uri: SUPPORT, name: "Support", channelOrder: [] },
		{ uri: BUGS, name: "Bugs", channelOrder: [] },
	];

	it("adds the category when a local channel name collides", () => {
		const channels = [
			categorized(CHANNEL, "general", SUPPORT),
			categorized(OTHER, "general", BUGS),
		];

		expect(
			resolveChannelChip(CHANNEL, channels, [], COMMUNITY, categories),
		).toEqual({ label: "general", category: "Support" });
	});

	it("omits the category when the local channel name is unique", () => {
		const channels = [
			categorized(CHANNEL, "general", SUPPORT),
			categorized(OTHER, "random", BUGS),
		];

		expect(
			resolveChannelChip(CHANNEL, channels, [], COMMUNITY, categories),
		).toEqual({ label: "general" });
	});

	it("omits the category for a channel in another community", () => {
		const foreign = "at://did:plc:other/social.colibri.channel/general";
		primeCommunityChannels("at://did:plc:other/social.colibri.community/self", [
			channel(foreign, "general"),
		]);

		expect(resolveChannelChip(foreign, [], [], COMMUNITY, categories)).toEqual({
			label: "general",
		});
	});
});
