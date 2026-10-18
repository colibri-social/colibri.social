import type { CommunityView, Did } from "../types";

export const orderCommunities = (
	list: CommunityView[] | undefined,
	order: readonly Did[],
): CommunityView[] | undefined => {
	if (!list || order.length === 0) return list;
	const rank = new Map(order.map((did, index) => [did, index]));
	const ranked = list.filter((entry) => rank.has(entry.did));
	if (ranked.length === 0) return list;
	ranked.sort(
		(a, b) => (rank.get(a.did) as number) - (rank.get(b.did) as number),
	);
	return [...ranked, ...list.filter((entry) => !rank.has(entry.did))];
};
