import { classifyThrown } from "../errors/classify";
import { ambiguousCategoryName } from "../utils/channel-category";
import { createLogger } from "../utils/logger";
import { cacheEnabled, readCommunity } from "./cache/store";
import { colibri } from "./lexicons";
import { spaceAuthority } from "./space-ref";
import type { CategoryView, ChannelView, CommunityView } from "./views";
import type { ColibriClient } from "./xrpc";

const log = createLogger("channel-reference");

const FRESH_FOR_MS = 300_000;

const FAILURE_COOLDOWN_MS = 30_000;

const MAX_COMMUNITIES = 20;

export type ResolvedChannel = {
	space: string;
	name: string;
	type: string;
	communityDid: string;
};

type Entry = {
	fetchedAt: number;
	failed: boolean;
	channelSpaces: Array<string>;
};

const byCommunity = new Map<string, Entry>();

const bySpace = new Map<string, ResolvedChannel>();

const inflight = new Map<string, Promise<void>>();

const evictOldest = (): void => {
	if (byCommunity.size <= MAX_COMMUNITIES) return;

	const oldest = [...byCommunity.entries()].sort(
		(a, b) => a[1].fetchedAt - b[1].fetchedAt,
	)[0];
	if (!oldest) return;

	for (const space of oldest[1].channelSpaces) bySpace.delete(space);
	byCommunity.delete(oldest[0]);
};

export const primeCommunityChannels = (
	communityDid: string,
	channels: Array<ChannelView>,
	fetchedAt = Date.now(),
): void => {
	const previous = byCommunity.get(communityDid);
	if (previous) {
		for (const space of previous.channelSpaces) bySpace.delete(space);
	}

	for (const channel of channels) {
		bySpace.set(channel.space, {
			space: channel.space,
			name: channel.name,
			type: channel.type,
			communityDid,
		});
	}

	byCommunity.set(communityDid, {
		fetchedAt,
		failed: false,
		channelSpaces: channels.map((channel) => channel.space),
	});

	evictOldest();
};

export const peekChannel = (
	channelSpace: string,
): ResolvedChannel | undefined => bySpace.get(channelSpace);

const isFresh = (entry: Entry | undefined): boolean => {
	if (!entry) return false;
	const age = Date.now() - entry.fetchedAt;
	return age < (entry.failed ? FAILURE_COOLDOWN_MS : FRESH_FOR_MS);
};

const fetchChannels = async (
	xrpc: ColibriClient,
	communityDid: string,
	ns: string | undefined,
): Promise<void> => {
	if (ns && cacheEnabled() && !byCommunity.has(communityDid)) {
		const cached = await readCommunity(ns, communityDid);
		if (cached?.channels.length) {
			primeCommunityChannels(communityDid, cached.channels, 0);
		}
	}

	const markFailed = (code: string): void => {
		log.warn("could not resolve channels for a referenced community", { code });
		byCommunity.set(communityDid, {
			fetchedAt: Date.now(),
			failed: true,
			channelSpaces: byCommunity.get(communityDid)?.channelSpaces ?? [],
		});
	};

	try {
		const result = await xrpc.call(colibri.community.listChannels.main, {
			params: { community: communityDid },
		});

		if (!result.ok || !result.data) {
			markFailed(result.ok ? "MalformedResponse" : result.error.code);
			return;
		}

		primeCommunityChannels(communityDid, result.data.channels ?? []);
	} catch (err) {
		markFailed(classifyThrown(err, { method: "community.listChannels" }).code);
	}
};

export const loadCommunityChannels = (
	xrpc: ColibriClient,
	communityDid: string,
	ns?: string,
): Promise<void> => {
	const pending = inflight.get(communityDid);
	if (pending) return pending;

	if (isFresh(byCommunity.get(communityDid))) return Promise.resolve();

	const promise = fetchChannels(xrpc, communityDid, ns).finally(() => {
		inflight.delete(communityDid);
	});

	inflight.set(communityDid, promise);
	return promise;
};

export const UNRESOLVED_CHANNEL_LABEL = "Unknown Channel";

export type ChannelChip = {
	label: string;
	avatar?: string;
	community?: string;
	category?: string;
};

export const resolveChannelChip = (
	channelSpace: string,
	localChannels: Array<ChannelView>,
	communities: Array<CommunityView>,
	currentCommunityDid?: string,
	categories: Array<CategoryView> = [],
): ChannelChip => {
	const local = localChannels.find((entry) => entry.space === channelSpace);
	const name =
		local?.name ?? peekChannel(channelSpace)?.name ?? UNRESOLVED_CHANNEL_LABEL;

	const did = spaceAuthority(channelSpace);
	if (!did || did === currentCommunityDid) {
		const category = local
			? ambiguousCategoryName(local, localChannels, categories)
			: undefined;

		return category ? { label: name, category } : { label: name };
	}

	const community = communities.find((entry) => entry.did === did);
	if (!community) return { label: name };

	return {
		label: name,
		avatar: community.picture,
		community: community.name,
	};
};

export const resetChannelReferences = (): void => {
	byCommunity.clear();
	bySpace.clear();
	inflight.clear();
};
