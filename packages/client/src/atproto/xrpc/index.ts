import type { Agent } from "@atproto/api";
import type { ColibriEvent } from "@colibri-social/lib";
import * as Identity from "./com/atproto/identity";
import * as Repo from "./com/atproto/repo";
import * as AtprotoSync from "./com/atproto/sync";
import * as Actor from "./social/colibri/actor";
import * as Category from "./social/colibri/category";
import * as Channel from "./social/colibri/channel";
import * as Community from "./social/colibri/community";
import * as Embed from "./social/colibri/embed";
import * as Message from "./social/colibri/message";
import * as Notification from "./social/colibri/notification";
import * as Role from "./social/colibri/role";
import * as Sync from "./social/colibri/sync";

type ProxiedFetchFn = (
	xrpcRoute: `/xrpc/${string}`,
	init?: RequestInit,
) => Promise<Response>;

export type XrpcRequest<T extends any[], R> = (
	_fetch: ProxiedFetchFn,
	...params: T
) => R;

export class XrpcClient {
	private pds: string;
	private proxyHeader: string;
	private agent: Agent;

	constructor(pds: string, proxyHeader: string, agent: Agent) {
		this.pds = pds;
		this.proxyHeader = proxyHeader;
		this.agent = agent;
	}

	/**
	 * Fetches a specified XRPC route.
	 * @param xrpcRoute The route to fetch
	 * @returns The fetched data
	 */
	private proxiedFetch: ProxiedFetchFn = (xrpcRoute, init) => {
		const host = import.meta.env.DEV ? `http://localhost:8000` : this.pds;

		return fetch(`${host}${xrpcRoute}`, {
			...init,
			headers: new Headers({
				"atproto-proxy": this.proxyHeader,
				...init?.headers,
			}),
		});
	};

	/**
	 * Requests a service auth token for the specified lexicon method.
	 * @param lxm The method to request the token for.
	 * @returns The token.
	 */
	private generateServiceAuthToken = async (lxm: string) => {
		const { data } = await this.agent.com.atproto.server.getServiceAuth({
			aud: "did:web:api.colibri.social",
			lxm,
			exp: Math.floor(Date.now() / 1000) + 60,
		});

		return data.token;
	};

	public com = {
		atproto: {
			identity: {
				resolveDid: (did: string) =>
					Identity.resolveDid(this.proxiedFetch, did),
				resolveHandle: (handle: string) =>
					Identity.resolveHandle(this.proxiedFetch, handle),
				resolveIdentity: (identifier: string) =>
					Identity.resolveIdentity(this.proxiedFetch, identifier),
			},
			sync: {
				getRecord: (repo: string, collection: string, rkey: string) =>
					AtprotoSync.getRecord(this.proxiedFetch, repo, collection, rkey),
			},
			repo: {
				listRecords: (
					repo: string,
					collection: string,
					limit?: number,
					cursor?: string,
					reverse?: boolean,
				) =>
					Repo.listRecords(
						this.proxiedFetch,
						repo,
						collection,
						limit,
						cursor,
						reverse,
					),
			},
		},
	};

	public social = {
		colibri: {
			actor: {
				getData: (identifier: string) =>
					Actor.getData(this.proxiedFetch, identifier),
				listCommunities: async () => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.actor.listCommunities",
					);

					return Actor.listCommunities(this.proxiedFetch, token);
				},
				listMutes: async () => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.actor.listMutes",
					);

