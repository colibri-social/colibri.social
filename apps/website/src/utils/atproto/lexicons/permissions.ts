import type { LexiconDoc } from "@atproto/lexicon";
import { PERMISSION_SET_IDs } from "./ids.ts";

// ---------------------------------------------------------------------------
// OAuth permission sets
//
// Each bundles the granular permissions for one area of the app. OAuth clients
// reference them with a single `include:<nsid>?aud=...` scope instead of listing
// every method/collection. `rpc` permissions use `inheritAud: true` so they
// adopt the audience supplied in the `include:` scope; `repo` permissions need
// no audience. `blob` and `account` permissions cannot live in a permission set
// and stay as direct scopes on the client.
// ---------------------------------------------------------------------------

export const permissionDocs: LexiconDoc[] = [
	{
		lexicon: 1,
		id: PERMISSION_SET_IDs.PERMISSION_ACCOUNT,
		defs: {
			main: {
				type: "permission-set",
				title: "Account & profile",
				detail:
					"Manage your Colibri profile, status, and mutes, and receive realtime updates.",
				permissions: [
					{
						type: "permission",
						resource: "repo",
						collection: [
							"social.colibri.actor.data",
							"social.colibri.actor.profile",
							"social.colibri.actor.mute",
							"social.colibri.actor.gifFavorites",
						],
						action: ["create", "update", "delete"],
					},
					{
						type: "permission",
						resource: "rpc",
						inheritAud: true,
						lxm: [
							"social.colibri.actor.getData",
							"social.colibri.actor.listCommunities",
							"social.colibri.actor.listMutes",
							"social.colibri.actor.setState",
							"social.colibri.sync.subscribeEvents",
							"social.colibri.sync.sendHum",
						],
					},
				],
			},
		},
	},
	{
		lexicon: 1,
		id: PERMISSION_SET_IDs.PERMISSION_COMMUNITY,
		defs: {
			main: {
				type: "permission-set",
				title: "Communities & channels",
				detail:
					"Create and manage communities, categories, channels, and roles, including moderation and invitations.",
				permissions: [
					{
						type: "permission",
						resource: "repo",
						collection: [
							"social.colibri.community",
							"social.colibri.category",
							"social.colibri.channel",
							"social.colibri.role",
						],
						action: ["create", "update", "delete"],
					},
					{
						type: "permission",
						resource: "repo",
						collection: ["social.colibri.channel.read"],
						action: ["create", "update"],
					},
					{
						type: "permission",
						resource: "rpc",
						inheritAud: true,
						lxm: [
							"social.colibri.community.create",
							"social.colibri.community.migrate",
							"social.colibri.community.update",
							"social.colibri.community.delete",
							"social.colibri.community.registerCredentials",
							"social.colibri.community.approveMembership",
							"social.colibri.community.listApplications",
							"social.colibri.community.dismissApplication",
							"social.colibri.community.undismissApplication",
							"social.colibri.community.kick",
							"social.colibri.community.kickUser",
							"social.colibri.community.setMemberRoles",
							"social.colibri.community.leave",
							"social.colibri.community.reorderChannels",
							"social.colibri.community.reorderCategories",
							"social.colibri.community.blockMessage",
							"social.colibri.community.banUser",
							"social.colibri.community.unbanUser",
							"social.colibri.community.createInvitation",
							"social.colibri.community.listInvitations",
							"social.colibri.community.deleteInvitation",
							"social.colibri.category.create",
							"social.colibri.category.update",
							"social.colibri.category.delete",
							"social.colibri.channel.create",
							"social.colibri.channel.update",
							"social.colibri.channel.delete",
							"social.colibri.channel.getReadCursor",
							"social.colibri.channel.listUnreadStatus",
							"social.colibri.voice.signal",
							"social.colibri.voice.moderate",
							"social.colibri.role.create",
							"social.colibri.role.update",
							"social.colibri.role.delete",
							"social.colibri.embed.getMetadata",
							"social.colibri.embed.searchGifs",
							"social.colibri.embed.trendingGifs",
							"social.colibri.embed.gifCategories",
							"social.colibri.community.getData",
							"social.colibri.community.listBannedUsers",
							"social.colibri.community.listCategories",
							"social.colibri.community.listChannels",
							"social.colibri.community.listMembers",
							"social.colibri.community.listRoles",
							"social.colibri.community.getInvitation",
							"social.colibri.channel.listMessages",
							"social.colibri.channel.getChannelView",
						],
					},
				],
			},
		},
	},
	{
		lexicon: 1,
		id: PERMISSION_SET_IDs.PERMISSION_MESSAGING,
		defs: {
			main: {
				type: "permission-set",
				title: "Messages & membership",
				detail:
					"Send and edit messages, react, join communities, and submit membership applications.",
				permissions: [
					{
						type: "permission",
						resource: "repo",
						collection: ["social.colibri.message", "social.colibri.reaction"],
						action: ["create", "update", "delete"],
					},
					{
						type: "permission",
						resource: "repo",
						collection: [
							"social.colibri.membership",
							"social.colibri.approval",
						],
						action: ["create", "delete"],
					},
					{
						type: "permission",
						resource: "rpc",
						inheritAud: true,
						lxm: ["social.colibri.channel.listReactions"],
					},
				],
			},
		},
	},
	{
		lexicon: 1,
		id: PERMISSION_SET_IDs.PERMISSION_NOTIFICATION,
		defs: {
			main: {
				type: "permission-set",
				title: "Notifications",
				detail: "Read your notifications and mark them as seen.",
				permissions: [
					{
						type: "permission",
						resource: "rpc",
						inheritAud: true,
						lxm: [
							"social.colibri.notification.listNotifications",
							"social.colibri.notification.getUnreadCount",
							"social.colibri.notification.updateSeen",
							"social.colibri.notification.updateSeenForMessage",
							"social.colibri.notification.getUnseen",
						],
					},
				],
			},
		},
	},
	{
		lexicon: 1,
		id: PERMISSION_SET_IDs.PERMISSION_PUSH,
		defs: {
			main: {
				type: "permission-set",
				title: "Push notifications",
				detail: "Manage your push notification subscriptions.",
				permissions: [
					{
						type: "permission",
						resource: "rpc",
						inheritAud: true,
						lxm: [
							"social.colibri.notification.registerPush",
							"social.colibri.notification.unregisterPush",
						],
					},
				],
			},
		},
	},
];
