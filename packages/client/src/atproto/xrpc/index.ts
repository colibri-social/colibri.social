import type { Agent } from "@atproto/api";
import { getData } from "./social/colibri/actor/getData";
import { listCommunities } from "./social/colibri/actor/listCommunities";

export const xrpc = {
	social: {
		colibri: {
			actor: {
				getData,
			},
		},
	},
};

type ProxiedFetchFn = (xrpcRoute: `/xrpc/${string}`) => Promise<Response>;

export type XrpcRequest<T extends any[], R extends any> = (
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
	private proxiedFetch: ProxiedFetchFn = (xrpcRoute) => {
		const host = import.meta.env.DEV ? `http://localhost:8000` : this.pds;

		return fetch(`${host}${xrpcRoute}`, {
			headers: new Headers({
				"atproto-proxy": this.proxyHeader,
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
			},
		},
	};
}
