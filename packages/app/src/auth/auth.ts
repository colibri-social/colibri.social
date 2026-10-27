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
	getMissingScopeMethods,
	getMissingScopeSets,
	isColibriError,
	isRequestedScopeResource,
	isRetryableCode,
	isSignInDenial,
	isStorageFailure,
	scopeFeatureLabel,
	supportsSpaces,
} from "@colibri-social/lib";
import {
	type Accessor,
	batch,
	createMemo,
	createSignal,
	getOwner,
	onCleanup,
	untrack,
} from "solid-js";
import { type ResumeEnvironment, watchResume, watchWake } from "../data/resume";
import { openAppLink } from "../native/deep-links";
import { openNotificationLink } from "../native/push/activation";
import { reportError } from "../sentry/report";
import { rememberLaunchPath } from "../shell/message-jump";
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
import {
	createSessionHealth,
	type SessionHealth,
	UNATTRIBUTED_REJECTION,
} from "./session-health";

const log = createLogger("auth");

const SUB_KEY = "sub";
const RETURN_KEY = "colibri:return-to";
const HANDLED_LINK_KEY = "colibri:handled-deep-link";
const FALLBACK_FLAG_KEY = "colibri:oauth-storage-fallback";
const SCOPE_PAUSED_KEY = "colibri:scope-prompt-paused";
const SCOPE_REAPPROVAL_KEY = "colibri:scope-reapproval";
export const GRANT_REFRESH_AFTER_MS = 15 * 60_000;
export const NEAR_EXPIRY_MS = 5 * 60_000;
const SIGN_IN_TIMEOUT_MS = 75_000;
export const STARTUP_TIMEOUT_MS = 30_000;
export const BEFORE_SIGN_OUT_TIMEOUT_MS = 3_000;

export type SignOutOptions = {
	beforeSignOut?: () => Promise<unknown>;
};

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

export type ScopeNotice = {
	methods: string[];
	features: string[];
};

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
	beforeSignOutTimeoutMs?: number;
	appVersion?: string;
	resumeEnvironment?: ResumeEnvironment | null;
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
	scopeNotice: Accessor<ScopeNotice | undefined>;
	dismissScopeNotice: () => void;
	expiredCode: Accessor<ColibriErrorCode | undefined>;
	health: SessionHealth;
	init: () => Promise<void>;
	retryInit: () => Promise<void>;
	signIn: (handle: string, options?: { create?: boolean }) => Promise<void>;
	reauthorize: () => Promise<void>;
	signOut: (options?: SignOutOptions) => Promise<void>;
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

const readStringList = (raw: string | null, field: string): string[] => {
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw) as Record<string, unknown>;
		const list = parsed[field];
		return Array.isArray(list)
			? list.filter((item): item is string => typeof item === "string")
			: [];
	} catch {
		return [];
	}
};

const readField = (raw: string | null, field: string): unknown => {
	if (!raw) return undefined;
	try {
		return (JSON.parse(raw) as Record<string, unknown>)[field];
	} catch {
		return undefined;
	}
};

