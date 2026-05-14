import { Agent } from "@atproto/api";
import { BrowserOAuthClient, DidDocument } from "@atproto/oauth-client-browser";
import { scopes } from "./scopes";

const makeClientId = () => {
	const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);

	if (isLocal) {
		// see https://atproto.com/specs/oauth#localhost-client-development
		return `http://localhost?${new URLSearchParams({
			scope: scopes.join(" "),
			redirect_uri: `http://127.0.0.1:${window.location.port}/login`,
		})}`;
	}

	return `https://${window.location.host}/oauth-client-metadata.json`;
};

const clientId = makeClientId();

let oAuthClient: undefined | BrowserOAuthClient;
let agent: undefined | Agent;
let pdsHost: undefined | string;

export type Client =
	| {
			loggedIn: true;
			agent: Agent;
			client: BrowserOAuthClient;
			pdsHost: string;
	  }
	| { loggedIn: false; client: BrowserOAuthClient }
	| undefined;

type ClientGetter = () => Promise<Client>;

type Services = Array<{
	id: string;
	type: string;
	serviceEndpoint: string;
}>;

const getClient: ClientGetter = () => {
	return new Promise((res) => {
		init().then(() => {
			if (oAuthClient && agent && pdsHost) {
				res({
					loggedIn: true,
					client: oAuthClient,
					agent,
					pdsHost,
				});
			} else if (oAuthClient && !agent) {
				res({
					loggedIn: false,
					client: oAuthClient,
				});
			} else {
				res(undefined);
			}
		});
	});
};

const init = async () => {
	if (oAuthClient) return;

	try {
		oAuthClient = await BrowserOAuthClient.load({
			clientId,
			handleResolver: "https://colibri.social", // NOTE: This could maybe be made configurable?
		});

		if (window.location.hash.length > 0) {
			console.info(
				"Attempting to received session from callback parameters...",
			);
			const searchParams = new URLSearchParams(
				window.location.hash.replace("#", "?"),
			);

			const callbackSession = await oAuthClient.callback(searchParams);

			if (callbackSession && !window.location.href.startsWith("/app")) {
				console.info("Session received from callback parameters.");
				localStorage.setItem("sub", callbackSession.session.sub);
				window.location.href = "/app";
				return;
			}
		}

		let result = await oAuthClient.init();

		// We recover the sub from local storage to restore the session
		if (!result) {
			const preSetSub = localStorage.getItem("sub");

			if (preSetSub) {
				const restored = await oAuthClient.restore(preSetSub);
				result = { session: restored, state: null };
			} else {
				console.info("No session found.");
				return;
			}
		}

		const { session, state } = result;

		if (state != null) {
			console.info(
				`${session.sub} was successfully authenticated (state: ${state})`,
			);
		} else {
			console.info(`${session.sub} was restored (last active session)`);
		}

		agent = new Agent(session);

		const didDoc = (await (
			await fetch(
				`https://api.colibri.social/xrpc/com.atproto.identity.resolveDid?did=${agent.did!}`,
			)
		).json()) as DidDocument;

		if (!didDoc.service) {
			throw new Error(
				`DID document for ${agent.did!} did not include any services.`,
			);
		}

		pdsHost = didDoc.service
			.find((x) => x.id === "#atproto_pds")
			?.serviceEndpoint.toString();

		return;
	} catch (e) {
		console.error(e);
		// Show login
	}
};

export { clientId, pdsHost, getClient };
