export type CommunityResolveState = "idle" | "resolving" | "stalled";

export const isCommunityResolving = (
	identifier: string,
	loading: boolean,
	settledIdentifier: string | undefined,
): boolean =>
	identifier !== "" && (loading || settledIdentifier !== identifier);

export const communityResolveState = (
	resolving: boolean,
	stalled: boolean,
): CommunityResolveState => {
	if (!resolving) return "idle";
	return stalled ? "stalled" : "resolving";
};
