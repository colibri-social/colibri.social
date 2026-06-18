import type { Agent } from "@atproto/api";
import type { ColibriEvent } from "@colibri-social/lib";
import * as Identity from "./com/atproto/identity";
import * as Repo from "./com/atproto/repo";
import * as AtprotoSync from "./com/atproto/sync";
import * as Actor from "./social/colibri/actor";
import * as Category from "./social/colibri/category";
import * as Channel from "./social/colibri/channel";
import * as Community from "./social/colibri/community";
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
			headers: new Headers({
				"atproto-proxy": this.proxyHeader,
				...init?.headers,
			}),
			...init,
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
				resolveDid: (did: string) => Identity.resolveDid(this.proxiedFetch, did),
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
					picture: string | undefined,
					mimeType: string | undefined,
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
					picture?: string,
					mimeType?: string,
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
					return Community.kickUser(this.proxiedFetch, community, identifier, token);
				},
				approveMembership: async (membership: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.community.approveMembership",
					);
					return Community.approveMembership(this.proxiedFetch, membership, token);
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
				listBlockedUsers: (community: string) =>
					Community.listBlockedUsers(this.proxiedFetch, community),
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
					return Community.listApplications(this.proxiedFetch, community, token);
				},
				listRoles: (community: string) =>
					Community.listRoles(this.proxiedFetch, community),
				blockMessage: async (community: string, message: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.community.blockMessage",
					);

					return Community.blockMessage(this.proxiedFetch, community, message, token);
				},
				blockUser: async (community: string, identifier: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.community.blockUser",
					);

					return Community.blockUser(this.proxiedFetch, community, identifier, token);
				},
				unblockUser: async (community: string, identifier: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.community.unblockUser",
					);

					return Community.unblockUser(this.proxiedFetch, community, identifier, token);
				},
				createInvitation: async (community: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.community.createInvitation",
					);

					return Community.createInvitation(this.proxiedFetch, community, token);
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

					return Community.deleteInvitation(this.proxiedFetch, uri, code, token);
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
				update: async (channel: string, name: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.channel.update",
					);
					return Channel.update(this.proxiedFetch, channel, name, token);
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
				) => Channel.listMessages(this.proxiedFetch, channel, limit, cursor, all),
				getReadCursor: async (channel: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.channel.getReadCursor",
					);

					return Channel.getReadCursor(this.proxiedFetch, channel, token);
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
			notification: {
				listNotifications: async (limit?: number, cursor?: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.notification.listNotifications",
					);

					return Notification.listNotifications(this.proxiedFetch, limit, cursor, token);
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
				registerPush: async (subscription: {
					platform: "web" | "tauri";
					endpoint: string;
					keys: { p256dh: string; auth: string };
				}) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.notification.registerPush",
					);

					return Notification.registerPush(this.proxiedFetch, subscription, token);
				},
				unregisterPush: async (endpoint: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.notification.unregisterPush",
					);

					return Notification.unregisterPush(this.proxiedFetch, endpoint, token);
				},
			},
			sync: {
				sendHum: (event: ColibriEvent) => Sync.sendHum(this.proxiedFetch, event),
			},
		},
	};
}
