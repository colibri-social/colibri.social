import { Agent } from "@atproto/api";
import {
	BrowserOAuthClient,
	type DidDocument,
} from "@atproto/oauth-client-browser";
import * as Sentry from "@sentry/solid";
import { toast } from "somoto";
import { isTauriRuntime } from "../notifications/environment";
import {
	DEFAULT_APPVIEW_URL,
	getAppViewDid,
	getAppViewHost,
	getPreferredAppViewUrl,
} from "../utils/appview";
import { isAllowedDid } from "./allowlist";
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

const OAUTH_FETCH_TIMEOUT_MS = 12_000;
const OAUTH_FETCH_ATTEMPTS = 2;
const OAUTH_RETRY_BASE_DELAY_MS = 750;
const OAUTH_SIGNIN_TIMEOUT_MS = 75_000;
const MAX_TRAIL_ENTRIES = 24;

type RequestAttempt = {
	host: string;
	attempt: number;
	ms: number;
	status?: number;
	error?: string;
};

let unreachableHost: string | undefined;
let attemptStartedAt: number | undefined;
let clockSkewMs: number | undefined;
let requestTrail: Array<RequestAttempt> = [];

const requestHost = (input: Parameters<typeof fetch>[0]): string => {
	try {
		const url =
			typeof input === "string"
				? input
				: input instanceof URL
					? input.href
					: input.url;
		return new URL(url, window.location.href).host;
	} catch {
		return "";
	}
};

const errorLabel = (err: unknown): string => {
	if (err instanceof DOMException) return err.name;
	if (err instanceof Error)
		return err.name === "Error" ? err.message : err.name;
	return String(err);
};

const isConnectivityError = (err: unknown): boolean =>
	err instanceof TypeError ||
	(err instanceof DOMException && err.name === "TimeoutError");

const isRepeatable = (
	input: Parameters<typeof fetch>[0],
	init?: RequestInit,
): boolean =>
	(typeof input === "string" || input instanceof URL) &&
	!(init?.body instanceof ReadableStream);

const wait = (ms: number) =>
	new Promise<void>((resolve) => setTimeout(resolve, ms));

const trackClockSkew = (response: Response, receivedAt: number) => {
	const header = response.headers.get("date");
	if (!header) return;
	const serverTime = Date.parse(header);
	if (Number.isNaN(serverTime)) return;
	clockSkewMs = receivedAt - serverTime;
};

const recordAttempt = (entry: RequestAttempt) => {
	requestTrail.push(entry);
	if (requestTrail.length > MAX_TRAIL_ENTRIES) requestTrail.shift();
	Sentry.addBreadcrumb({
		category: "oauth.fetch",
		level: entry.error ? "warning" : "info",
		message: `${entry.host} #${entry.attempt} ${entry.error ?? entry.status} ${entry.ms}ms`,
	});
};

const withFetchTimeout =
	(ms: number): typeof fetch =>
	async (input, init) => {
		const host = requestHost(input);
		const repeatable = isRepeatable(input, init);
		let lastError: unknown;

		for (let attempt = 1; attempt <= OAUTH_FETCH_ATTEMPTS; attempt++) {
			const startedAt = Date.now();
			const controller = new AbortController();
			let timedOut = false;
			const timer = setTimeout(() => {
				timedOut = true;
				controller.abort(new DOMException("Sign-in timed out", "TimeoutError"));
			}, ms);

			const externalSignal = init?.signal;
			const forwardAbort = () => controller.abort(externalSignal?.reason);
			if (externalSignal) {
				if (externalSignal.aborted) {
					controller.abort(externalSignal.reason);
				} else {
					externalSignal.addEventListener("abort", forwardAbort, {
						once: true,
					});
				}
			}

			try {
				const response = await fetch(input, {
					...init,
					signal: controller.signal,
				});
				const receivedAt = Date.now();
				trackClockSkew(response, receivedAt);
				recordAttempt({
					host,
					attempt,
					ms: receivedAt - startedAt,
					status: response.status,
				});
				return response;
			} catch (err) {
				lastError = timedOut
					? new DOMException("Sign-in timed out", "TimeoutError")
					: err;
				recordAttempt({
					host,
					attempt,
					ms: Date.now() - startedAt,
					error: errorLabel(lastError),
				});

				const givingUp =
					externalSignal?.aborted === true ||
					!repeatable ||
					!isConnectivityError(lastError) ||
					attempt === OAUTH_FETCH_ATTEMPTS;

				if (givingUp) {
					if (isConnectivityError(lastError)) {
						unreachableHost = host || unreachableHost;
					}
					throw lastError;
				}
			} finally {
				clearTimeout(timer);
				externalSignal?.removeEventListener("abort", forwardAbort);
			}

			await wait(OAUTH_RETRY_BASE_DELAY_MS * attempt);
		}

		throw lastError;
	};

export const preflightFetch = withFetchTimeout(OAUTH_FETCH_TIMEOUT_MS);

const handleDomain = (input: string): string => {
	const trimmed = input.trim().replace(/^@/, "");
	const dot = trimmed.indexOf(".");
	return dot === -1 ? "" : trimmed.slice(dot + 1);
};

