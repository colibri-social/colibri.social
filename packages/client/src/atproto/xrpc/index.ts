import type { Agent } from "@atproto/api";
import type { ColibriEvent } from "@colibri-social/lib";
import { perfNow, recordRequest } from "../../utils/perf";
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
	private proxyHeader: string;
	private notifProxyHeader: string;
	private agent: Agent;

	constructor(proxyHeader: string, agent: Agent) {
		this.proxyHeader = proxyHeader;
		// Push registration belongs to the notification service. Both fragments
		// resolve to the same endpoint today, but routing push calls through
		// `#colibri_notif` honours the declared service split and future-proofs
		// moving the notification service to its own deployment. The notification
		// *feed* reads (list/count/seen) stay on the AppView.
		this.notifProxyHeader = proxyHeader.replace(/#.*$/, "#colibri_notif");
		this.agent = agent;
	}

	/**
	 * Fetches a specified XRPC route against a Colibri service, selected by the
	 * `atproto-proxy` fragment in `proxyHeader`.
	 *
	 * In production the request is sent through the user's PDS using the
	 * authenticated (DPoP-bound) session: the `atproto-proxy` header tells the
	 * PDS which service to forward it to, and the PDS mints the service-auth
	 * token on our behalf and attaches it as `Authorization: Bearer`. We
	 * therefore do not mint a token client-side (see
	 * {@link generateServiceAuthToken}).
	 *
	 * In development there is no PDS in the loop — we talk straight to the local
	 * AppView — so the caller mints the service-auth token itself and attaches
	 * it as the `Authorization: Bearer` header (see {@link authed}); the
	 * AppView's request fairing lifts that header into the `?auth=` query its
	 * handlers read.
	 *
	 * @param proxyHeader The `did#service` to proxy to.
	 * @param xrpcRoute The route to fetch (origin-less: `/xrpc/...`).
	 * @returns The raw response.
	 */
	private dispatch(
		proxyHeader: string,
		xrpcRoute: `/xrpc/${string}`,
		init?: RequestInit,
	): Promise<Response> {
		const headers = { "atproto-proxy": proxyHeader, ...init?.headers };

		const method = xrpcRoute.replace(/^\/xrpc\//, "").split("?")[0];
		const start = perfNow();
		const request = import.meta.env.DEV
			? fetch(`http://localhost:8000${xrpcRoute}`, {
					...init,
					headers: new Headers(headers),
				})
			: this.agent.fetchHandler(xrpcRoute, { ...init, headers });

		return request.then(
			(res) => {
				recordRequest(method, start, perfNow() - start, res.ok);
				return res;
			},
			(err) => {
				recordRequest(method, start, perfNow() - start, false);
				throw err;
			},
		);
	}

	/** Proxied fetch targeting the AppView (`#colibri_appview`). */
	private proxiedFetch: ProxiedFetchFn = (xrpcRoute, init) =>
		this.dispatch(this.proxyHeader, xrpcRoute, init);

	/** Proxied fetch targeting the notification service (`#colibri_notif`). */
	private notifFetch: ProxiedFetchFn = (xrpcRoute, init) =>
		this.dispatch(this.notifProxyHeader, xrpcRoute, init);

	/**
	 * Requests a service auth token for the specified lexicon method.
	 *
	 * Only used in development: in production the PDS mints the token during
	 * proxying (see {@link proxiedFetch}), so we skip the extra round-trip and
	 * return an empty token — {@link authed} then sends no `Authorization`
	 * header and lets the PDS-set one through.
	 *
	 * @param lxm The method to request the token for.
	 * @param aud The service-reference audience (DID + `#service` fragment) the
	 *   token is minted for. OAuth rpc permissions carry a service-reference
	 *   audience and are matched by exact string equality, so this must equal
	 *   the audience the granting permission set was `include:`d under (which is
	 *   the service the request is proxied to). A bare DID never matches.
	 * @returns The token, or an empty string in production.
	 */
	private generateServiceAuthToken = async (lxm: string, aud: string) => {
		if (!import.meta.env.DEV) return "";

		const { data } = await this.agent.com.atproto.server.getServiceAuth({
			aud,
			lxm,
			exp: Math.floor(Date.now() / 1000) + 60,
		});

		return data.token;
	};

	/**
	 * Wraps a base proxied-fetch fn so the request carries service auth for the
	 * given lexicon method.
	 *
	 * In production the PDS mints the token during proxying and attaches the
	 * `Authorization` header itself, so {@link generateServiceAuthToken} returns
	 * an empty string and this is a transparent passthrough. In development we
	 * mint the token client-side and attach it as the `Authorization: Bearer`
	 * header (the AppView's request fairing lifts it into the `?auth=` query its
	 * handlers read).
	 *
	 * @param base The underlying fetch (AppView or notification service).
	 * @param lxm The method the auth token is scoped to.
	 */
	private authed(base: ProxiedFetchFn, lxm: string): ProxiedFetchFn {
		const aud =
			base === this.notifFetch ? this.notifProxyHeader : this.proxyHeader;
		return async (xrpcRoute, init) => {
			const token = await this.generateServiceAuthToken(lxm, aud);
			if (!token) return base(xrpcRoute, init);

			return base(xrpcRoute, {
				...init,
				headers: { ...init?.headers, Authorization: `Bearer ${token}` },
			});
		};
	}

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
				listCommunities: () =>
					Actor.listCommunities(
						this.authed(
							this.proxiedFetch,
							"social.colibri.actor.listCommunities",
						),
					),
				listMutes: () =>
					Actor.listMutes(
						this.authed(this.proxiedFetch, "social.colibri.actor.listMutes"),
					),
				setState: (state: string) =>
					Actor.setState(
						this.authed(this.proxiedFetch, "social.colibri.actor.setState"),
						state,
					),
			},
			community: {
				create: (
					name: string,
					description: string | undefined,
					requiresApproval: boolean,
					picture: Blob | undefined,
					mimeType: string | undefined,
					byo?: { pds: string; identifier: string; password: string },
				) =>
					Community.create(
						this.authed(this.proxiedFetch, "social.colibri.community.create"),
						name,
						description,
						requiresApproval,
						picture,
						mimeType,
						byo,
					),
				registerCredentials: (
					did: string,
					pds: string,
					identifier: string,
					password: string,
				) =>
					Community.registerCredentials(
						this.authed(
							this.proxiedFetch,
							"social.colibri.community.registerCredentials",
						),
						did,
						pds,
						identifier,
						password,
					),
				update: (
					community: string,
					name?: string,
					description?: string,
					picture?: Blob,
					mimeType?: string,
					requiresApprovalToJoin?: boolean,
				) =>
					Community.update(
						this.authed(this.proxiedFetch, "social.colibri.community.update"),
						community,
						name,
						description,
						picture,
						mimeType,
						requiresApprovalToJoin || false,
					),
				leave: (community: string) =>
					Community.leave(
						this.authed(this.proxiedFetch, "social.colibri.community.leave"),
						community,
					),
				delete: (community: string) =>
					Community.delete(
						this.authed(this.proxiedFetch, "social.colibri.community.delete"),
						community,
					),
				reorderChannels: (category: string, channelOrder: string[]) =>
					Community.reorderChannels(
						this.authed(
							this.proxiedFetch,
							"social.colibri.community.reorderChannels",
						),
						category,
						channelOrder,
					),
				reorderCategories: (community: string, categoryOrder: string[]) =>
					Community.reorderCategories(
						this.authed(
							this.proxiedFetch,
							"social.colibri.community.reorderCategories",
						),
						community,
						categoryOrder,
					),
				kick: (community: string, member: string) =>
					Community.kick(
						this.authed(this.proxiedFetch, "social.colibri.community.kick"),
						community,
						member,
					),
				kickUser: (community: string, identifier: string) =>
					Community.kickUser(
						this.authed(this.proxiedFetch, "social.colibri.community.kickUser"),
						community,
						identifier,
					),
				approveMembership: (membership: string) =>
					Community.approveMembership(
						this.authed(
							this.proxiedFetch,
							"social.colibri.community.approveMembership",
						),
						membership,
					),
				dismissApplication: (community: string, did: string) =>
					Community.dismissApplication(
						this.authed(
							this.proxiedFetch,
							"social.colibri.community.dismissApplication",
						),
						community,
						did,
					),
				undismissApplication: (community: string, did: string) =>
					Community.undismissApplication(
						this.authed(
							this.proxiedFetch,
							"social.colibri.community.undismissApplication",
						),
						community,
						did,
					),
				setMemberRoles: (community: string, member: string, roles: string[]) =>
					Community.setMemberRoles(
						this.authed(
							this.proxiedFetch,
							"social.colibri.community.setMemberRoles",
						),
						community,
						member,
						roles,
					),
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
				listApplications: (community: string) =>
					Community.listApplications(
						this.authed(
							this.proxiedFetch,
							"social.colibri.community.listApplications",
						),
						community,
					),
				listRoles: (community: string) =>
					Community.listRoles(this.proxiedFetch, community),
				blockMessage: (community: string, message: string) =>
					Community.blockMessage(
						this.authed(
							this.proxiedFetch,
							"social.colibri.community.blockMessage",
						),
						community,
						message,
					),
				banUser: (community: string, identifier: string) =>
					Community.banUser(
						this.authed(this.proxiedFetch, "social.colibri.community.banUser"),
						community,
						identifier,
					),
				unbanUser: (community: string, identifier: string) =>
					Community.unbanUser(
						this.authed(
							this.proxiedFetch,
							"social.colibri.community.unbanUser",
						),
						community,
						identifier,
					),
				createInvitation: (community: string) =>
					Community.createInvitation(
						this.authed(
							this.proxiedFetch,
							"social.colibri.community.createInvitation",
						),
						community,
					),
				getInvitation: (code: string) =>
					Community.getInvitation(this.proxiedFetch, code),
				listInvitations: (uri: string) =>
					Community.listInvitations(
						this.authed(
							this.proxiedFetch,
							"social.colibri.community.listInvitations",
						),
						uri,
					),
				deleteInvitation: (uri: string, code: string) =>
					Community.deleteInvitation(
						this.authed(
							this.proxiedFetch,
							"social.colibri.community.deleteInvitation",
						),
						uri,
						code,
					),
			},
			category: {
				create: (community: string, name: string) =>
					Category.create(
						this.authed(this.proxiedFetch, "social.colibri.category.create"),
						community,
						name,
					),
				update: (category: string, name: string) =>
					Category.update(
						this.authed(this.proxiedFetch, "social.colibri.category.update"),
						category,
						name,
					),
				delete: (category: string) =>
					Category.delete(
						this.authed(this.proxiedFetch, "social.colibri.category.delete"),
						category,
					),
			},
			channel: {
				create: (
					community: string,
					category: string,
					name: string,
					type: string,
					allowedRoles?: string[],
					allowedMembers?: string[],
				) =>
					Channel.create(
						this.authed(this.proxiedFetch, "social.colibri.channel.create"),
						community,
						category,
						name,
						type,
						allowedRoles,
						allowedMembers,
					),
				update: (
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
				) =>
					Channel.update(
						this.authed(this.proxiedFetch, "social.colibri.channel.update"),
						channel,
						name,
						options?.description,
						options?.ownerOnly,
						options?.allowedRoles,
						options?.clearAllowedRoles,
						options?.allowedMembers,
						options?.clearAllowedMembers,
					),
				delete: (channel: string) =>
					Channel.delete(
						this.authed(this.proxiedFetch, "social.colibri.channel.delete"),
						channel,
					),
				listMessages: (
					channel: string,
					limit?: number,
					cursor?: string,
					all?: boolean,
				) =>
					Channel.listMessages(this.proxiedFetch, channel, limit, cursor, all),
				getChannelView: (channel: string, limit?: number) =>
					Channel.getChannelView(
						this.authed(
							this.proxiedFetch,
							"social.colibri.channel.getChannelView",
						),
						channel,
						limit,
					),
				getReadCursor: (channel: string) =>
					Channel.getReadCursor(
						this.authed(
							this.proxiedFetch,
							"social.colibri.channel.getReadCursor",
						),
						channel,
					),
				listUnreadStatus: (community: string) =>
					Channel.listUnreadStatus(
						this.authed(
							this.proxiedFetch,
							"social.colibri.channel.listUnreadStatus",
						),
						community,
					),
				getVoiceToken: (channel: string) =>
					Channel.getVoiceToken(
						this.authed(
							this.proxiedFetch,
							"social.colibri.channel.getVoiceToken",
						),
						channel,
					),
			},
			role: {
				create: (
					community: string,
					name: string,
					position: number,
					permissions: string[] = [],
					color?: string,
					hoisted?: boolean,
					mentionable?: boolean,
				) =>
					Role.create(
						this.authed(this.proxiedFetch, "social.colibri.role.create"),
						community,
						name,
						position,
						permissions,
						color,
						hoisted,
						mentionable,
					),
				update: (
					role: string,
					name?: string,
					color?: string,
					permissions: string[] = [],
					position?: number,
					hoisted?: boolean,
					mentionable?: boolean,
				) =>
					Role.update(
						this.authed(this.proxiedFetch, "social.colibri.role.update"),
						role,
						name,
						color,
						permissions,
						position,
						hoisted,
						mentionable,
					),
				delete: (role: string) =>
					Role.delete(
						this.authed(this.proxiedFetch, "social.colibri.role.delete"),
						role,
					),
			},
			message: {
				listReactions: (message: string) =>
					Message.listReactions(this.proxiedFetch, message),
			},
			embed: {
				getMetadata: (uri: string) =>
					Embed.getMetadata(
						this.authed(this.proxiedFetch, "social.colibri.embed.getMetadata"),
						uri,
					),
				searchGifs: (query: string, page?: number) =>
					Embed.searchGifs(
						this.authed(this.proxiedFetch, "social.colibri.embed.searchGifs"),
						query,
						page,
					),
				trendingGifs: (page?: number) =>
					Embed.trendingGifs(
						this.authed(this.proxiedFetch, "social.colibri.embed.trendingGifs"),
						page,
					),
				gifCategories: () =>
					Embed.gifCategories(
						this.authed(
							this.proxiedFetch,
							"social.colibri.embed.gifCategories",
						),
					),
			},
			notification: {
				listNotifications: (limit?: number, cursor?: string) =>
					Notification.listNotifications(
						this.authed(
							this.proxiedFetch,
							"social.colibri.notification.listNotifications",
						),
						limit,
						cursor,
					),
				getUnreadCount: () =>
					Notification.getUnreadCount(
						this.authed(
							this.proxiedFetch,
							"social.colibri.notification.getUnreadCount",
						),
					),
				updateSeen: (seenAt?: string) =>
					Notification.updateSeen(
						this.authed(
							this.proxiedFetch,
							"social.colibri.notification.updateSeen",
						),
						seenAt,
					),
				updateSeenForMessage: (message: string) =>
					Notification.updateSeenForMessage(
						this.authed(
							this.proxiedFetch,
							"social.colibri.notification.updateSeenForMessage",
						),
						message,
					),
				getUnseen: (channel: string) =>
					Notification.getUnseen(
						this.authed(
							this.proxiedFetch,
							"social.colibri.notification.getUnseen",
						),
						channel,
					),
				registerPush: (subscription: {
					platform: "web" | "tauri";
					endpoint: string;
					keys: { p256dh: string; auth: string };
				}) =>
					Notification.registerPush(
						this.authed(
							this.notifFetch,
							"social.colibri.notification.registerPush",
						),
						subscription,
					),
				unregisterPush: (endpoint: string) =>
					Notification.unregisterPush(
						this.authed(
							this.notifFetch,
							"social.colibri.notification.unregisterPush",
						),
						endpoint,
					),
			},
			sync: {
				sendHum: (event: ColibriEvent) =>
					Sync.sendHum(this.proxiedFetch, event),
			},
		},
	};
}
