import { classifyThrown } from "../errors/classify";
import { lastViewedChannelPath } from "../utils/last-viewed-channel";
import { createLogger } from "../utils/logger";
import { markBoot } from "../utils/perf";
import { parseChannelPath } from "./colibri-channel-url";
import { colibri, SPACE_TYPES } from "./lexicons";
import { parseSpace } from "./space-ref";
import type { MessageView } from "./views";
import type { ColibriClient } from "./xrpc";
import type { XrpcResult } from "./xrpc/result";

const log = createLogger("channel-prefetch");

const PREFETCH_LIMIT = 50;

export const HOVER_MAX_AGE_MS = 8_000;

export const BOOT_MAX_AGE_MS = 20_000;

const MAX_ENTRIES = 6;

const MAX_CONCURRENT = 3;

export type PrefetchedMessages = {
	cursor?: string;
	messages: Array<MessageView>;
};

type Entry = {
	promise: Promise<XrpcResult<PrefetchedMessages> | undefined>;
	controller: AbortController;
	startedAt: number;
	maxAgeMs: number;
	settled: boolean;
};

const inflight = new Map<string, Entry>();

const entryKey = (appViewDid: string, channelSpace: string): string =>
	`${appViewDid}:${channelSpace}`;

const isTextChannel = (channelSpace: string): boolean =>
	parseSpace(channelSpace)?.type === SPACE_TYPES.channelText;

export const channelSpaceFromPath = (pathname: string): string | undefined => {
	const target = parseChannelPath(pathname);
	if (!target) return undefined;
	if (!isTextChannel(target.channelSpace)) return undefined;

	return target.channelSpace;
};

const pending = (): Array<[string, Entry]> =>
	[...inflight.entries()].filter(([, entry]) => !entry.settled);

const drop = (key: string): void => {
	const entry = inflight.get(key);
	if (!entry) return;
	inflight.delete(key);
	if (!entry.settled) entry.controller.abort();
};

export const prefetchChannelMessages = (
	xrpc: ColibriClient,
	channelSpace: string,
	options?: { maxAgeMs?: number },
): void => {
	if (!isTextChannel(channelSpace)) return;

	const key = entryKey(xrpc.appViewDid, channelSpace);
	if (inflight.has(key)) return;

	if (pending().length >= MAX_CONCURRENT) return;
	if (inflight.size >= MAX_ENTRIES) {
		const oldest = [...inflight.entries()].sort(
			(a, b) => a[1].startedAt - b[1].startedAt,
		)[0];
		if (oldest) drop(oldest[0]);
	}

	const controller = new AbortController();

	const promise = xrpc
		.call(
			colibri.channel.listMessages.main,
			{ params: { channel: channelSpace, limit: PREFETCH_LIMIT } },
			{ signal: controller.signal },
		)
		.catch((err: unknown) => {
			const failure = classifyThrown(err, { method: "channel.listMessages" });
			log.debug("prefetch failed, the channel will fetch normally", {
				code: failure.code,
			});
			return undefined;
		})
		.then((result) => {
			const entry = inflight.get(key);
			if (entry) entry.settled = true;
			markBoot("prefetch:settled");
			return result;
		});

	inflight.set(key, {
		promise,
		controller,
		startedAt: Date.now(),
		maxAgeMs: options?.maxAgeMs ?? HOVER_MAX_AGE_MS,
		settled: false,
	});
};

export const takeChannelMessages = (
	xrpc: ColibriClient,
	channelSpace: string,
): Promise<XrpcResult<PrefetchedMessages> | undefined> | undefined => {
	const key = entryKey(xrpc.appViewDid, channelSpace);
	const entry = inflight.get(key);
	if (!entry) return undefined;
	inflight.delete(key);
	if (Date.now() - entry.startedAt > entry.maxAgeMs) {
		if (!entry.settled) entry.controller.abort();
		return undefined;
	}
	return entry.promise;
};

export const primeFromLocation = (xrpc: ColibriClient): void => {
	if (typeof window === "undefined") return;
	const path = window.location.pathname;
	const space =
		channelSpaceFromPath(path) ??
		(() => {
			const fallback = lastViewedChannelPath(path);
			return fallback ? channelSpaceFromPath(fallback) : undefined;
		})();
	if (!space) return;
	prefetchChannelMessages(xrpc, space, { maxAgeMs: BOOT_MAX_AGE_MS });
	markBoot("prefetch:issued");
};

export const resetChannelPrefetch = (): void => {
	for (const key of [...inflight.keys()]) drop(key);
	inflight.clear();
};
