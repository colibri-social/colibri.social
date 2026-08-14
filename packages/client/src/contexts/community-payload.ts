import type { Community as CommunityResponse } from "../atproto/xrpc/social/colibri/community/getData";

export const emptyCommunityPayload = (): CommunityResponse => ({
	community: {
		uri: "",
		name: "",
		description: "",
		categoryOrder: [],
		requiresApprovalToJoin: false,
		linkEmbeds: true,
		appview: "",
	},
	categories: [],
	channels: [],
	roles: [],
	members: [],
	did: "",
});

export const isCommunityPayload = (
	value: CommunityResponse | undefined,
): value is CommunityResponse =>
	value !== undefined &&
	typeof value.community === "object" &&
	value.community !== null &&
	Array.isArray(value.members) &&
	Array.isArray(value.roles) &&
	Array.isArray(value.channels) &&
	Array.isArray(value.categories);
