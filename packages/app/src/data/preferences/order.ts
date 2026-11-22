import type { CommunityView, Did } from "../types";

export const orderCommunities = (
	list: CommunityView[] | undefined,
	order: readonly Did[],
): CommunityView[] | undefined => {
	if (!list) return list;
	const rank = new Map(order.map((did, index) => [did, index]));
	const unranked = list.filter((entry) => !rank.has(entry.did)).reverse();
	const ranked = list
		.filter((entry) => rank.has(entry.did))
		.sort((a, b) => (rank.get(a.did) as number) - (rank.get(b.did) as number));
	return [...unranked, ...ranked];
};
