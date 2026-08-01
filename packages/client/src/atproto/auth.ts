import { Agent } from "@atproto/api";
import {
	BrowserOAuthClient,
	type DidDocument,
} from "@atproto/oauth-client-browser";
import * as Sentry from "@sentry/solid";
import { type Accessor, createSignal } from "solid-js";
import { toast } from "somoto";
import { classifyThrown } from "../errors/classify";
import { ColibriError, isColibriError } from "../errors/error";
import { classifyNativeError, wasCancelled } from "../errors/native";
import { classifyOAuthError, classifyOAuthParams } from "../errors/oauth";
import { reportError } from "../errors/report";
import { isTauriRuntime } from "../notifications/environment";
import {
	DEFAULT_APPVIEW_URL,
	getAppViewDid,
	getAppViewHost,
	getPreferredAppViewUrl,
} from "../utils/appview";
import { deviceContext, getConnection } from "../utils/device-context";
import { createLogger } from "../utils/logger";
import { markBoot } from "../utils/perf";
import { isAllowedDid } from "./allowlist";
import { buildScopes, getMissingScopeSets } from "./scopes";
import {
	probeIndicatesStall,
	probeStorage,
	type StorageProbe,
	summarizeProbe,
} from "./storage-probe";

const log = createLogger("auth");

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

const signInTags = (
	input: string,
	stage: string,
	device: Awaited<ReturnType<typeof deviceContext>>,
	network: ReturnType<typeof networkContext>,
): Record<string, string> => ({
	"oauth.stage": stage,
	"oauth.unreachable_host": unreachableHost ?? "none",
	"oauth.handle_domain": reportedHandleDomain(input) || "unknown",
	"oauth.platform": device.platform ?? "web",
	"oauth.os_version": device.osVersion ?? "unknown",
	"oauth.time_zone": device.timeZone,
	"oauth.effective_type": String(network.effectiveType),
	"idb.scratch": storageProbe?.scratch.status ?? "not-run",
	"idb.oauth_db": storageProbe?.oauthDb.status ?? "not-run",
	"oauth.storage_backend": usingFallbackStorage ? "localstorage" : "indexeddb",
});

const storageContext = () => ({
	scratchStatus: storageProbe?.scratch.status ?? "not-run",
	scratchMs: storageProbe?.scratch.ms,
	scratchDetail: storageProbe?.scratch.detail,
	oauthDbStatus: storageProbe?.oauthDb.status ?? "not-run",
	oauthDbMs: storageProbe?.oauthDb.ms,
	oauthDbDetail: storageProbe?.oauthDb.detail,
});

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
	for (const [key, value] of Object.entries(
		signInTags(input, stage, device, network),
	)) {
		scope.setTag(key, value);
	}
	scope.setContext("oauth", signInContext(input));
	scope.setContext("device", device);
	scope.setContext("network", network);
	scope.setContext("storage", storageContext());
};

