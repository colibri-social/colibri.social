export const RECORD_IDs: Record<string, `${string}.${string}.${string}`> = {
	ACTOR_DATA: "social.colibri.actor.data",
	ACTOR_PROFILE: "social.colibri.actor.profile",
	COMMUNITY: "social.colibri.community",
	CATEGORY: "social.colibri.category",
	CHANNEL: "social.colibri.channel",
	CHANNEL_READ_CURSOR: "social.colibri.channel.read",
	MESSAGE: "social.colibri.message",
	REACTION: "social.colibri.reaction",
	RICHTEXT_FACET: "social.colibri.richtext.facet",
	MEMBERSHIP: "social.colibri.membership",
	APPROVAL: "social.colibri.approval",
	ROLE: "social.colibri.role",
	MEMBER: "social.colibri.member",
	MODERATION: "social.colibri.moderation",
};

/**
 * NSIDs of the OAuth permission-set lexicons
 */
export const PERMISSION_SET_IDs: Record<
	string,
	`${string}.${string}.${string}`
> = {
	PERMISSION_ACCOUNT: "social.colibri.permissionAccount",
	PERMISSION_COMMUNITY: "social.colibri.permissionCommunity",
	PERMISSION_MESSAGING: "social.colibri.permissionMessaging",
	PERMISSION_NOTIFICATION: "social.colibri.permissionNotification",
	PERMISSION_PUSH: "social.colibri.permissionPush",
};
