import { Agent } from "@atproto/api";
import {
	type AuthorizeOptions,
	BrowserOAuthClient,
	type OAuthSession,
} from "@atproto/oauth-client-browser";
import {
	buildScopes,
	ColibriError,
	type ColibriErrorCode,
	classifyOAuthError,
	classifyOAuthParams,
	classifyThrown,
	configureXrpc,
	createLogger,
	getMissingScopeSets,
	isColibriError,
	isRetryableCode,
	isSignInDenial,
	isStorageFailure,
	supportsSpaces,
} from "@colibri-social/lib";
import {
	type Accessor,
	batch,
	createMemo,
	createSignal,
	getOwner,
	onCleanup,
} from "solid-js";
import { reportError } from "../sentry/report";
import { appViewDid } from "./appview";
import {
	callbackParamsFrom,
	classifyCallback,
	nativeCallbackParams,
	SIGN_IN_PATH,
} from "./callback";
import { makeClientId } from "./client-id";
import { withDeadline } from "./deadline";
import { createOAuthFetch } from "./fetch";
import {
	handleResolver,
	normalizeHandle,
	resolveHandleToDid,
	resolvePdsHost,
} from "./identity";
import {
	classifyNativeError,
	currentDeepLinks,
	isNativeErrorEnvelope,
	isNativeShell,
	listenForDeepLinks,
	startWebAuth,
} from "./native";
import { createSessionHealth, type SessionHealth } from "./session-health";

const log = createLogger("auth");

const SUB_KEY = "sub";
const RETURN_KEY = "colibri:return-to";
const FALLBACK_FLAG_KEY = "colibri:oauth-storage-fallback";
const SIGN_IN_TIMEOUT_MS = 75_000;
export const STARTUP_TIMEOUT_MS = 30_000;

const PRIMARY_DATABASE = {
	durability: "strict",
	cleanupInterval: 300_000,
} as const;
const FALLBACK_DATABASE = {
	backend: "localstorage",
	name: "@atproto-oauth-client-fallback",
	cleanupInterval: 300_000,
} as const;

type DatabaseOptions = typeof PRIMARY_DATABASE | typeof FALLBACK_DATABASE;

export type OAuthClientLike = Pick<
	BrowserOAuthClient,
	"init" | "restore" | "revoke" | "callback" | "authorize" | "signIn"
> & { clientMetadata: { redirect_uris: readonly string[] } };

export type LoadOAuthClient = (options: {
	clientId: string;
	database: DatabaseOptions;
	onSessionDeleted: (sub: string, cause: unknown) => void;
}) => Promise<OAuthClientLike>;

export type AuthStatus =
	| "loading"
	| "failed"
	| "signedOut"
	| "completing"
	| "signedIn"
	| "expired";

export type SignInPhase = "checking" | "redirecting" | "browser";

export type AuthOptions = {
	native?: boolean;
	loadClient?: LoadOAuthClient;
	storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
	session?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
	location?: Pick<
		Location,
		"hostname" | "host" | "port" | "pathname" | "search" | "hash"
	>;
	navigate?: (path: string) => void;
	openBrowser?: (url: string) => void;
	webAuth?: (url: string, scheme: string) => Promise<string>;
	onSignedOut?: () => void | Promise<void>;
	pdsHost?: (did: string) => Promise<string | undefined>;
	spacesSupport?: (host: string) => Promise<boolean | undefined>;
	startupTimeoutMs?: number;
};

export type Auth = {
	status: Accessor<AuthStatus>;
	agent: Accessor<Agent | undefined>;
	did: Accessor<string | undefined>;
	accountHost: Accessor<string | undefined>;
	phase: Accessor<SignInPhase | undefined>;
	error: Accessor<ColibriError | undefined>;
	startupError: Accessor<ColibriError | undefined>;
	missingScopes: Accessor<string[]>;
	expiredCode: Accessor<ColibriErrorCode | undefined>;
	health: SessionHealth;
	init: () => Promise<void>;
	retryInit: () => Promise<void>;
	signIn: (handle: string, options?: { create?: boolean }) => Promise<void>;
	reauthorize: () => Promise<void>;
	signOut: () => Promise<void>;
	completeCallback: (params: URLSearchParams) => Promise<boolean>;
	cancelSignIn: () => void;
	redirectToSignIn: () => void;
	clearError: () => void;
	onAuthFailure: (code: ColibriErrorCode) => void;
};

const defaultLoadClient: LoadOAuthClient = (options) =>
	BrowserOAuthClient.load({
		clientId: options.clientId,
		handleResolver,
		fetch: createOAuthFetch(),
		databaseOptions: options.database,
		onSessionDeleted: options.onSessionDeleted,
	});