export const reportSignInFailure = async (
	err: unknown,
	input: string,
	stage: string,
): Promise<ColibriError> => {
	const device = await deviceContext();
	const network = networkContext();

	return reportError(asSignInError(err), {
		stage: `oauth.${stage}`,
		tags: signInTags(input, stage, device, network),
		contexts: {
			oauth: signInContext(input),
			device,
			network,
			storage: storageContext(),
		},
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

export const asSignInError = (err: unknown): ColibriError => {
	if (isColibriError(err)) return err;

	const fromProvider = classifyOAuthError(err);
	if (fromProvider) return fromProvider;

	const stalled = () =>
		new ColibriError({
			code: "StorageStalled",
			cause: err,
			context: { stage: "sign-in" },
		});

	if (isStorageFailure(err)) return stalled();
	if (unreachableHost) {
		return new ColibriError({
			code: "Unreachable",
			cause: err,
			context: { host: unreachableHost },
		});
	}
	if (probeIndicatesStall(storageProbe)) return stalled();

	return classifyThrown(err);
};

let oAuthClient: undefined | BrowserOAuthClient;
let agent: undefined | Agent;
let pdsHost: undefined | string;
const [grantedScopes, setGrantedScopes] = createSignal<string | undefined>(
	undefined,
);
let usingFallbackStorage = false;

export { grantedScopes };

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
	setGrantedScopes(undefined);
};

export type Client =
	| {
			loggedIn: true;
			agent: Agent;
			client: BrowserOAuthClient;
			pdsHost: string | undefined;
			grantedScopes: Accessor<string | undefined>;
	  }
	| { loggedIn: false; client: BrowserOAuthClient }
	| undefined;

type ClientGetter = () => Promise<Client>;

const getClient: ClientGetter = () => {
	return new Promise((res) => {
		init().then(() => {
			if (oAuthClient && agent) {
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

type RestoredSession = Awaited<ReturnType<BrowserOAuthClient["restore"]>>;

const revalidateGrantedScopes = async (
	session: RestoredSession,
): Promise<void> => {
	try {
		setGrantedScopes((await session.getTokenInfo(true)).scope);
		markBoot("auth:scopesRevalidated");
	} catch (e) {
		const failure = classifyThrown(e, { method: "oauth.getTokenInfo" });
		log.warn("forced token refresh failed", { code: failure.code });
	}
};

const resetSession = () => {
	localStorage.removeItem("sub");
	agent = undefined;
	pdsHost = undefined;
	setGrantedScopes(undefined);
};

const init = async () => {
	if (oAuthClient) return;

	usingFallbackStorage = fallbackStorageRequested();

	try {
		oAuthClient = await loadOAuthClient(
			usingFallbackStorage ? FALLBACK_DATABASE : PRIMARY_DATABASE,
		);
	} catch (e) {
		log.error("loading the OAuth client failed", { error: e });
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
			log.warn(
				"IndexedDB is unusable, retrying with localStorage-backed OAuth storage",
				{ error: e },
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
				log.error("localStorage-backed OAuth storage also failed", {
					error: fallbackError,
				});
				resetSession();
			}
		} else {
			log.error("restoring the session failed", { error: e });
			resetSession();
		}
	}

	if (!agent) return;

	pdsHost = readCachedPdsHost(agent.did!);
	void resolvePdsHost(agent.did!);
};

const pdsHostKey = (did: string) => `colibri:pds:${did}`;

const readCachedPdsHost = (did: string): string | undefined => {
	try {
		return localStorage.getItem(pdsHostKey(did)) ?? undefined;
	} catch {
		return undefined;
	}
};

const resolvePdsHost = async (did: string): Promise<void> => {
	try {
		const didDoc = (await (
			await fetch(
				`${getAppViewHost("http")}/xrpc/com.atproto.identity.resolveDid?did=${did}`,
			)
		).json()) as DidDocument;

		if (!didDoc.service) {
			throw new ColibriError({
				code: "MalformedResponse",
				method: "com.atproto.identity.resolveDid",
				context: { did },
			});
		}

		const resolved = didDoc.service
			.find((x) => x.id === "#atproto_pds")
			?.serviceEndpoint.toString();

		if (!resolved) return;
		pdsHost = resolved;
		try {
			localStorage.setItem(pdsHostKey(did), resolved);
		} catch {}
	} catch (e) {
		const failure = classifyThrown(e, {
			method: "com.atproto.identity.resolveDid",
		});
		log.warn("resolving the PDS host failed", { code: failure.code });
	}
};

const restoreExistingSession = async () => {
	const client = oAuthClient;
	if (!client) return;

	{
		if (window.location.hash.length > 0) {
			log.debug("attempting to read a session from callback parameters");
			const searchParams = new URLSearchParams(
				window.location.hash.replace("#", "?"),
			);

			if (searchParams.has("error")) {
				const failure = classifyOAuthParams(searchParams);
				log.info("the provider ended the sign-in without a session", {
					code: failure.code,
					oauthError: failure.context.oauthError,
				});
				try {
					await client.callback(searchParams);
				} catch {}
			} else {
				const callbackSession = await client.callback(searchParams);

				if (callbackSession && !window.location.href.startsWith("/app")) {
					if (!isAllowedDid(callbackSession.session.sub)) {
						log.info("account is not in the early-access allowlist");
						await clearDisallowedSession(callbackSession.session.sub);
						return;
					}
					log.info("session received from callback parameters");
					localStorage.setItem("sub", callbackSession.session.sub);
					window.location.href = "/app";
					return;
				}
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
				log.info("no session found");
				return;
			}
		}

		const { session, state } = result;

		if (!isAllowedDid(session.sub)) {
			log.info("account is not in the early-access allowlist");
			await clearDisallowedSession(session.sub);
			return;
		}

		if (state != null) {
			log.info("authenticated", { state });
		} else {
			log.info("restored the last active session");
		}

		agent = new Agent(session);

		try {
			setGrantedScopes((await session.getTokenInfo(false)).scope);
		} catch {}

		const cached = grantedScopes();
		if (
			state == null &&
			navigator.onLine &&
			cached !== undefined &&
			getMissingScopeSets(cached).length === 0
		) {
			void revalidateGrantedScopes(session);
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
				if (wasCancelled(err)) return;
				throw classifyNativeError(err, "start_web_auth");
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
	log.debug("storage probe", { summary: probeSummary });
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
			throw await reportSignInFailure(err, input, "authorize");
		}

		log.warn(
			"sign-in stalled in local storage, retrying with localStorage-backed OAuth storage",
			{ error: err },
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
			throw await reportSignInFailure(
				fallbackError,
				input,
				"authorize-fallback",
			);
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

	if (params.has("error")) {
		try {
			await active.callback(params);
		} catch {}
		throw classifyOAuthParams(params);
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
