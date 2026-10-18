import type { SpaceRef, ThreadView } from "../../data/types";

export const threadAnchorKey = (did: string, rkey: string) => `${did}|${rkey}`;

export const indexThreadAnchors = (
	threads: readonly ThreadView[],
	channel: SpaceRef | undefined,
): ReadonlyMap<string, ThreadView> => {
	const map = new Map<string, ThreadView>();
	if (!channel) return map;
	for (const thread of threads) {
		const anchor = thread.anchor;
		if (!anchor || anchor.space !== channel) continue;
		const key = threadAnchorKey(anchor.did, anchor.rkey);
		if (!map.has(key)) map.set(key, thread);
	}
	return map;
};
