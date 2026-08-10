import { classifyThrown } from "../errors/classify";
import { lastViewedChannelPath } from "../utils/last-viewed-channel";
import { createLogger } from "../utils/logger";
import { markBoot } from "../utils/perf";
import { parseChannelPath } from "./colibri-channel-url";
import type { XrpcClient } from "./xrpc";
import type { XrpcResult } from "./xrpc/result";
import type { Response as ChannelView } from "./xrpc/social/colibri/channel/getChannelView";

const log = createLogger("channel-prefetch");

const PREFETCH_LIMIT = 50;

const MAX_AGE_MS = 20_000;

const MAX_ENTRIES = 2;

const TEXT_CHANNEL_TYPES = ["text", "social.colibri.channel.text"];

type Entry = {
	promise: Promise<XrpcResult<ChannelView> | undefined>;
	startedAt: number;
};

const inflight = new Map<string, Entry>();

export const channelUriFromPath = (pathname: string): string | undefined => {
	const target = parseChannelPath(pathname);
	if (!target) return undefined;
	if (!TEXT_CHANNEL_TYPES.includes(target.channelType)) return undefined;

	return target.channelUri;
};

export const prefetchChannelView = (xrpc: XrpcClient, uri: string): void => {
	if (inflight.has(uri)) return;
	if (inflight.size >= MAX_ENTRIES) {
		const oldest = [...inflight.entries()].sort(
			(a, b) => a[1].startedAt - b[1].startedAt,
		)[0];
		if (oldest) inflight.delete(oldest[0]);
	}

	const promise = xrpc.social.colibri.channel
		.getChannelView(uri, PREFETCH_LIMIT)
		.catch((err: unknown) => {
			const failure = classifyThrown(err, {
				method: "channel.getChannelView",
			});
			log.debug("prefetch failed, the channel will fetch normally", {
				code: failure.code,
			});
			return undefined;
		})
		.then((result) => {
			markBoot("prefetch:settled");
			return result;
		});

	inflight.set(uri, { promise, startedAt: Date.now() });
};

export const takeChannelView = (
	uri: string,
): Promise<XrpcResult<ChannelView> | undefined> | undefined => {
	const entry = inflight.get(uri);
	if (!entry) return undefined;
	inflight.delete(uri);
	if (Date.now() - entry.startedAt > MAX_AGE_MS) return undefined;
	return entry.promise;
};

export const primeFromLocation = (xrpc: XrpcClient): void => {
	if (typeof window === "undefined") return;
	const path = window.location.pathname;
	const uri =
		channelUriFromPath(path) ??
		(() => {
			const fallback = lastViewedChannelPath(path);
			return fallback ? channelUriFromPath(fallback) : undefined;
		})();
	if (!uri) return;
	prefetchChannelView(xrpc, uri);
	markBoot("prefetch:issued");
};

export const resetChannelPrefetch = (): void => {
	inflight.clear();
};
