import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	BOOT_MAX_AGE_MS,
	channelSpaceFromPath,
	HOVER_MAX_AGE_MS,
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

const APPVIEW = "did:web:appview.example";
const OTHER_APPVIEW = "did:web:other.example";

const clientReturning = (value: unknown, appViewDid = APPVIEW): ColibriClient =>
	({ appViewDid, call: vi.fn(async () => value) }) as unknown as ColibriClient;

const VOICE = `at://${DID}/space/social.colibri.beta.channel.voice/lounge`;

const settled = async (): Promise<void> => {
	for (let i = 0; i < 5; i++) await Promise.resolve();
};

describe("prefetchChannelMessages / takeChannelMessages", () => {
	beforeEach(() => {
		resetChannelPrefetch();
		vi.useRealTimers();
	});

	it("returns undefined when nothing was primed", () => {
		expect(
			takeChannelMessages(clientReturning(undefined), CHANNEL),
		).toBeUndefined();
	});

	it("hands back the primed read", async () => {
		const view = { ok: true, data: { messages: [] } };
		const client = clientReturning(view);
		prefetchChannelMessages(client, CHANNEL);
		await expect(takeChannelMessages(client, CHANNEL)).resolves.toEqual(view);
	});

	it("only issues one request for repeat primes of the same channel", () => {
		const client = clientReturning({ ok: true, data: { messages: [] } });
		prefetchChannelMessages(client, CHANNEL);
		prefetchChannelMessages(client, CHANNEL);
		expect(client.call).toHaveBeenCalledTimes(1);
	});

	it("forgets the entry once taken, so a remount refetches", async () => {
		const client = clientReturning({ ok: true, data: { messages: [] } });
		prefetchChannelMessages(client, CHANNEL);
		await takeChannelMessages(client, CHANNEL);
		expect(takeChannelMessages(client, CHANNEL)).toBeUndefined();
	});

	it("discards a payload primed too long ago", () => {
		vi.useFakeTimers();
		const client = clientReturning({ ok: true, data: { messages: [] } });
		prefetchChannelMessages(client, CHANNEL);
		vi.advanceTimersByTime(HOVER_MAX_AGE_MS + 1_000);
		expect(takeChannelMessages(client, CHANNEL)).toBeUndefined();
	});

	it("keeps a boot prime usable for longer than a hover prime", () => {
		vi.useFakeTimers();
		const client = clientReturning({ ok: true, data: { messages: [] } });
		prefetchChannelMessages(client, CHANNEL, { maxAgeMs: BOOT_MAX_AGE_MS });
		vi.advanceTimersByTime(HOVER_MAX_AGE_MS + 1_000);
		expect(takeChannelMessages(client, CHANNEL)).toBeDefined();
	});

	it("resolves to undefined rather than rejecting when the read throws", async () => {
		const client = {
			appViewDid: APPVIEW,
			call: vi.fn(async () => {
				throw new Error("offline");
			}),
		} as unknown as ColibriClient;
		prefetchChannelMessages(client, CHANNEL);
		await expect(takeChannelMessages(client, CHANNEL)).resolves.toBeUndefined();
	});

	it("ignores a voice channel, which has no message list", () => {
		const client = clientReturning({ ok: true, data: { messages: [] } });
		prefetchChannelMessages(client, VOICE);
		expect(client.call).not.toHaveBeenCalled();
		expect(takeChannelMessages(client, VOICE)).toBeUndefined();
	});

	it("does not hand a prime from one appview to a client on another", async () => {
		const primary = clientReturning({ ok: true, data: { messages: [] } });
		const other = clientReturning(
			{ ok: true, data: { messages: [] } },
			OTHER_APPVIEW,
		);
		prefetchChannelMessages(primary, CHANNEL);

		expect(takeChannelMessages(other, CHANNEL)).toBeUndefined();
		await expect(takeChannelMessages(primary, CHANNEL)).resolves.toBeDefined();
	});

	it("refuses to fan out past the concurrency cap", () => {
		const client = clientReturning({ ok: true, data: { messages: [] } });
		for (let i = 0; i < 6; i++) {
			prefetchChannelMessages(client, `${CHANNEL}-${i}`);
		}
		expect(client.call).toHaveBeenCalledTimes(3);
	});

	it("evicts and aborts the oldest entry past the cap", async () => {
		const controllers: Array<AbortSignal | undefined> = [];
		const client = {
			appViewDid: APPVIEW,
			call: vi.fn(
				async (_m: unknown, _i: unknown, opts?: { signal?: AbortSignal }) => {
					controllers.push(opts?.signal);
					return { ok: true, data: { messages: [] } };
				},
			),
		} as unknown as ColibriClient;

		for (let i = 0; i < 7; i++) {
			prefetchChannelMessages(client, `${CHANNEL}-${i}`);
			await settled();
		}

		expect(takeChannelMessages(client, `${CHANNEL}-0`)).toBeUndefined();
		await expect(
			takeChannelMessages(client, `${CHANNEL}-6`),
		).resolves.toBeDefined();
	});

	it("aborts an in-flight prime when the store is reset", async () => {
		let seen: AbortSignal | undefined;
		const client = {
			appViewDid: APPVIEW,
			call: vi.fn(
				(_m: unknown, _i: unknown, opts?: { signal?: AbortSignal }) => {
					seen = opts?.signal;
					return new Promise(() => {});
				},
			),
		} as unknown as ColibriClient;

		prefetchChannelMessages(client, CHANNEL);
		expect(seen?.aborted).toBe(false);

		resetChannelPrefetch();
		expect(seen?.aborted).toBe(true);
	});
});
