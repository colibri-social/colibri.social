import { Agent } from "@atproto/api";
import {
	BrowserOAuthClient,
	type DidDocument,
} from "@atproto/oauth-client-browser";
import { toast } from "somoto";
import { isTauriRuntime } from "../notifications/environment";
import {
	DEFAULT_APPVIEW_URL,
	getAppViewDid,
	getAppViewHost,
	getPreferredAppViewUrl,
} from "../utils/appview";
import { buildScopes, getMissingScopeSets } from "./scopes";

export const isLocal = () =>
	["localhost", "127.0.0.1"].includes(window.location.hostname);

// Public origin that serves our OAuth client metadata for the native app. The
// native webview origin (tauri://localhost) isn't publicly fetchable, so the
// native `client_id` must point at a fixed public host
const NATIVE_CLIENT_ORIGIN =
	(typeof window !== "undefined" &&
		(window as { __COLIBRI_WEB_ORIGIN__?: string }).__COLIBRI_WEB_ORIGIN__) ||
	"https://colibri.social";

const makeClientId = () => {
	// The conventional document pins the default AppView, a per-AppView document
	// pins any other AppView's `did:web`. Keeping  the default on the conventional path
	// leaves existing sessions valid
	const appViewHost = new URL(getPreferredAppViewUrl()).host;
	const isDefaultAppView = appViewHost === new URL(DEFAULT_APPVIEW_URL).host;

	// Native app (Tauri): the metadata is served from the fixed public origin and
	// declares the custom-scheme redirect the deep-link plugin routes back in.
	if (isTauriRuntime()) {
		return isDefaultAppView
			? `${NATIVE_CLIENT_ORIGIN}/oauth-client-metadata-native.json`
			: `${NATIVE_CLIENT_ORIGIN}/c/${appViewHost}/oauth-client-metadata-native.json`;
	}

	if (isLocal()) {
		// see https://atproto.com/specs/oauth#localhost-client-development
		return `http://localhost?${new URLSearchParams({
			scope: buildScopes(getAppViewDid()).join(" "),
			redirect_uri: `http://127.0.0.1:${window.location.port}/app/login`,
		})}`;
	}

	return isDefaultAppView
		? `https://${window.location.host}/oauth-client-metadata.json`
		: `https://${window.location.host}/c/${appViewHost}/oauth-client-metadata.json`;
};

const clientId = makeClientId();

let oAuthClient: undefined | BrowserOAuthClient;
let agent: undefined | Agent;
let pdsHost: undefined | string;
let grantedScopes: undefined | string;

export type Client =
	| {
			loggedIn: true;
			agent: Agent;
			client: BrowserOAuthClient;
			pdsHost: string;
			grantedScopes: string | undefined;
	  }
	| { loggedIn: false; client: BrowserOAuthClient }
	| undefined;

type ClientGetter = () => Promise<Client>;

const getClient: ClientGetter = () => {
	return new Promise((res) => {
		init().then(() => {
			if (oAuthClient && agent && pdsHost) {
				res({
					loggedIn: true,
					client: oAuthClient,
					agent,
					pdsHost,
					grantedScopes,
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
			// Resolve handles via the configured AppView (defaults to
			// api.colibri.social) rather than a hard-coded origin, so self-hosted
			// installs stay self-contained and don't depend on colibri.social.
			handleResolver: getAppViewHost("http"),
		});

		if (window.location.hash.length > 0) {
			console.info(
				"[auth] Attempting to received session from callback parameters...",
			);
			const searchParams = new URLSearchParams(
				window.location.hash.replace("#", "?"),
			);

			const callbackSession = await oAuthClient.callback(searchParams);

			if (callbackSession && !window.location.href.startsWith("/app")) {
				console.info("[auth] Session received from callback parameters.");
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
				console.info("[auth] No session found.");
				return;
			}
		}

		const { session, state } = result;

		if (state != null) {
			console.info(
				`[auth] ${session.sub} was successfully authenticated (state: ${state})`,
			);
		} else {
			console.info(`[auth] ${session.sub} was restored (last active session)`);
		}

		agent = new Agent(session);

		try {
			grantedScopes = (await session.getTokenInfo(false)).scope;
		} catch {}

		if (
			state == null &&
			navigator.onLine &&
			grantedScopes !== undefined &&
			getMissingScopeSets(grantedScopes).length === 0
		) {
			try {
				grantedScopes = (await session.getTokenInfo(true)).scope;
			} catch (e) {
				console.warn("[auth] Forced token refresh failed", e);
			}
		}

		const didDoc = (await (
			await fetch(
				`${getAppViewHost("http")}/xrpc/com.atproto.identity.resolveDid?did=${agent.did!}`,
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

type SignInOptions = NonNullable<Parameters<BrowserOAuthClient["signIn"]>[1]>;

/**
 * Begin an OAuth sign-in. On the web this navigates the current tab to the
 * authorization server (the SPA redirect flow). In the native app it instead
 * opens the authorization URL in the system browser and returns immediately.
 */
export const startOAuthSignIn = async (
	client: BrowserOAuthClient,
	input: string,
	options: SignInOptions,
): Promise<void> => {
	if (isTauriRuntime()) {
		// `authorize` returns the URL without navigating and defaults to the
		// metadata's first redirect_uri (our custom scheme)
		const url = await client.authorize(input, options);
		const { openUrl } = await import("@tauri-apps/plugin-opener");
		await openUrl(url.toString());
		toast("Continue in your browser to finish signing in.");
		return;
	}

	await client.signIn(input, {
		...options,
		signal: new AbortController().signal,
	});
};

/**
 * Finish a native OAuth sign-in from a `social.colibri:/oauth/callback?...` deep
 * link
 */
export const completeNativeOAuth = async (
	client: BrowserOAuthClient,
	callbackUrl: string,
): Promise<boolean> => {
	const url = new URL(callbackUrl);
	const raw = url.search ? url.search.slice(1) : url.hash.slice(1);
	const params = new URLSearchParams(raw);

	if (!params.has("state") || !(params.has("code") || params.has("error"))) {
		return false;
	}

	const { session } = await client.callback(params);
	localStorage.setItem("sub", session.sub);
	return true;
};

export { clientId, getClient, pdsHost };
