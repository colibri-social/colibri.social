import type { Community as CommunityResponse } from "../xrpc/social/colibri/community/getData";

const MAX_ENTRIES = 5;

const byKey = new Map<string, CommunityResponse>();

export const rememberCommunity = (
	key: string,
	payload: CommunityResponse,
): void => {
	byKey.delete(key);
	byKey.set(key, payload);

	while (byKey.size > MAX_ENTRIES) {
		const oldest = byKey.keys().next();
		if (oldest.done) break;
		byKey.delete(oldest.value);
	}
};

export const recallCommunity = (key: string): CommunityResponse | undefined => {
	const payload = byKey.get(key);
	if (payload === undefined) return undefined;

	byKey.delete(key);
	byKey.set(key, payload);
	return payload;
};

export const forgetCommunity = (key: string): void => {
	byKey.delete(key);
};
