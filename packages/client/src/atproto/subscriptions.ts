export type SubscriptionTarget = {
	communities?: ReadonlyArray<string>;
	channels?: ReadonlyArray<string>;
};

export type SubscriptionSets = {
	communities: ReadonlySet<string>;
	channels: ReadonlySet<string>;
};

export type SubscriptionDelta = {
	communities: Array<string>;
	channels: Array<string>;
};

export const isEmptyDelta = (delta: SubscriptionDelta): boolean =>
	delta.communities.length === 0 && delta.channels.length === 0;

export const mergeDelta = (
	into: SubscriptionDelta | null,
	next: SubscriptionDelta,
): SubscriptionDelta => ({
	communities: [...(into?.communities ?? []), ...next.communities],
	channels: [...(into?.channels ?? []), ...next.channels],
});

export type SubscriptionLedger = {
	retain: (target: SubscriptionTarget) => SubscriptionDelta;
	release: (target: SubscriptionTarget) => SubscriptionDelta;
	wanted: () => SubscriptionSets;
	missing: (granted: SubscriptionSets) => SubscriptionSets;
};

const retainKeys = (
	counts: Map<string, number>,
	keys: ReadonlyArray<string> | undefined,
): Array<string> => {
	const fresh: Array<string> = [];
	for (const key of keys ?? []) {
		const previous = counts.get(key) ?? 0;
		counts.set(key, previous + 1);
		if (previous === 0) fresh.push(key);
	}
	return fresh;
};

const releaseKeys = (
	counts: Map<string, number>,
	keys: ReadonlyArray<string> | undefined,
): Array<string> => {
	const dropped: Array<string> = [];
	for (const key of keys ?? []) {
		const previous = counts.get(key) ?? 0;
		if (previous === 0) continue;
		if (previous === 1) {
			counts.delete(key);
			dropped.push(key);
			continue;
		}
		counts.set(key, previous - 1);
	}
	return dropped;
};

export const createSubscriptionLedger = (): SubscriptionLedger => {
	const communities = new Map<string, number>();
	const channels = new Map<string, number>();

	return {
		retain: (target) => ({
			communities: retainKeys(communities, target.communities),
			channels: retainKeys(channels, target.channels),
		}),
		release: (target) => ({
			communities: releaseKeys(communities, target.communities),
			channels: releaseKeys(channels, target.channels),
		}),
		wanted: () => ({
			communities: new Set(communities.keys()),
			channels: new Set(channels.keys()),
		}),
		missing: (granted) => ({
			communities: new Set(
				[...communities.keys()].filter((did) => !granted.communities.has(did)),
			),
			channels: new Set(
				[...channels.keys()].filter((space) => !granted.channels.has(space)),
			),
		}),
	};
};
