const COMMUNITY_SEGMENT = /^\/app\/c\/([^/]+)/;

export type LastViewedChannel = { space: string; type: string };

type StoredChannel = { uri?: unknown; space?: unknown; type?: unknown };

const storageKey = (communityDid: string) => `${communityDid}:last-viewed`;

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
	} catch {}
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
