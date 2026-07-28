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
import { deviceContext, getConnection } from "../utils/device-context";
import { isAllowedDid } from "./allowlist";
import { buildScopes, getMissingScopeSets } from "./scopes";
import {
	probeIndicatesStall,
	probeStorage,
	type StorageProbe,
	summarizeProbe,
} from "./storage-probe";

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
const OAUTH_PRE_NETWORK_TIMEOUT_MS = 15_000;
const OAUTH_FALLBACK_DELAY_MS = 1_000;
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
let storageProbe: StorageProbe | undefined;
let requestsStarted = 0;
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
		requestsStarted += 1;
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

let signInHandleDomain: string | undefined;

export const noteSignInHandle = (handle: string) => {
	signInHandleDomain = handleDomain(handle) || undefined;
};

const reportedHandleDomain = (input: string): string =>
	signInHandleDomain ?? handleDomain(input);

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
	handleDomain: reportedHandleDomain(input),
	unreachableHost: unreachableHost ?? null,
	storageBackend: usingFallbackStorage ? "localstorage" : "indexeddb",
	requestsStarted,
	requests: requestTrail.map(
		(entry) =>
			`${entry.host} #${entry.attempt} ${entry.error ?? entry.status} ${entry.ms}ms`,
	),
});

export const beginSignInAttempt = () => {
	attemptStartedAt = Date.now();
	unreachableHost = undefined;
	clockSkewMs = undefined;
	storageProbe = undefined;
	signInHandleDomain = undefined;
	requestsStarted = 0;
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
	scope.setTag("oauth.handle_domain", reportedHandleDomain(input) || "unknown");
	scope.setTag("oauth.platform", device.platform ?? "web");
	scope.setTag("oauth.os_version", device.osVersion ?? "unknown");
	scope.setTag("oauth.time_zone", device.timeZone);
	scope.setTag("oauth.effective_type", String(network.effectiveType));
	scope.setTag("idb.scratch", storageProbe?.scratch.status ?? "not-run");
	scope.setTag("idb.oauth_db", storageProbe?.oauthDb.status ?? "not-run");
	scope.setTag(
		"oauth.storage_backend",
		usingFallbackStorage ? "localstorage" : "indexeddb",
	);
	scope.setContext("oauth", signInContext(input));
	scope.setContext("device", device);
	scope.setContext("network", network);
	scope.setContext("storage", {
		scratchStatus: storageProbe?.scratch.status ?? "not-run",
		scratchMs: storageProbe?.scratch.ms,
		scratchDetail: storageProbe?.scratch.detail,
		oauthDbStatus: storageProbe?.oauthDb.status ?? "not-run",
		oauthDbMs: storageProbe?.oauthDb.ms,
		oauthDbDetail: storageProbe?.oauthDb.detail,
	});
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
	const worthReporting =
		requestTrail.some((entry) => entry.error) ||
		probeIndicatesStall(storageProbe) ||
		usingFallbackStorage;
	if (!worthReporting) return;
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
	if (probeIndicatesStall(storageProbe) || isStorageFailure(err)) {
		return new Error(
			"Sign-in couldn't start because this device's local storage stopped responding. Restarting the app usually clears it.",
		);
	}
	return err instanceof Error ? err : new Error(String(err));
};

let oAuthClient: undefined | BrowserOAuthClient;
let agent: undefined | Agent;
let pdsHost: undefined | string;
let grantedScopes: undefined | string;
let usingFallbackStorage = false;

const FALLBACK_FLAG_KEY = "colibri:oauth-storage-fallback";

const PRIMARY_DATABASE = {
	durability: "relaxed",
	cleanupInterval: 300_000,
} as const;

const FALLBACK_DATABASE = {
	backend: "localstorage",
	name: "@atproto-oauth-client-fallback",
	cleanupInterval: 300_000,
} as const;

const fallbackStorageRequested = (): boolean => {
	try {
		return localStorage.getItem(FALLBACK_FLAG_KEY) === "1";
	} catch {
		return false;
	}
};

const markFallbackStorage = () => {
	try {
		localStorage.setItem(FALLBACK_FLAG_KEY, "1");
	} catch {}
};

export const isStorageFailure = (err: unknown): boolean =>
	err instanceof Error &&
	(err.name === "DBUnavailableError" ||
		err.name === "StorageStallError" ||
		err.message.includes("IndexedDB unavailable"));

class StorageStallError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "StorageStallError";
	}
}

const loadOAuthClient = (
	databaseOptions: typeof PRIMARY_DATABASE | typeof FALLBACK_DATABASE,
) =>
	BrowserOAuthClient.load({
		clientId,
		// Resolve handles via the configured AppView (defaults to
		// api.colibri.social) rather than a hard-coded origin, so self-hosted
		// installs stay self-contained and don't depend on colibri.social.
		handleResolver: getAppViewHost("http"),
		fetch: preflightFetch,
		databaseOptions,
	});

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

