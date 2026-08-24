import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	channelSpaceFromPath,
	prefetchChannelMessages,
	resetChannelPrefetch,
	takeChannelMessages,
} from "./channel-prefetch";
import type { ColibriClient } from "./xrpc";

const DID = "did:plc:abc123";
const CHANNEL = `at://${DID}/space/social.colibri.beta.channel.text/general`;

describe("channelSpaceFromPath", () => {
	it("builds a channel space from a short-form text path", () => {
		expect(channelSpaceFromPath(`/app/c/${DID}/text/general`)).toBe(CHANNEL);
	});

	it("accepts the full space type form of the channel type", () => {
		expect(
			channelSpaceFromPath(
				`/app/c/${DID}/social.colibri.beta.channel.text/general`,
			),
		).toBe(CHANNEL);
	});

	it("ignores voice channels, which have no message list", () => {
		expect(channelSpaceFromPath(`/app/c/${DID}/voice/lounge`)).toBeUndefined();
		expect(
			channelSpaceFromPath(
				`/app/c/${DID}/social.colibri.beta.channel.voice/lounge`,
			),
		).toBeUndefined();
	});

	it("ignores an unknown channel type", () => {
		expect(channelSpaceFromPath(`/app/c/${DID}/whiteboard/x`)).toBeUndefined();
	});

	it("ignores paths that are not channel deep links", () => {
		expect(channelSpaceFromPath("/app")).toBeUndefined();
		expect(channelSpaceFromPath(`/app/c/${DID}`)).toBeUndefined();
		expect(channelSpaceFromPath("/app/login")).toBeUndefined();
	});

	it("tolerates trailing segments", () => {
		expect(channelSpaceFromPath(`/app/c/${DID}/text/general/extra`)).toBe(
			CHANNEL,
		);
	});

	it("decodes a percent-encoded skey", () => {
		expect(channelSpaceFromPath(`/app/c/${DID}/text/off%20topic`)).toBe(
			`at://${DID}/space/social.colibri.beta.channel.text/off topic`,
		);
	});
});

const clientReturning = (value: unknown): ColibriClient =>
	({ call: vi.fn(async () => value) }) as unknown as ColibriClient;

describe("prefetchChannelMessages / takeChannelMessages", () => {
	beforeEach(() => {
		resetChannelPrefetch();
		vi.useRealTimers();
	});

	it("returns undefined when nothing was primed", () => {
		expect(takeChannelMessages(CHANNEL)).toBeUndefined();
	});

	it("hands back the primed read", async () => {
		const view = { ok: true, data: { messages: [] } };
		prefetchChannelMessages(clientReturning(view), CHANNEL);
		await expect(takeChannelMessages(CHANNEL)).resolves.toEqual(view);
	});

	it("only issues one request for repeat primes of the same channel", () => {
		const client = clientReturning({ ok: true, data: { messages: [] } });
		prefetchChannelMessages(client, CHANNEL);
		prefetchChannelMessages(client, CHANNEL);
		expect(client.call).toHaveBeenCalledTimes(1);
	});

	it("forgets the entry once taken, so a remount refetches", async () => {
		prefetchChannelMessages(
			clientReturning({ ok: true, data: { messages: [] } }),
			CHANNEL,
		);
		await takeChannelMessages(CHANNEL);
		expect(takeChannelMessages(CHANNEL)).toBeUndefined();
	});

	it("discards a payload primed too long ago", () => {
		vi.useFakeTimers();
		prefetchChannelMessages(
			clientReturning({ ok: true, data: { messages: [] } }),
			CHANNEL,
		);
		vi.advanceTimersByTime(21_000);
		expect(takeChannelMessages(CHANNEL)).toBeUndefined();
	});

	it("resolves to undefined rather than rejecting when the read throws", async () => {
		const client = {
			call: vi.fn(async () => {
				throw new Error("offline");
			}),
		} as unknown as ColibriClient;
		prefetchChannelMessages(client, CHANNEL);
		await expect(takeChannelMessages(CHANNEL)).resolves.toBeUndefined();
	});

	it("evicts the oldest entry past the cap", async () => {
		const client = clientReturning({ ok: true, data: { messages: [] } });
		prefetchChannelMessages(client, `${CHANNEL}-1`);
		prefetchChannelMessages(client, `${CHANNEL}-2`);
		prefetchChannelMessages(client, `${CHANNEL}-3`);
		expect(takeChannelMessages(`${CHANNEL}-1`)).toBeUndefined();
		await expect(takeChannelMessages(`${CHANNEL}-3`)).resolves.toBeDefined();
	});
});