type NetworkInformation = {
	effectiveType?: string;
	downlink?: number;
	rtt?: number;
	saveData?: boolean;
	type?: string;
};

const getConnection = (): NetworkInformation | undefined => {
	if (typeof navigator === "undefined") return undefined;
	const nav = navigator as Navigator & {
		connection?: NetworkInformation;
		mozConnection?: NetworkInformation;
		webkitConnection?: NetworkInformation;
	};
	return nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
};

const timeZone = (): string => {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone;
	} catch {
		return "unknown";
	}
};

const nativeOsInfo = async () => {
	if (!isTauriRuntime()) return {};
	try {
		const os = await import("@tauri-apps/plugin-os");
		return {
			platform: os.platform(),
			osVersion: os.version(),
			osType: os.type(),
			arch: os.arch(),
		};
	} catch {
		return {};
	}
};

const deviceContext = async () => {
	const nav =
		typeof navigator === "undefined"
			? undefined
			: (navigator as Navigator & {
					deviceMemory?: number;
					standalone?: boolean;
				});

	return {
		...(await nativeOsInfo()),
		native: isTauriRuntime(),
		userAgent: nav?.userAgent,
		language: nav?.language,
		languages: nav?.languages?.join(","),
		timeZone: timeZone(),
		utcOffsetMinutes: new Date().getTimezoneOffset(),
		hardwareConcurrency: nav?.hardwareConcurrency,
		deviceMemory: nav?.deviceMemory,
		maxTouchPoints: nav?.maxTouchPoints,
		screen:
			typeof screen === "undefined"
				? undefined
				: `${screen.width}x${screen.height}`,
		viewport:
			typeof window === "undefined"
				? undefined
				: `${window.innerWidth}x${window.innerHeight}`,
		pixelRatio: typeof window === "undefined" ? undefined : devicePixelRatio,
		standalone: nav?.standalone,
	};
};

const networkContext = () => {
	const connection = getConnection();
	const failures = requestTrail.filter((entry) => entry.error);
	const slowest = requestTrail.reduce(
		(worst, entry) => (worst && worst.ms >= entry.ms ? worst : entry),
		undefined as RequestAttempt | undefined,
	);

	return {
		online: typeof navigator === "undefined" ? undefined : navigator.onLine,
		effectiveType: connection?.effectiveType ?? "unavailable",
		downlinkMbps: connection?.downlink,
		roundTripMs: connection?.rtt,
		saveData: connection?.saveData,
		connectionType: connection?.type,
		clockSkewMs: clockSkewMs ?? null,
		requestCount: requestTrail.length,
		failureCount: failures.length,
		slowestRequest: slowest
			? `${slowest.host} ${slowest.ms}ms`
			: "none recorded",
		hostsContacted: [...new Set(requestTrail.map((entry) => entry.host))].join(
			", ",
		),
	};
};

const signInContext = (input: string) => ({
	elapsedMs: Date.now() - (attemptStartedAt ?? Date.now()),
	clientId,
	appView: getPreferredAppViewUrl(),
	native: isTauriRuntime(),
	online: typeof navigator === "undefined" ? undefined : navigator.onLine,
	handleDomain: handleDomain(input),
	unreachableHost: unreachableHost ?? null,
	requests: requestTrail.map(
		(entry) =>
			`${entry.host} #${entry.attempt} ${entry.error ?? entry.status} ${entry.ms}ms`,
	),
});

export const beginSignInAttempt = () => {
	attemptStartedAt = Date.now();
	unreachableHost = undefined;
	clockSkewMs = undefined;
	requestTrail = [];
};

export const endSignInAttempt = () => {
	attemptStartedAt = undefined;
};

const applySignInScope = (
	scope: {
		setTag: (key: string, value: string) => unknown;
		setContext: (key: string, context: Record<string, unknown>) => unknown;
	},
	input: string,
	stage: string,
	device: Awaited<ReturnType<typeof deviceContext>>,
	network: ReturnType<typeof networkContext>,
) => {
	scope.setTag("oauth.stage", stage);
	scope.setTag("oauth.unreachable_host", unreachableHost ?? "none");
	scope.setTag("oauth.handle_domain", handleDomain(input) || "unknown");
	scope.setTag("oauth.platform", device.platform ?? "web");
	scope.setTag("oauth.os_version", device.osVersion ?? "unknown");
	scope.setTag("oauth.time_zone", device.timeZone);
	scope.setTag("oauth.effective_type", String(network.effectiveType));
	scope.setContext("oauth", signInContext(input));
	scope.setContext("device", device);
	scope.setContext("network", network);
};

export const reportSignInFailure = async (
	err: unknown,
	input: string,
	stage: string,
) => {
	const device = await deviceContext();
	const network = networkContext();
	Sentry.withScope((scope) => {
		applySignInScope(scope, input, stage, device, network);
		Sentry.captureException(
			err instanceof Error ? err : new Error(String(err)),
		);
	});
};