const safeStorage = (
	pick: () => Pick<Storage, "getItem" | "setItem" | "removeItem">,
) => ({
	get: (key: string): string | null => {
		try {
			return pick().getItem(key);
		} catch {
			return null;
		}
	},
	set: (key: string, value: string) => {
		try {
			pick().setItem(key, value);
		} catch {}
	},
	remove: (key: string) => {
		try {
			pick().removeItem(key);
		} catch {}
	},
});

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
	withDeadline(
		promise,
		ms,
		() => new DOMException("Sign-in timed out", "TimeoutError"),
	);

const hostOf = (url: string): string | undefined => {
	try {
		return new URL(url).host;
	} catch {
		return undefined;
	}
};

export const asSignInError = (err: unknown): ColibriError => {
	if (isColibriError(err)) return err;
	const fromProvider = classifyOAuthError(err);
	if (fromProvider) return fromProvider;
	if (isStorageFailure(err)) {
		return new ColibriError({ code: "StorageStalled", cause: err });
	}
	return classifyThrown(err);
};

const isReturnablePath = (path: string) =>
	path.startsWith("/app") && !path.startsWith(SIGN_IN_PATH);

export const createAuth = (options: AuthOptions = {}): Auth => {
	const native = options.native ?? isNativeShell();
	const loadClient = options.loadClient ?? defaultLoadClient;
	const local = safeStorage(() => options.storage ?? localStorage);
	const session = safeStorage(() => options.session ?? sessionStorage);
	const location = () => options.location ?? window.location;
	const navigate =
		options.navigate ??
		((path: string) => window.history.replaceState(null, "", path));
	const openBrowser =
		options.openBrowser ??
		((url: string) => {
			void import("../native/open-external").then(({ openExternalUrl }) =>
				openExternalUrl(url),
			);
		});
	const webAuth = options.webAuth ?? startWebAuth;
	const pdsHost = options.pdsHost ?? resolvePdsHost;
	const spacesSupport = options.spacesSupport ?? supportsSpaces;
	const startupTimeoutMs = options.startupTimeoutMs ?? STARTUP_TIMEOUT_MS;

	const health = createSessionHealth();
	const [base, setBase] = createSignal<AuthStatus>("loading");
	const [agent, setAgent] = createSignal<Agent>();
	const [grantedScope, setGrantedScope] = createSignal<string>();
	const [accountHost, setAccountHost] = createSignal<string>();
	const [phase, setPhase] = createSignal<SignInPhase>();
	const [error, setError] = createSignal<ColibriError>();
	const [startupError, setStartupError] = createSignal<ColibriError>();

	const status = createMemo<AuthStatus>(() => {
		const current = base();
		if (current === "signedIn" && health.dead()) return "expired";
		return current;
	});
	const missingScopes = createMemo(() => {
		const scope = grantedScope();
		if (health.scopesRejected()) return getMissingScopeSets(scope ?? "");
		return scope === undefined ? [] : getMissingScopeSets(scope);
	});

	let client: OAuthClientLike | undefined;
	let usingFallback = local.get(FALLBACK_FLAG_KEY) === "1";
	let initializing: Promise<void> | undefined;
	let startup = 0;
	let stopDeepLinks: (() => void) | undefined;

	const clientId = () => makeClientId({ native, location: location() });

	const load = (database: DatabaseOptions) =>
		loadClient({
			clientId: clientId(),
			database,
			onSessionDeleted: (sub) => {
				if (agent()?.did !== sub) return;
				health.noteSessionDeleted(new Error("session deleted"));
			},
		});

	const clearSession = () => {
		local.remove(SUB_KEY);
		batch(() => {
			setAgent(undefined);
			setGrantedScope(undefined);
			setAccountHost(undefined);
		});
	};

	const adopt = async (oauth: OAuthSession, fresh: boolean) => {
		const next = new Agent({
			did: oauth.did,
			fetchHandler: (url, init) =>
				health.observe(url, oauth.fetchHandler(url, init)),
		});
		let scope: string | undefined;
		let host: string | undefined;
		try {
			const info = await oauth.getTokenInfo(false);
			scope = info.scope;
			host = hostOf(info.aud);
		} catch {}
		local.set(SUB_KEY, oauth.sub);
		health.reset();
		batch(() => {
			setAgent(next);
			setGrantedScope(scope);
			setAccountHost(host);
			setBase("signedIn");
		});
		const online = typeof navigator === "undefined" || navigator.onLine;
		if (!fresh && online && scope && getMissingScopeSets(scope).length === 0) {
			void oauth.getTokenInfo(true).then(
				(info) => setGrantedScope(info.scope),
				(err: unknown) => {
					const failure = classifyThrown(err, { method: "oauth.getTokenInfo" });
					log.warn("refreshing access failed", { code: failure.code });
					if (failure.needsReauth) health.markDead(failure.code);
				},
			);
		}
	};

	const returnAfterSignIn = () => {
		const target = session.get(RETURN_KEY);
		session.remove(RETURN_KEY);
		navigate(target && isReturnablePath(target) ? target : "/app");
	};

	const rememberReturn = () => {
		const here = `${location().pathname}${location().search}`;
		if (isReturnablePath(here)) session.set(RETURN_KEY, here);
	};

	const completeCallback = async (params: URLSearchParams) => {
		const active = client;
		if (!active) return false;
		const kind = classifyCallback(params);
		if (!kind) return false;
		if (kind === "failure") {
			try {
				await active.callback(params);
			} catch {}
			const failure = classifyOAuthParams(params);
			batch(() => {
				setPhase(undefined);
				setError(isSignInDenial(failure) ? undefined : failure);
				setBase(agent() ? "signedIn" : "signedOut");
			});
			if (isSignInDenial(failure)) log.info("sign-in was declined");
			else log.warn("sign-in ended with an error", { code: failure.code });
			return false;
		}
		setBase("completing");
		try {
			const { session: oauth } = await active.callback(params);
			await adopt(oauth, true);
			setPhase(undefined);
			returnAfterSignIn();
			return true;
		} catch (err) {
			const failure = asSignInError(err);
			log.error("finishing sign-in failed", { code: failure.code });
			batch(() => {
				setPhase(undefined);
				setError(failure);
				setBase(agent() ? "signedIn" : "signedOut");
			});
			return false;
		}
	};

	const restore = async (active: OAuthClientLike, current: () => boolean) => {
		const sub = local.get(SUB_KEY);
		try {
			const result = await active.init();
			if (!current()) return;
			if (result) {
				await adopt(result.session, false);
				return;
			}
			if (!sub) return;
			const restored = await active.restore(sub);
			if (!current()) return;
			await adopt(restored, false);
		} catch (err) {
			if (!current()) return;
			if (isStorageFailure(err)) {
				log.warn("local storage was unusable while restoring", {
					code: classifyThrown(err).code,
				});
				return;
			}
			const failure = classifyThrown(err);
			if (failure.needsReauth) {
				log.warn("the saved sign-in no longer works", { code: failure.code });
				clearSession();
				setError(new ColibriError({ code: failure.code, severity: "warning" }));
				return;
			}
			log.warn("refreshing the sign-in at launch failed", {
				code: failure.code,
			});
			if (!sub) return;
			try {
				const stored = await active.restore(sub, false);
				if (!current()) return;
				await adopt(stored, false);
			} catch (stale) {
				const code = classifyThrown(stale).code;
				if (!isRetryableCode(code)) clearSession();
			}
		}
	};

	const watchDeepLinks = async () => {
		const handle = (urls: string[]) => {
			for (const url of urls) {
				const params = nativeCallbackParams(url);
				if (params) {
					void completeCallback(params);
					return;
				}
			}
		};
		try {
			stopDeepLinks = await listenForDeepLinks(handle);
			handle(await currentDeepLinks());
		} catch {}
	};

	const boot = async (current: () => boolean) => {
		let loaded: OAuthClientLike;
		try {
			loaded = await load(usingFallback ? FALLBACK_DATABASE : PRIMARY_DATABASE);
		} catch (err) {
			if (!current()) return;
			log.error("loading sign-in failed", { code: classifyThrown(err).code });
			setError(asSignInError(err));
			setBase("signedOut");
			return;
		}
		if (!current()) return;
		client = loaded;
		const params = native ? undefined : callbackParamsFrom(location());
		if (params) {
			navigate(location().pathname);
			if (await completeCallback(params)) return;
		}
		await restore(loaded, current);
		if (!current()) return;
		if (base() === "loading") setBase(agent() ? "signedIn" : "signedOut");
		if (native && !stopDeepLinks) void watchDeepLinks();
	};

	const start = async () => {
		const attempt = ++startup;
		const current = () => attempt === startup;
		try {
			await withDeadline(
				boot(current),
				startupTimeoutMs,
				() => new ColibriError({ code: "Timeout", method: "auth.init" }),
			);
		} catch (err) {
			if (!current() || (base() !== "loading" && base() !== "completing"))
				return;
			startup += 1;
			const failure = classifyThrown(err, { method: "auth.init" });
			log.error("starting up failed", { code: failure.code });
			batch(() => {
				setStartupError(failure);
				setBase("failed");
			});
		}
	};

	const init = () => {
		initializing ??= start();
		return initializing;
	};

	const retryInit = () => {
		if (base() !== "failed") return init();
		initializing = undefined;
		client = undefined;
		batch(() => {
			setStartupError(undefined);
			setBase("loading");
		});
		return init();
	};

	const authorizeNative = async (
		active: OAuthClientLike,
		input: string,
		authorize: AuthorizeOptions,
	) => {
		const url = await withTimeout(
			active.authorize(input, {
				...authorize,
				signal: AbortSignal.timeout(SIGN_IN_TIMEOUT_MS),
			}),
			SIGN_IN_TIMEOUT_MS,
		);
		const redirectUri = active.clientMetadata.redirect_uris[0] ?? "";
		const scheme = redirectUri.split(":")[0] ?? "";
		let callbackUrl: string | undefined;
		try {
			callbackUrl = await webAuth(url.toString(), scheme);
		} catch (err) {
			if (isNativeErrorEnvelope(err) && err.code === "Cancelled") {
				setPhase(undefined);
				return;
			}
			if (!isNativeErrorEnvelope(err) || err.code !== "Unsupported") {
				throw classifyNativeError(err, "start_web_auth");
			}
		}
		if (callbackUrl !== undefined) {
			const params = nativeCallbackParams(callbackUrl);
			if (params) await completeCallback(params);
			else setPhase(undefined);
			return;
		}
		openBrowser(url.toString());
		setPhase("browser");
	};

	const authorize = async (
		active: OAuthClientLike,
		input: string,
		create: boolean,
	) => {
		const scope = buildScopes(appViewDid()).join(" ");
		const request: AuthorizeOptions = create
			? { scope, prompt: "create" }
			: { scope };
		if (native) {
			await authorizeNative(active, input, request);
			return;
		}
		rememberReturn();
		setPhase("redirecting");
		await withTimeout(
			active.signIn(input, {
				...request,
				signal: AbortSignal.timeout(SIGN_IN_TIMEOUT_MS),
			}),
			SIGN_IN_TIMEOUT_MS,
		);
	};

	const run = async (input: string, create: boolean) => {
		await init();
		const active = client;
		if (!active) return;
		try {
			await authorize(active, input, create);
		} catch (err) {
			if (!isStorageFailure(err) || usingFallback) throw err;
			log.warn("sign-in stalled in local storage, retrying with a fallback");
			local.set(FALLBACK_FLAG_KEY, "1");
			usingFallback = true;
			client = await load(FALLBACK_DATABASE);
			await authorize(client, input, create);
		}
	};

	const signIn = async (
		handle: string,
		signInOptions: { create?: boolean } = {},
	) => {
		if (phase()) return;
		const create = signInOptions.create === true;
		batch(() => {
			setError(undefined);
			setPhase("checking");
		});
		try {
			const input = create
				? handle
				: await resolveHandleToDid(normalizeHandle(handle));
			const host = create ? hostOf(input) : await pdsHost(input);
			if (host !== undefined && (await spacesSupport(host)) === false) {
				log.warn("the account's provider has no spaces support");
				throw new ColibriError({
					code: "SpacesUnsupported",
					context: { host, create },
				});
			}
			await run(input, create);
		} catch (err) {
			const failure = asSignInError(err);
			log.warn("sign-in failed", { code: failure.code });
			batch(() => {
				setPhase(undefined);
				setError(failure.code === "NativeCancelled" ? undefined : failure);
			});
		}
	};

	const reauthorize = async () => {
		const did = agent()?.did ?? local.get(SUB_KEY) ?? undefined;
		if (!did) return;
		await signIn(did);
	};

	const signOut = async () => {
		health.suspend();
		const did = agent()?.did;
		try {
			if (did) await client?.revoke(did);
		} catch (err) {
			log.warn("revoking the sign-in failed", {
				code: classifyThrown(err).code,
			});
		} finally {
			clearSession();
			batch(() => {
				setPhase(undefined);
				setError(undefined);
				setBase("signedOut");
			});
			navigate(SIGN_IN_PATH);
			await options.onSignedOut?.();
		}
	};

	configureXrpc({
		report: (error, options) => reportError(error, options),
		sessionDead: health.dead,
		sessionDeadCode: health.deadCode,
		noteScopesRejected: () => health.noteScopesRejected(),
	});

	if (getOwner()) onCleanup(() => stopDeepLinks?.());

	return {
		status,
		agent,
		did: () => agent()?.did,
		accountHost,
		phase,
		error,
		startupError,
		missingScopes,
		expiredCode: health.deadCode,
		health,
		init,
		retryInit,
		signIn,
		reauthorize,
		signOut,
		completeCallback,
		cancelSignIn: () => setPhase(undefined),
		redirectToSignIn: () => {
			if (location().pathname === SIGN_IN_PATH) return;
			rememberReturn();
			navigate(SIGN_IN_PATH);
		},
		clearError: () => setError(undefined),
		onAuthFailure: health.noteAuthFailure,
	};
};
