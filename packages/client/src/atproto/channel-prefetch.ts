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

const MAX_AGE_MS = 20_000;

const MAX_ENTRIES = 2;

export type PrefetchedMessages = {
	cursor?: string;
	messages: Array<MessageView>;
};

type Entry = {
	promise: Promise<XrpcResult<PrefetchedMessages> | undefined>;
	startedAt: number;
};

const inflight = new Map<string, Entry>();

export const channelSpaceFromPath = (pathname: string): string | undefined => {
	const target = parseChannelPath(pathname);
	if (!target) return undefined;
	const parsed = parseSpace(target.channelSpace);
	if (!parsed || parsed.type !== SPACE_TYPES.channelText) return undefined;

	return target.channelSpace;
};

export const prefetchChannelMessages = (
	xrpc: ColibriClient,
	channelSpace: string,
): void => {
	if (inflight.has(channelSpace)) return;
	if (inflight.size >= MAX_ENTRIES) {
		const oldest = [...inflight.entries()].sort(
			(a, b) => a[1].startedAt - b[1].startedAt,
		)[0];
		if (oldest) inflight.delete(oldest[0]);
	}

	const promise = xrpc
		.call(colibri.channel.listMessages.main, {
			params: { channel: channelSpace, limit: PREFETCH_LIMIT },
		})
		.catch((err: unknown) => {
			const failure = classifyThrown(err, { method: "channel.listMessages" });
			log.debug("prefetch failed, the channel will fetch normally", {
				code: failure.code,
			});
			return undefined;
		})
		.then((result) => {
			markBoot("prefetch:settled");
			return result;
		});

	inflight.set(channelSpace, { promise, startedAt: Date.now() });
};

export const takeChannelMessages = (
	channelSpace: string,
): Promise<XrpcResult<PrefetchedMessages> | undefined> | undefined => {
	const entry = inflight.get(channelSpace);
	if (!entry) return undefined;
	inflight.delete(channelSpace);
	if (Date.now() - entry.startedAt > MAX_AGE_MS) return undefined;
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
	prefetchChannelMessages(xrpc, space);
	markBoot("prefetch:issued");
};

export const resetChannelPrefetch = (): void => {
	inflight.clear();
};
