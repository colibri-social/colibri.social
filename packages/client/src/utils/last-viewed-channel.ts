const COMMUNITY_SEGMENT = /^\/app\/c\/([^/]+)/;

export type LastViewedChannel = { space: string; type: string };

type StoredChannel = { uri?: unknown; space?: unknown; type?: unknown };

const storageKey = (communityDid: string) => `${communityDid}:last-viewed`;

const LAST_COMMUNITY_KEY = "last-viewed-community";

let coldStartCommunity: string | undefined;
let coldStartClaimed = false;

export const readLastViewedChannel = (
	communityDid: string,
): LastViewedChannel | undefined => {
	let raw: string | null = null;
	try {
		raw = localStorage.getItem(storageKey(communityDid));
	} catch {
		return undefined;
	}
	if (!raw) return undefined;

	let stored: StoredChannel;
	try {
		stored = JSON.parse(raw) as StoredChannel;
	} catch {
		return undefined;
	}

	const space = typeof stored.uri === "string" ? stored.uri : stored.space;
	if (typeof space !== "string" || !space) return undefined;
	if (typeof stored.type !== "string" || !stored.type) return undefined;

	return { space, type: stored.type };
};

export const rememberLastViewedChannel = (
	communityDid: string,
	channel: LastViewedChannel,
): void => {
	try {
		localStorage.setItem(
			storageKey(communityDid),
			JSON.stringify({ uri: channel.space, type: channel.type }),
		);
		localStorage.setItem(LAST_COMMUNITY_KEY, communityDid);
	} catch {}
	coldStartClaimed = true;
	coldStartCommunity = undefined;
};

export const readLastViewedCommunity = (): string | undefined => {
	try {
		return localStorage.getItem(LAST_COMMUNITY_KEY) ?? undefined;
	} catch {
		return undefined;
	}
};

export const claimColdStartCommunity = (
	isMember: (communityDid: string) => boolean,
): string | undefined => {
	if (coldStartClaimed) return undefined;
	coldStartClaimed = true;
	const community = readLastViewedCommunity();
	if (!community || !isMember(community)) return undefined;
	coldStartCommunity = community;
	return community;
};

export const cancelColdStartRestore = (): void => {
	coldStartClaimed = true;
	coldStartCommunity = undefined;
};

export const isColdStartRestorePending = (communityDid: string): boolean =>
	coldStartCommunity === communityDid;

export const takeColdStartRestore = (communityDid: string): boolean => {
	if (coldStartCommunity !== communityDid) return false;
	coldStartCommunity = undefined;
	return true;
};

export const lastViewedChannelPath = (pathname: string): string | undefined => {
	const segment = COMMUNITY_SEGMENT.exec(pathname)?.[1];
	if (!segment) return undefined;

	const channel = readLastViewedChannel(segment);
	if (!channel) return undefined;

	const identifier = channel.space.split("/").pop();
	if (!identifier) return undefined;

	return `/app/c/${segment}/${channel.type}/${identifier}`;
};