const scopeNoticeKey = (method: string) =>
	method === UNATTRIBUTED_REJECTION || isRequestedScopeResource(method)
		? method
		: UNATTRIBUTED_REJECTION;

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
	const beforeSignOutTimeoutMs =
		options.beforeSignOutTimeoutMs ?? BEFORE_SIGN_OUT_TIMEOUT_MS;
	const appVersion =
		options.appVersion ?? import.meta.env.VITE_APP_VERSION ?? "development";

	const readPaused = (): ReadonlySet<string> => {
		const raw = local.get(SCOPE_PAUSED_KEY);
		if (readField(raw, "version") === appVersion) {
			return new Set(readStringList(raw, "methods"));
		}
		if (raw !== null) local.remove(SCOPE_PAUSED_KEY);
		return new Set();
	};
	const [pausedMethods, setPausedMethods] = createSignal(readPaused());
	const [dismissedMethods, setDismissedMethods] = createSignal<
		ReadonlySet<string>
	>(new Set());
	let justReapproved: ReadonlySet<string> = new Set();

	const pauseMethods = (methods: readonly string[]) => {
		const current = pausedMethods();
		const added = methods.filter((method) => !current.has(method));
		if (added.length === 0) return;
		const next = new Set([...current, ...added]);
		setPausedMethods(next);
		local.set(
			SCOPE_PAUSED_KEY,
			JSON.stringify({ version: appVersion, methods: [...next] }),
		);
		log.info("access is still missing after approval, pausing the prompt", {
			count: added.length,
		});
	};

	let refreshSession: (() => Promise<unknown>) | undefined;
	const health = createSessionHealth(Date.now, {
		onScopesRejected: (method) => {
			const key = scopeNoticeKey(method);
			if (justReapproved.has(key)) pauseMethods([key]);
		},
		refresh: () => refreshSession?.() ?? Promise.resolve(),
	});
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
	const missingScopes = createMemo(() => getMissingScopeSets(grantedScope()));

	const neededMethods = createMemo(() => {
		const fromGrant = getMissingScopeMethods(grantedScope());
		const rejected = [...health.rejectedMethods()].map(scopeNoticeKey);
		return [...new Set([...fromGrant, ...rejected])];
	});

	const scopeNotice = createMemo<ScopeNotice | undefined>(() => {
		if (status() !== "signedIn" || missingScopes().length > 0) return;
		const paused = pausedMethods();
		const dismissed = dismissedMethods();
		const methods = neededMethods().filter(
			(method) => !paused.has(method) && !dismissed.has(method),
		);
		if (methods.length === 0) return;
		const features = [
			...new Set(
				methods.flatMap((method) => {
					const label = scopeFeatureLabel(method);
					return label ? [label] : [];
				}),
			),
		];
		return { methods, features };
	});

	let client: OAuthClientLike | undefined;
	let usingFallback = local.get(FALLBACK_FLAG_KEY) === "1";
	let initializing: Promise<void> | undefined;
	let startup = 0;
	let stopDeepLinks: (() => void) | undefined;
	let stopGrantRefresh: (() => void) | undefined;
	let stopWakeWatch: (() => void) | undefined;

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
		session.remove(SCOPE_REAPPROVAL_KEY);
		stopGrantRefresh?.();
		stopGrantRefresh = undefined;
		stopWakeWatch?.();
		stopWakeWatch = undefined;
		refreshSession = undefined;
		batch(() => {
			setAgent(undefined);
			setGrantedScope(undefined);
			setAccountHost(undefined);
		});
	};

	const applyGrant = (owner: Agent, scope: string | undefined) => {
		if (agent() !== owner) return;
		if (scope !== untrack(grantedScope)) health.clearScopeRejections();
		setGrantedScope(scope);
	};

	const refreshGrant = (oauth: OAuthSession, owner: Agent) =>
		oauth.getTokenInfo(true).then(
			(info) => applyGrant(owner, info.scope),
			(err: unknown) => {
				const failure = classifyThrown(err, { method: "oauth.getTokenInfo" });
				log.warn("refreshing access failed", { code: failure.code });
				health.noteAuthFailure(failure.code);
			},
		);

	const refreshGrantIfExpiring = async (oauth: OAuthSession, owner: Agent) => {
		let info: Awaited<ReturnType<OAuthSession["getTokenInfo"]>>;
		try {
			info = await oauth.getTokenInfo(false);
		} catch {
			return;
		}
		const expiresAt = info.expiresAt?.getTime();
		if (expiresAt === undefined || expiresAt - Date.now() > NEAR_EXPIRY_MS) {
			applyGrant(owner, info.scope);
			return;
		}
		return refreshGrant(oauth, owner);
	};

	const isOnline = () => typeof navigator === "undefined" || navigator.onLine;

	const settleReapproval = (did: string, scope: string | undefined) => {
		const raw = session.get(SCOPE_REAPPROVAL_KEY);
		session.remove(SCOPE_REAPPROVAL_KEY);
		if (readField(raw, "did") !== did) return;
		const asked = readStringList(raw, "methods");
		const stillMissing = new Set(getMissingScopeMethods(scope));
		pauseMethods(asked.filter((method) => stillMissing.has(method)));
		justReapproved = new Set(
			asked.filter((method) => !stillMissing.has(method)),
		);
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
		refreshSession = () => oauth.getTokenInfo(true);
		if (fresh) settleReapproval(oauth.did, scope);
		batch(() => {
			setAgent(next);
			setGrantedScope(scope);
			setAccountHost(host);
			setDismissedMethods(new Set<string>());
			setBase("signedIn");
		});
		const refreshable = () =>
			isOnline() && getMissingScopeSets(untrack(grantedScope)).length === 0;
		if (!fresh && scope && refreshable()) void refreshGrant(oauth, next);
		stopGrantRefresh?.();
		stopGrantRefresh = watchResume({
			onResume: () => {
				if (agent() === next && untrack(grantedScope) && refreshable()) {
					void refreshGrantIfExpiring(oauth, next);
				}
			},
			afterMs: GRANT_REFRESH_AFTER_MS,
			environment: options.resumeEnvironment,
		});
		stopWakeWatch?.();
		stopWakeWatch = watchWake({
			onWake: health.noteResume,
			environment: options.resumeEnvironment,
		});
	};

	const returnAfterSignIn = () => {
		const target = session.get(RETURN_KEY);
		session.remove(RETURN_KEY);
		const destination = target && isReturnablePath(target) ? target : "/app";
		rememberLaunchPath(destination);
		navigate(destination);
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
				session.set(HANDLED_LINK_KEY, url);
				if (openNotificationLink(url)) continue;
				const params = nativeCallbackParams(url);
				if (params) {
					void completeCallback(params);
					return;
				}
				openAppLink(url);
			}
		};
		try {
			stopDeepLinks = await listenForDeepLinks(handle);
			const handled = session.get(HANDLED_LINK_KEY);
			handle((await currentDeepLinks()).filter((url) => url !== handled));
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
		session.set(
			SCOPE_REAPPROVAL_KEY,
			JSON.stringify({ did, methods: untrack(neededMethods) }),
		);
		await signIn(did);
	};

	const signOut = async (signOutOptions: SignOutOptions = {}) => {
		health.suspend();
		const did = agent()?.did;
		const before = signOutOptions.beforeSignOut;
		if (before) {
			await withDeadline(
				Promise.resolve().then(before),
				beforeSignOutTimeoutMs,
				() =>
					new ColibriError({ code: "Timeout", method: "auth.beforeSignOut" }),
			).catch((err: unknown) => {
				log.warn("cleaning up before sign-out failed", {
					code: classifyThrown(err).code,
				});
			});
		}
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
		noteScopesRejected: ({ method }) => health.noteScopesRejected(method),
	});

	if (getOwner()) {
		onCleanup(() => {
			stopDeepLinks?.();
			stopGrantRefresh?.();
			stopWakeWatch?.();
		});
	}

	return {
		status,
		agent,
		did: () => agent()?.did,
		accountHost,
		phase,
		error,
		startupError,
		missingScopes,
		scopeNotice,
		dismissScopeNotice: () => {
			const shown = untrack(scopeNotice)?.methods ?? [];
			setDismissedMethods(new Set([...untrack(dismissedMethods), ...shown]));
		},
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
