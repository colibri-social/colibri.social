import type { Agent } from "@atproto/api";
import type { ColibriEvent } from "@colibri-social/lib";
import { resolveDid } from "./com/atproto/identity/resolveDid";
import { resolveHandle } from "./com/atproto/identity/resolveHandle";
import { resolveIdentity } from "./com/atproto/identity/resolveIdentity";
import { listRecords } from "./com/atproto/repo/listRecords";
import { getRecord } from "./com/atproto/sync/getRecord";
import { getData } from "./social/colibri/actor/getData";
import { listCommunities } from "./social/colibri/actor/listCommunities";
import { setState } from "./social/colibri/actor/setState";
import { getReadCursor } from "./social/colibri/channel/getReadCursor";
import { getVoiceToken } from "./social/colibri/channel/getVoiceToken";
import { listMessages } from "./social/colibri/channel/listMessages";
import { approveMembership } from "./social/colibri/community/approveMembership";
import { blockMessage } from "./social/colibri/community/blockMessage";
import { blockUser } from "./social/colibri/community/blockUser";
import { create } from "./social/colibri/community/create";
import { createCategory } from "./social/colibri/community/createCategory";
import { createChannel } from "./social/colibri/community/createChannel";
import { createInvitation } from "./social/colibri/community/createInvitation";
import { deleteCategory } from "./social/colibri/community/deleteCategory";
import { deleteChannel } from "./social/colibri/community/deleteChannel";
import { deleteInvitation } from "./social/colibri/community/deleteInvitation";
import { editCategory } from "./social/colibri/community/editCategory";
import { editChannel } from "./social/colibri/community/editChannel";
import { getData as getCommunityData } from "./social/colibri/community/getData";
import { kick } from "./social/colibri/community/kick";
import { kickUser } from "./social/colibri/community/kickUser";
import { leave } from "./social/colibri/community/leave";
import { listApplications } from "./social/colibri/community/listApplications";
import { listBlockedUsers } from "./social/colibri/community/listBlockedUsers";
import { listCategories } from "./social/colibri/community/listCategories";
import { listChannels } from "./social/colibri/community/listChannels";
import { listInvitations } from "./social/colibri/community/listInvitations";
import { listMembers } from "./social/colibri/community/listMembers";
import { listRoles } from "./social/colibri/community/listRoles";
import { registerCredentials } from "./social/colibri/community/registerCredentials";
import { reorderCategories } from "./social/colibri/community/reorderCategories";
import { reorderChannels } from "./social/colibri/community/reorderChannels";
import { resolveInvitation } from "./social/colibri/community/resolveInvitation";
import { setMemberRoles } from "./social/colibri/community/setMemberRoles";
import { unblockUser } from "./social/colibri/community/unblockUser";
import { update as updateCommunity } from "./social/colibri/community/update";
import { listReactions } from "./social/colibri/message/listReactions";
import { getUnreadCount } from "./social/colibri/notification/getUnreadCount";
import { listNotifications } from "./social/colibri/notification/listNotifications";
import { registerPush } from "./social/colibri/notification/registerPush";
import { unregisterPush } from "./social/colibri/notification/unregisterPush";
import { updateSeen } from "./social/colibri/notification/updateSeen";
import { sendHum } from "./social/colibri/sync/sendHum";

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
				resolveDid: (did: string) => resolveDid(this.proxiedFetch, did),
				resolveHandle: (handle: string) =>
					resolveHandle(this.proxiedFetch, handle),
				resolveIdentity: (identifier: string) =>
					resolveIdentity(this.proxiedFetch, identifier),
			},
			sync: {
				getRecord: (repo: string, collection: string, rkey: string) =>
					getRecord(this.proxiedFetch, repo, collection, rkey),
			},
			repo: {
				listRecords: (
					repo: string,
					collection: string,
					limit?: number,
					cursor?: string,
					reverse?: boolean,
				) =>
					listRecords(
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
				getData: (identifier: string) => getData(this.proxiedFetch, identifier),
				listCommunities: async () => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.actor.listCommunities",
					);

					return listCommunities(this.proxiedFetch, token);
				},
				setState: async (state: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.actor.setState",
					);

					return setState(this.proxiedFetch, state, token);
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

					return create(
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

					return registerCredentials(
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
					return updateCommunity(
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
					return leave(this.proxiedFetch, community, token);
				},
				createCategory: async (community: string, name: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.category.create",
					);
					return createCategory(this.proxiedFetch, community, name, token);
				},
				editCategory: async (category: string, name: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.category.update",
					);
					return editCategory(this.proxiedFetch, category, name, token);
				},
				deleteCategory: async (category: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.category.delete",
					);
					return deleteCategory(this.proxiedFetch, category, token);
				},
				createChannel: async (
					community: string,
					category: string,
					name: string,
					type: string,
				) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.channel.create",
					);
					return createChannel(
						this.proxiedFetch,
						community,
						category,
						name,
						type,
						token,
					);
				},
				editChannel: async (channel: string, name: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.channel.update",
					);
					return editChannel(this.proxiedFetch, channel, name, token);
				},
				deleteChannel: async (channel: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.channel.delete",
					);
					return deleteChannel(this.proxiedFetch, channel, token);
				},
				reorderChannels: async (category: string, channelOrder: string[]) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.community.reorderChannels",
					);
					return reorderChannels(
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
					return reorderCategories(
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
					return kick(this.proxiedFetch, community, member, token);
				},
				kickUser: async (community: string, identifier: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.community.kickUser",
					);
					return kickUser(this.proxiedFetch, community, identifier, token);
				},
				approveMembership: async (membership: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.community.approveMembership",
					);
					return approveMembership(this.proxiedFetch, membership, token);
				},
				setMemberRoles: async (
					community: string,
					member: string,
					roles: string[],
				) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.community.setMemberRoles",
					);
					return setMemberRoles(
						this.proxiedFetch,
						community,
						member,
						roles,
						token,
					);
				},
				getData: (community: string) =>
					getCommunityData(this.proxiedFetch, community),
				listBlockedUsers: (community: string) =>
					listBlockedUsers(this.proxiedFetch, community),
				listCategories: (community: string) =>
					listCategories(this.proxiedFetch, community),
				listChannels: (community: string) =>
					listChannels(this.proxiedFetch, community),
				listMembers: (community: string) =>
					listMembers(this.proxiedFetch, community),
				listApplications: async (community: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.community.listApplications",
					);
					return listApplications(this.proxiedFetch, community, token);
				},
				listRoles: (community: string) =>
					listRoles(this.proxiedFetch, community),
				blockMessage: async (community: string, message: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.community.blockMessage",
					);

					return blockMessage(this.proxiedFetch, community, message, token);
				},
				blockUser: async (community: string, identifier: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.community.blockUser",
					);

					return blockUser(this.proxiedFetch, community, identifier, token);
				},
				unblockUser: async (community: string, identifier: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.community.unblockUser",
					);

					return unblockUser(this.proxiedFetch, community, identifier, token);
				},
				createInvitation: async (community: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.community.createInvitation",
					);

					return createInvitation(this.proxiedFetch, community, token);
				},
				resolveInvitation: (code: string) =>
					resolveInvitation(this.proxiedFetch, code),
				listInvitations: async (uri: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.community.listInvitations",
					);

					return listInvitations(this.proxiedFetch, uri, token);
				},
				deleteInvitation: async (uri: string, code: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.community.deleteInvitation",
					);

					return deleteInvitation(this.proxiedFetch, uri, code, token);
				},
			},
			channel: {
				listMessages: (
					channel: string,
					limit?: number,
					cursor?: string,
					all?: boolean,
				) => listMessages(this.proxiedFetch, channel, limit, cursor, all),
				getReadCursor: async (channel: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.channel.getReadCursor",
					);

					return getReadCursor(this.proxiedFetch, channel, token);
				},
				getVoiceToken: async (channel: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.channel.getVoiceToken",
					);

					return getVoiceToken(this.proxiedFetch, channel, token);
				},
			},
			message: {
				listReactions: (message: string) =>
					listReactions(this.proxiedFetch, message),
			},
			notification: {
				listNotifications: async (limit?: number, cursor?: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.notification.listNotifications",
					);

					return listNotifications(this.proxiedFetch, limit, cursor, token);
				},
				getUnreadCount: async () => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.notification.getUnreadCount",
					);

					return getUnreadCount(this.proxiedFetch, token);
				},
				updateSeen: async (seenAt?: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.notification.updateSeen",
					);

					return updateSeen(this.proxiedFetch, seenAt, token);
				},
				registerPush: async (subscription: {
					platform: "web" | "tauri";
					endpoint: string;
					keys: { p256dh: string; auth: string };
				}) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.notification.registerPush",
					);

					return registerPush(this.proxiedFetch, subscription, token);
				},
				unregisterPush: async (endpoint: string) => {
					const token = await this.generateServiceAuthToken(
						"social.colibri.notification.unregisterPush",
					);

					return unregisterPush(this.proxiedFetch, endpoint, token);
				},
			},
			sync: {
				sendHum: (event: ColibriEvent) => sendHum(this.proxiedFetch, event),
			},
		},
	};
}
