import type { Community as CommunityView } from "@colibri-social/lib";
import { classifyThrown } from "../errors/classify";
import { createLogger } from "../utils/logger";
import { cacheEnabled, readCommunity } from "./cache/store";
import { resolveBlob } from "./resolve-blob";
import type { XrpcClient } from "./xrpc";
import type { Channel } from "./xrpc/social/colibri/community/listChannels";

const log = createLogger("channel-reference");

const FRESH_FOR_MS = 300_000;

const FAILURE_COOLDOWN_MS = 30_000;

const MAX_COMMUNITIES = 20;

export type ResolvedChannel = {
	uri: string;
	name: string;
	type: string;
	communityUri: string;
};

type Entry = {
	fetchedAt: number;
	failed: boolean;
	channelUris: Array<string>;
};

const byCommunity = new Map<string, Entry>();

const byChannel = new Map<string, ResolvedChannel>();

const inflight = new Map<string, Promise<void>>();

const evictOldest = (): void => {
	if (byCommunity.size <= MAX_COMMUNITIES) return;

	const oldest = [...byCommunity.entries()].sort(
		(a, b) => a[1].fetchedAt - b[1].fetchedAt,
	)[0];
	if (!oldest) return;

	for (const uri of oldest[1].channelUris) byChannel.delete(uri);
	byCommunity.delete(oldest[0]);
};

export const primeCommunityChannels = (
	communityUri: string,
	channels: Array<Channel>,
	fetchedAt = Date.now(),
): void => {
	const previous = byCommunity.get(communityUri);
	if (previous) {
		for (const uri of previous.channelUris) byChannel.delete(uri);
	}

	for (const channel of channels) {
		byChannel.set(channel.uri, {
			uri: channel.uri,
			name: channel.name,
			type: channel.type,
			communityUri,
		});
	}

	byCommunity.set(communityUri, {
		fetchedAt,
		failed: false,
		channelUris: channels.map((channel) => channel.uri),
	});

	evictOldest();
};

export const peekChannel = (channelUri: string): ResolvedChannel | undefined =>
	byChannel.get(channelUri);

const isFresh = (entry: Entry | undefined): boolean => {
	if (!entry) return false;
	const age = Date.now() - entry.fetchedAt;
	return age < (entry.failed ? FAILURE_COOLDOWN_MS : FRESH_FOR_MS);
};

const fetchChannels = async (
	xrpc: XrpcClient,
	communityUri: string,
	ns: string | undefined,
): Promise<void> => {
	if (ns && cacheEnabled() && !byCommunity.has(communityUri)) {
		const cached = await readCommunity(ns, communityUri);
		if (cached?.channels) {
			primeCommunityChannels(communityUri, cached.channels, 0);
		}
	}

	const markFailed = (code: string): void => {
		log.warn("could not resolve channels for a referenced community", { code });
		byCommunity.set(communityUri, {
			fetchedAt: Date.now(),
			failed: true,
			channelUris: byCommunity.get(communityUri)?.channelUris ?? [],
		});
	};

	try {
		const result = await xrpc.social.colibri.community.getData(communityUri);

		if (!result.ok || !result.data) {
			markFailed(result.ok ? "MalformedResponse" : result.error.code);
			return;
		}

		primeCommunityChannels(communityUri, result.data.channels ?? []);
	} catch (err) {
		markFailed(classifyThrown(err, { method: "community.getData" }).code);
	}
};

export const loadCommunityChannels = (
	xrpc: XrpcClient,
	communityUri: string,
	ns?: string,
): Promise<void> => {
	const pending = inflight.get(communityUri);
	if (pending) return pending;

	if (isFresh(byCommunity.get(communityUri))) return Promise.resolve();

	const promise = fetchChannels(xrpc, communityUri, ns).finally(() => {
		inflight.delete(communityUri);
	});

	inflight.set(communityUri, promise);
	return promise;
};

export const UNRESOLVED_CHANNEL_LABEL = "Unknown Channel";

export type ChannelChip = {
	label: string;
	avatar?: string;
	community?: string;
};

const didOf = (uri: string): string => uri.split("/")[2] ?? "";

export const resolveChannelChip = (
	channelUri: string,
	localChannels: Array<Channel>,
	communities: Array<CommunityView>,
	currentCommunityUri?: string,
): ChannelChip => {
	const name =
		localChannels.find((entry) => entry.uri === channelUri)?.name ??
		peekChannel(channelUri)?.name ??
		UNRESOLVED_CHANNEL_LABEL;

	const did = didOf(channelUri);
	if (!did || (currentCommunityUri && did === didOf(currentCommunityUri))) {
		return { label: name };
	}

	const matches = communities.filter((entry) => didOf(entry.uri) === did);
	const community =
		matches.find((entry) => entry.uri.endsWith("/self")) ?? matches[0];
	if (!community) return { label: name };

	return {
		label: name,
		avatar: resolveBlob(did, community.picture, "small"),
		community: community.name,
	};
};

export const resetChannelReferences = (): void => {
	byCommunity.clear();
	byChannel.clear();
	inflight.clear();
};