					return Actor.listMutes(this.proxiedFetch, token);
				},
				setState: async (state: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.actor.setState",
					);

					return Actor.setState(this.proxiedFetch, state, token);
				},
			},
			community: {
				create: async (
					name: string,
					description: string | undefined,
					requiresApproval: boolean,
					picture: Blob | undefined,
					mimeType: string | undefined,
					byo?: { pds: string; identifier: string; password: string },
				) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.community.create",
					);

					return Community.create(
						this.proxiedFetch,
						name,
						description,
						requiresApproval,
						token,
						picture,
						mimeType,
						byo,
					);
				},
				registerCredentials: async (
					did: string,
					pds: string,
					identifier: string,
					password: string,
				) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.community.registerCredentials",
					);

					return Community.registerCredentials(
						this.proxiedFetch,
						did,
						pds,
						identifier,
						password,
						token,
					);
				},
				update: async (
					community: string,
					name?: string,
					description?: string,
					picture?: Blob,
					mimeType?: string,
					requiresApprovalToJoin?: boolean,
				) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.community.update",
					);
					return Community.update(
						this.proxiedFetch,
						community,
						name,
						description,
						picture,
						mimeType,
						requiresApprovalToJoin || false,
						token,
					);
				},
				leave: async (community: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.community.leave",
					);
					return Community.leave(this.proxiedFetch, community, token);
				},
				delete: async (community: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.community.delete",
					);
					return Community.delete(this.proxiedFetch, community, token);
				},
				reorderChannels: async (category: string, channelOrder: string[]) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.community.reorderChannels",
					);
					return Community.reorderChannels(
						this.proxiedFetch,
						category,
						channelOrder,
						token,
					);
				},
				reorderCategories: async (
					community: string,
					categoryOrder: string[],
				) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.community.reorderCategories",
					);
					return Community.reorderCategories(
						this.proxiedFetch,
						community,
						categoryOrder,
						token,
					);
				},
				kick: async (community: string, member: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.community.kick",
					);
					return Community.kick(this.proxiedFetch, community, member, token);
				},
				kickUser: async (community: string, identifier: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.community.kickUser",
					);
					return Community.kickUser(
						this.proxiedFetch,
						community,
						identifier,
						token,
					);
				},
				approveMembership: async (membership: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.community.approveMembership",
					);
					return Community.approveMembership(
						this.proxiedFetch,
						membership,
						token,
					);
				},
				dismissApplication: async (community: string, did: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.community.dismissApplication",
					);
					return Community.dismissApplication(
						this.proxiedFetch,
						community,
						did,
						token,
					);
				},
				undismissApplication: async (community: string, did: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.community.undismissApplication",
					);
					return Community.undismissApplication(
						this.proxiedFetch,
						community,
						did,
						token,
					);
				},
				setMemberRoles: async (
					community: string,
					member: string,
					roles: string[],
				) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.community.setMemberRoles",
					);
					return Community.setMemberRoles(
						this.proxiedFetch,
						community,
						member,
						roles,
						token,
					);
				},
				getData: (community: string) =>
					Community.getData(this.proxiedFetch, community),
				listBannedUsers: (community: string) =>
					Community.listBannedUsers(this.proxiedFetch, community),
				listCategories: (community: string) =>
					Community.listCategories(this.proxiedFetch, community),
				listChannels: (community: string) =>
					Community.listChannels(this.proxiedFetch, community),
				listMembers: (community: string) =>
					Community.listMembers(this.proxiedFetch, community),
				listApplications: async (community: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.community.listApplications",
					);
					return Community.listApplications(
						this.proxiedFetch,
						community,
						token,
					);
				},
				listRoles: (community: string) =>
					Community.listRoles(this.proxiedFetch, community),
				blockMessage: async (community: string, message: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.community.blockMessage",
					);

					return Community.blockMessage(
						this.proxiedFetch,
						community,
						message,
						token,
					);
				},
				banUser: async (community: string, identifier: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.community.banUser",
					);

					return Community.banUser(
						this.proxiedFetch,
						community,
						identifier,
						token,
					);
				},
				unbanUser: async (community: string, identifier: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.community.unbanUser",
					);

					return Community.unbanUser(
						this.proxiedFetch,
						community,
						identifier,
						token,
					);
				},
				createInvitation: async (community: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.community.createInvitation",
					);

					return Community.createInvitation(
						this.proxiedFetch,
						community,
						token,
					);
				},
				getInvitation: (code: string) =>
					Community.getInvitation(this.proxiedFetch, code),
				listInvitations: async (uri: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.community.listInvitations",
					);

					return Community.listInvitations(this.proxiedFetch, uri, token);
				},
				deleteInvitation: async (uri: string, code: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.community.deleteInvitation",
					);

					return Community.deleteInvitation(
						this.proxiedFetch,
						uri,
						code,
						token,
					);
				},
			},
			category: {
				create: async (community: string, name: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.category.create",
					);
					return Category.create(this.proxiedFetch, community, name, token);
				},
				update: async (category: string, name: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.category.update",
					);
					return Category.update(this.proxiedFetch, category, name, token);
				},
				delete: async (category: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.category.delete",
					);
					return Category.delete(this.proxiedFetch, category, token);
				},
			},
			channel: {
				create: async (
					community: string,
					category: string,
					name: string,
					type: string,
				) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.channel.create",
					);
					return Channel.create(
						this.proxiedFetch,
						community,
						category,
						name,
						type,
						token,
					);
				},
				update: async (
					channel: string,
					name?: string,
					options?: {
						description?: string;
						ownerOnly?: boolean;
						allowedRoles?: string[];
						clearAllowedRoles?: boolean;
						allowedMembers?: string[];
						clearAllowedMembers?: boolean;
					},
				) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.channel.update",
					);
					return Channel.update(
						this.proxiedFetch,
						channel,
						name,
						options?.description,
						options?.ownerOnly,
						options?.allowedRoles,
						options?.clearAllowedRoles,
						options?.allowedMembers,
						options?.clearAllowedMembers,
						token,
					);
				},
				delete: async (channel: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.channel.delete",
					);
					return Channel.delete(this.proxiedFetch, channel, token);
				},
				listMessages: (
					channel: string,
					limit?: number,
					cursor?: string,
					all?: boolean,
				) =>
					Channel.listMessages(this.proxiedFetch, channel, limit, cursor, all),
				getReadCursor: async (channel: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.channel.getReadCursor",
					);

					return Channel.getReadCursor(this.proxiedFetch, channel, token);
				},
				listUnreadStatus: async (community: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.channel.listUnreadStatus",
					);

					return Channel.listUnreadStatus(this.proxiedFetch, community, token);
				},
				getVoiceToken: async (channel: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.channel.getVoiceToken",
					);

					return Channel.getVoiceToken(this.proxiedFetch, channel, token);
				},
			},
			role: {
				create: async (
					community: string,
					name: string,
					position: number,
					permissions: string[] = [],
					color?: string,
					hoisted?: boolean,
					mentionable?: boolean,
				) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.role.create",
					);
					return Role.create(
						this.proxiedFetch,
						community,
						name,
						position,
						token,
						permissions,
						color,
						hoisted,
						mentionable,
					);
				},
				update: async (
					role: string,
					name?: string,
					color?: string,
					permissions: string[] = [],
					position?: number,
					hoisted?: boolean,
					mentionable?: boolean,
				) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.role.update",
					);
					return Role.update(
						this.proxiedFetch,
						role,
						token,
						name,
						color,
						permissions,
						position,
						hoisted,
						mentionable,
					);
				},
				delete: async (role: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.role.delete",
					);
					return Role.delete(this.proxiedFetch, role, token);
				},
			},
			message: {
				listReactions: (message: string) =>
					Message.listReactions(this.proxiedFetch, message),
			},
			embed: {
				getMetadata: async (uri: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.embed.getMetadata",
					);

					return Embed.getMetadata(this.proxiedFetch, uri, token);
				},
			},
			notification: {
				listNotifications: async (limit?: number, cursor?: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.notification.listNotifications",
					);

					return Notification.listNotifications(
						this.proxiedFetch,
						limit,
						cursor,
						token,
					);
				},
				getUnreadCount: async () => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.notification.getUnreadCount",
					);

					return Notification.getUnreadCount(this.proxiedFetch, token);
				},
				updateSeen: async (seenAt?: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.notification.updateSeen",
					);

					return Notification.updateSeen(this.proxiedFetch, seenAt, token);
				},
				updateSeenForMessage: async (message: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.notification.updateSeenForMessage",
					);

					return Notification.updateSeenForMessage(
						this.proxiedFetch,
						message,
						token,
					);
				},
				getUnseen: async (channel: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.notification.getUnseen",
					);

					return Notification.getUnseen(this.proxiedFetch, channel, token);
				},
				registerPush: async (subscription: {
					platform: "web" | "tauri";
					endpoint: string;
					keys: { p256dh: string; auth: string };
				}) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.notification.registerPush",
					);

					return Notification.registerPush(
						this.proxiedFetch,
						subscription,
						token,
					);
				},
				unregisterPush: async (endpoint: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.notification.unregisterPush",
					);

					return Notification.unregisterPush(
						this.proxiedFetch,
						endpoint,
						token,
					);
				},
			},
			sync: {
				sendHum: (event: ColibriEvent) =>
					Sync.sendHum(this.proxiedFetch, event),
			},
		},
	};
}