const resetSession = () => {
	localStorage.removeItem("sub");
	agent = undefined;
	pdsHost = undefined;
	grantedScopes = undefined;
};

const init = async () => {
	if (oAuthClient) return;

	usingFallbackStorage = fallbackStorageRequested();

	try {
		oAuthClient = await loadOAuthClient(
			usingFallbackStorage ? FALLBACK_DATABASE : PRIMARY_DATABASE,
		);
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
		await restoreExistingSession();
	} catch (e) {
		if (isStorageFailure(e) && !usingFallbackStorage) {
			console.warn(
				"[auth] IndexedDB is unusable, retrying with localStorage-backed OAuth storage",
				e,
			);
			Sentry.addBreadcrumb({
				category: "oauth.storage",
				level: "warning",
				message: "restore fell back to localStorage storage",
			});
			markFallbackStorage();
			usingFallbackStorage = true;
			resetSession();
			try {
				oAuthClient = await loadOAuthClient(FALLBACK_DATABASE);
				await restoreExistingSession();
			} catch (fallbackError) {
				console.error(fallbackError);
				resetSession();
			}
		} else {
			console.error(e);
			resetSession();
		}
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

const restoreExistingSession = async () => {
	const client = oAuthClient;
	if (!client) return;

	{
		if (window.location.hash.length > 0) {
			console.info(
				"[auth] Attempting to received session from callback parameters...",
			);
			const searchParams = new URLSearchParams(
				window.location.hash.replace("#", "?"),
			);

			const callbackSession = await client.callback(searchParams);

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

		let result = await client.init();

		// We recover the sub from local storage to restore the session
		if (!result) {
			const preSetSub = localStorage.getItem("sub");

			if (preSetSub) {
				const restored = await client.restore(preSetSub);
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

const withPreNetworkWatchdog = <T>(work: Promise<T>): Promise<T> => {
	const baseline = requestsStarted;

	return new Promise<T>((resolve, reject) => {
		const timer = setTimeout(() => {
			if (requestsStarted === baseline) {
				reject(
					new StorageStallError(
						"Sign-in made no network request before timing out",
					),
				);
			}
		}, OAUTH_PRE_NETWORK_TIMEOUT_MS);

		work.then(
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
};

const attemptSignIn = (
	client: BrowserOAuthClient,
	input: string,
	options: SignInOptions,
): Promise<void> =>
	withPreNetworkWatchdog(
		runSignIn(
			client,
			input,
			options,
			AbortSignal.timeout(OAUTH_SIGNIN_TIMEOUT_MS),
		),
	);

export const startOAuthSignIn = async (
	client: BrowserOAuthClient,
	input: string,
	options: SignInOptions,
): Promise<void> => {
	if (attemptStartedAt === undefined) beginSignInAttempt();

	storageProbe = await probeStorage();
	const probeSummary = summarizeProbe(storageProbe);
	console.info(`[auth] storage probe: ${probeSummary}`);
	Sentry.addBreadcrumb({
		category: "oauth.storage",
		level: probeIndicatesStall(storageProbe) ? "warning" : "info",
		message: probeSummary,
	});

	try {
		await attemptSignIn(client, input, options);
	} catch (err) {
		const storageAtFault =
			isStorageFailure(err) || probeIndicatesStall(storageProbe);

		if (!storageAtFault || usingFallbackStorage) {
			await reportSignInFailure(err, input, "authorize");
			throw asSignInError(err);
		}

		console.warn(
			"[auth] sign-in stalled in local storage, retrying with localStorage-backed OAuth storage",
			err,
		);
		Sentry.addBreadcrumb({
			category: "oauth.storage",
			level: "warning",
			message: "sign-in fell back to localStorage storage",
		});

		await wait(OAUTH_FALLBACK_DELAY_MS);

		try {
			markFallbackStorage();
			usingFallbackStorage = true;
			oAuthClient = await loadOAuthClient(FALLBACK_DATABASE);
			await attemptSignIn(oAuthClient, input, options);
		} catch (fallbackError) {
			await reportSignInFailure(fallbackError, input, "authorize-fallback");
			throw asSignInError(fallbackError);
		}

		await reportSignInRecovered(input);
		return;
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
	const active = oAuthClient ?? client;
	const url = new URL(callbackUrl);
	const raw = url.search ? url.search.slice(1) : url.hash.slice(1);
	const params = new URLSearchParams(raw);

	if (!params.has("state") || !(params.has("code") || params.has("error"))) {
		return false;
	}

	const { session } = await active.callback(params);
	if (!isAllowedDid(session.sub)) {
		try {
			await active.revoke(session.sub);
		} catch {}
		localStorage.removeItem("sub");
		return false;
	}
	localStorage.setItem("sub", session.sub);
	return true;
};

export { clientId, getClient, pdsHost };
