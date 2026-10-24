import {
	ColibriError,
	type ColibriErrorCode,
	classifyThrown,
	createLogger,
	needsReauthentication,
	readEnvelope,
} from "@colibri-social/lib";
import { type Accessor, createSignal } from "solid-js";
import { reportError } from "../sentry/report";

const log = createLogger("session");

export const FAILURE_WINDOW_MS = 60_000;
export const FAILURES_UNTIL_DEAD = 3;
export const RESUME_GRACE_MS = 30_000;
const HARD_CODES = new Set<ColibriErrorCode>(["ExpiredToken", "InvalidToken"]);
const SOFT_CODES = new Set<ColibriErrorCode>(["AuthRequired"]);
const MINT_LXM = "com.atproto.server.getServiceAuth";
const DPOP_PROOF_CODES = new Set(["invalid_dpop_proof", "use_dpop_nonce"]);

export type SessionHealth = {
	dead: Accessor<boolean>;
	deadCode: Accessor<ColibriErrorCode | undefined>;
	scopesRejected: Accessor<boolean>;
	rejectedMethods: Accessor<ReadonlySet<string>>;
	noteAuthFailure: (code: ColibriErrorCode, startedIn?: number) => void;
	noteAuthSuccess: () => void;
	noteResume: () => void;
	noteScopesRejected: (method?: string) => void;
	clearScopeRejections: () => void;
	noteSessionDeleted: (cause: unknown) => void;
	markDead: (code: ColibriErrorCode) => void;
	observe: (url: string, pending: Promise<Response>) => Promise<Response>;
	reset: () => void;
	suspend: () => void;
};

const dpopCode = async (res: Response): Promise<string | undefined> => {
	const challenge = res.headers.get("www-authenticate");
	if (challenge?.startsWith("DPoP")) {
		const fromHeader = /error="([^"]+)"/.exec(challenge)?.[1];
		if (fromHeader) return fromHeader;
	}
	try {
		return readEnvelope(await res.clone().text()).code;
	} catch {
		return undefined;
	}
};

export const UNATTRIBUTED_REJECTION = "";

export type SessionHealthOptions = {
	onScopesRejected?: (method: string) => void;
	refresh?: () => Promise<unknown>;
	online?: () => boolean;
};

const browserOnline = (): boolean =>
	typeof navigator === "undefined" || navigator.onLine !== false;

export const createSessionHealth = (
	now: () => number = Date.now,
	options: SessionHealthOptions = {},
): SessionHealth => {
	const [dead, setDead] = createSignal(false);
	const [deadCode, setDeadCode] = createSignal<ColibriErrorCode>();
	const [rejectedMethods, setRejectedMethods] = createSignal<
		ReadonlySet<string>
	>(new Set());
	const scopesRejected = () => rejectedMethods().size > 0;
	const online = options.online ?? browserOnline;
	let suspended = false;
	let failures = 0;
	let windowStartedAt = 0;
	let resumedAt: number | undefined;
	let refreshedAt: number | undefined;
	let refreshEpoch = 0;
	let refreshing: Promise<void> | undefined;

	const markDead = (code: ColibriErrorCode) => {
		if (suspended || dead()) return;
		setDeadCode(code);
		setDead(true);
		log.warn("the session can no longer be used", { code });
		reportError(new ColibriError({ code, severity: "warning" }), {
			stage: "session",
		});
	};

	const refreshSession = () => {
		const refresh = options.refresh;
		if (!refresh || refreshing) return;
		refreshing = refresh().then(
			() => {
				refreshedAt = now();
				refreshEpoch += 1;
				failures = 0;
			},
			(err: unknown) => {
				log.warn("refreshing the session after a rejection failed", {
					code: classifyThrown(err).code,
				});
			},
		);
		void refreshing.finally(() => {
			refreshing = undefined;
		});
	};

	const inResumeGrace = (at: number) =>
		resumedAt !== undefined && at - resumedAt < RESUME_GRACE_MS;

	const refreshedRecently = (at: number) =>
		refreshedAt !== undefined && at - refreshedAt <= FAILURE_WINDOW_MS;

	const noteAuthFailure = (
		code: ColibriErrorCode,
		startedIn: number = refreshEpoch,
	) => {
		if (suspended || dead()) return;
		if (HARD_CODES.has(code)) {
			markDead(code);
			return;
		}
		if (!SOFT_CODES.has(code) || !online()) return;
		const at = now();
		if (options.refresh) {
			if (inResumeGrace(at) || !refreshedRecently(at)) {
				refreshSession();
				return;
			}
			if (startedIn !== refreshEpoch) return;
		} else if (inResumeGrace(at)) {
			return;
		}
		if (failures === 0 || at - windowStartedAt > FAILURE_WINDOW_MS) {
			failures = 1;
			windowStartedAt = at;
		} else {
			failures += 1;
		}
		if (failures >= FAILURES_UNTIL_DEAD) markDead(code);
	};

	const noteAuthSuccess = () => {
		failures = 0;
	};

	return {
		dead,
		deadCode,
		scopesRejected,
		rejectedMethods,
		noteAuthFailure,
		noteAuthSuccess,
		noteResume: () => {
			resumedAt = now();
			failures = 0;
		},
		noteScopesRejected: (method) => {
			if (suspended) return;
			const current = rejectedMethods();
			const key = method ?? UNATTRIBUTED_REJECTION;
			if (current.has(key)) return;
			if (key === UNATTRIBUTED_REJECTION && current.size > 0) return;
			setRejectedMethods(new Set([...current, key]));
			log.warn("a call was rejected for missing access", { method: key });
			options.onScopesRejected?.(key);
		},
		clearScopeRejections: () => setRejectedMethods(new Set<string>()),
		noteSessionDeleted: (cause) => {
			const code = classifyThrown(cause).code;
			markDead(needsReauthentication(code) ? code : "InvalidToken");
		},
		markDead,
		observe: (url, pending) => {
			const startedIn = refreshEpoch;
			return pending.then(
				async (res) => {
					if (res.ok) noteAuthSuccess();
					else if (res.status === 401 && !url.includes(MINT_LXM)) {
						const code = await dpopCode(res);
						if (!code || !DPOP_PROOF_CODES.has(code)) {
							noteAuthFailure("AuthRequired", startedIn);
						}
					}
					return res;
				},
				(err: unknown) => {
					noteAuthFailure(classifyThrown(err).code, startedIn);
					throw err;
				},
			);
		},
		reset: () => {
			suspended = false;
			failures = 0;
			resumedAt = undefined;
			refreshedAt = undefined;
			setDead(false);
			setDeadCode(undefined);
			setRejectedMethods(new Set<string>());
		},
		suspend: () => {
			suspended = true;
			setDead(false);
			setDeadCode(undefined);
		},
	};
};
