import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	channelUriFromPath,
	prefetchChannelView,
	resetChannelPrefetch,
	takeChannelView,
} from "./channel-prefetch";
import type { XrpcClient } from "./xrpc";

const DID = "did:plc:abc123";
const CHANNEL = `at://${DID}/social.colibri.channel/general`;

describe("channelUriFromPath", () => {
	it("builds a channel URI from a short-form text path", () => {
		expect(channelUriFromPath(`/app/c/${DID}/text/general`)).toBe(CHANNEL);
	});

	it("accepts the full NSID form of the channel type", () => {
		expect(
			channelUriFromPath(`/app/c/${DID}/social.colibri.channel.text/general`),
		).toBe(CHANNEL);
	});

	it("expands a bare community segment to the `self` rkey", () => {
		expect(channelUriFromPath(`/app/c/${DID}/text/general`)).toContain(DID);
	});

	it("keeps a non-self community rkey out of the channel URI", () => {
		expect(channelUriFromPath(`/app/c/${DID}-myrkey/text/general`)).toBe(
			CHANNEL,
		);
	});

	it("ignores voice channels, which have no message list", () => {
		expect(channelUriFromPath(`/app/c/${DID}/voice/lounge`)).toBeUndefined();
		expect(
			channelUriFromPath(`/app/c/${DID}/social.colibri.channel.voice/lounge`),
		).toBeUndefined();
	});

	it("ignores an unknown channel type", () => {
		expect(channelUriFromPath(`/app/c/${DID}/whiteboard/x`)).toBeUndefined();
	});

	it("ignores paths that are not channel deep links", () => {
		expect(channelUriFromPath("/app")).toBeUndefined();
		expect(channelUriFromPath(`/app/c/${DID}`)).toBeUndefined();
		expect(channelUriFromPath("/app/login")).toBeUndefined();
	});

	it("tolerates trailing segments and query-free suffixes", () => {
		expect(channelUriFromPath(`/app/c/${DID}/text/general/extra`)).toBe(
			CHANNEL,
		);
	});

	it("decodes a percent-encoded rkey", () => {
		expect(channelUriFromPath(`/app/c/${DID}/text/off%20topic`)).toBe(
			`at://${DID}/social.colibri.channel/off topic`,
		);
	});
});

const clientReturning = (value: unknown): XrpcClient =>
	({
		social: {
			colibri: {
				channel: { getChannelView: vi.fn(async () => value) },
			},
		},
	}) as unknown as XrpcClient;

describe("prefetchChannelView / takeChannelView", () => {
	beforeEach(() => {
		resetChannelPrefetch();
		vi.useRealTimers();
	});

	it("returns undefined when nothing was primed", () => {
		expect(takeChannelView(CHANNEL)).toBeUndefined();
	});

	it("hands back the primed read", async () => {
		const view = { ok: true, data: { messages: [] } };
		prefetchChannelView(clientReturning(view), CHANNEL);
		await expect(takeChannelView(CHANNEL)).resolves.toEqual(view);
	});

	it("only issues one request for repeat primes of the same channel", () => {
		const client = clientReturning({ ok: true, data: { messages: [] } });
		prefetchChannelView(client, CHANNEL);
		prefetchChannelView(client, CHANNEL);
		expect(client.social.colibri.channel.getChannelView).toHaveBeenCalledTimes(
			1,
		);
	});

	it("forgets the entry once taken, so a remount refetches", async () => {
		prefetchChannelView(
			clientReturning({ ok: true, data: { messages: [] } }),
			CHANNEL,
		);
		await takeChannelView(CHANNEL);
		expect(takeChannelView(CHANNEL)).toBeUndefined();
	});

	it("discards a payload primed too long ago", () => {
		vi.useFakeTimers();
		prefetchChannelView(
			clientReturning({ ok: true, data: { messages: [] } }),
			CHANNEL,
		);
		vi.advanceTimersByTime(21_000);
		expect(takeChannelView(CHANNEL)).toBeUndefined();
	});

	it("resolves to undefined rather than rejecting when the read throws", async () => {
		const client = {
			social: {
				colibri: {
					channel: {
						getChannelView: vi.fn(async () => {
							throw new Error("offline");
						}),
					},
				},
			},
		} as unknown as XrpcClient;
		prefetchChannelView(client, CHANNEL);
		await expect(takeChannelView(CHANNEL)).resolves.toBeUndefined();
	});

	it("evicts the oldest entry past the cap", async () => {
		const client = clientReturning({ ok: true, data: { messages: [] } });
		prefetchChannelView(client, `${CHANNEL}-1`);
		prefetchChannelView(client, `${CHANNEL}-2`);
		prefetchChannelView(client, `${CHANNEL}-3`);
		expect(takeChannelView(`${CHANNEL}-1`)).toBeUndefined();
		await expect(takeChannelView(`${CHANNEL}-3`)).resolves.toBeDefined();
	});
});