const reportSignInRecovered = async (input: string) => {
	if (!requestTrail.some((entry) => entry.error)) return;
	const device = await deviceContext();
	const network = networkContext();
	Sentry.withScope((scope) => {
		applySignInScope(scope, input, "recovered", device, network);
		Sentry.captureMessage("Sign-in succeeded after retrying", "info");
	});
};

export const asSignInError = (err: unknown): Error => {
	if (unreachableHost) {
		return new Error(
			`Couldn't reach ${unreachableHost}. Check your connection and try again.`,
		);
	}
	return err instanceof Error ? err : new Error(String(err));
};

let oAuthClient: undefined | BrowserOAuthClient;
let agent: undefined | Agent;
let pdsHost: undefined | string;
let grantedScopes: undefined | string;

const clearDisallowedSession = async (sub: string) => {
	try {
		await oAuthClient?.revoke(sub);
	} catch {}
	localStorage.removeItem("sub");
	agent = undefined;
	pdsHost = undefined;
	grantedScopes = undefined;
};

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
			fetch: preflightFetch,
		});
	} catch (e) {
		console.error(e);
		return;
	}

	if (
		typeof window !== "undefined" &&
		window.location.pathname === "/app/waitlist"
	) {
		return;
	}

	try {
		if (window.location.hash.length > 0) {
			console.info(
				"[auth] Attempting to received session from callback parameters...",
			);
			const searchParams = new URLSearchParams(
				window.location.hash.replace("#", "?"),
			);

			const callbackSession = await oAuthClient.callback(searchParams);

			if (callbackSession && !window.location.href.startsWith("/app")) {
				if (!isAllowedDid(callbackSession.session.sub)) {
					console.info(
						`[auth] ${callbackSession.session.sub} is not in the early-access allowlist.`,
					);
					await clearDisallowedSession(callbackSession.session.sub);
					return;
				}
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

		if (!isAllowedDid(session.sub)) {
			console.info(
				`[auth] ${session.sub} is not in the early-access allowlist.`,
			);
			await clearDisallowedSession(session.sub);
			return;
		}

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
	} catch (e) {
		console.error(e);
		localStorage.removeItem("sub");
		agent = undefined;
		pdsHost = undefined;
		grantedScopes = undefined;
		return;
	}

	if (!agent) return;

	try {
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
	} catch (e) {
		console.error(e);
	}
};

type SignInOptions = NonNullable<Parameters<BrowserOAuthClient["signIn"]>[1]>;

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
	new Promise((resolve, reject) => {
		const timer = setTimeout(
			() => reject(new DOMException("Sign-in timed out", "TimeoutError")),
			ms,
		);
		promise.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			(err) => {
				clearTimeout(timer);
				reject(err);
			},
		);
	});

/**
 * Begin an OAuth sign-in. On the web this navigates the current tab to the
 * authorization server (the SPA redirect flow). In the native app it instead
 * opens the authorization URL in the system browser and returns immediately.
 */
const runSignIn = async (
	client: BrowserOAuthClient,
	input: string,
	options: SignInOptions,
	signal: AbortSignal,
): Promise<void> => {
	if (isTauriRuntime()) {
		// `authorize` returns the URL without navigating and defaults to the
		// metadata's first redirect_uri (our custom scheme)
		const url = await withTimeout(
			client.authorize(input, { ...options, signal }),
			OAUTH_SIGNIN_TIMEOUT_MS,
		);
		const { platform } = await import("@tauri-apps/plugin-os");
		if (platform() === "macos") {
			const redirectUri = client.clientMetadata.redirect_uris[0];
			const { invoke } = await import("@tauri-apps/api/core");
			let callbackUrl: string;
			try {
				callbackUrl = await invoke<string>("start_web_auth", {
					url: url.toString(),
					scheme: new URL(redirectUri).protocol.replace(":", ""),
				});
			} catch (err) {
				if (err === "canceled") return;
				throw err instanceof Error ? err : new Error(String(err));
			}
			if (await completeNativeOAuth(client, callbackUrl)) {
				window.location.href = "/app";
			}
			return;
		}
		const { openUrl } = await import("@tauri-apps/plugin-opener");
		await openUrl(url.toString());
		toast("Continue in your browser to finish signing in.");
		return;
	}

	await withTimeout(
		client.signIn(input, { ...options, signal }),
		OAUTH_SIGNIN_TIMEOUT_MS,
	);
};

export const startOAuthSignIn = async (
	client: BrowserOAuthClient,
	input: string,
	options: SignInOptions,
): Promise<void> => {
	if (attemptStartedAt === undefined) beginSignInAttempt();
	const signal = AbortSignal.timeout(OAUTH_SIGNIN_TIMEOUT_MS);

	try {
		await runSignIn(client, input, options, signal);
	} catch (err) {
		await reportSignInFailure(err, input, "authorize");
		throw asSignInError(err);
	}

	await reportSignInRecovered(input);
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
	if (!isAllowedDid(session.sub)) {
		try {
			await client.revoke(session.sub);
		} catch {}
		localStorage.removeItem("sub");
		return false;
	}
	localStorage.setItem("sub", session.sub);
	return true;
};

export { clientId, getClient, pdsHost };
