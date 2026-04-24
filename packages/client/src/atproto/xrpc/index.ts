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

	constructor(pds: string, proxyHeader: string) {
		this.pds = pds;
		this.proxyHeader = proxyHeader;
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

	public social = {
		colibri: {
			actor: {
				getData: (identifier: string) => getData(this.proxiedFetch, identifier),
				listCommunities: () => listCommunities(this.proxiedFetch),
			},
		},
	};
}
