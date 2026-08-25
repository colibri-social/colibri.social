import { createSignal } from "solid-js";
import { classifyThrown, readEnvelope } from "../errors/classify";
import { type ColibriErrorCode, needsReauthentication } from "../errors/codes";
import { ColibriError } from "../errors/error";
import { reportError } from "../errors/report";
import { createLogger } from "../utils/logger";

const log = createLogger("session");

const FAILURE_WINDOW_MS = 60_000;
const FAILURES_UNTIL_DEAD = 3;

const HARD_CODES = new Set<ColibriErrorCode>(["ExpiredToken", "InvalidToken"]);
const SOFT_CODES = new Set<ColibriErrorCode>(["AuthRequired"]);

const [dead, setDead] = createSignal(false);
const [deadCode, setDeadCode] = createSignal<ColibriErrorCode | undefined>(
	undefined,
);
const [scopesRejected, setScopesRejected] = createSignal(false);

let signingOut = false;
let failures = 0;
let windowStartedAt = 0;

export const sessionDead = dead;

export const sessionDeadCode = deadCode;

export const scopesRejectedByServer = scopesRejected;

export const noteScopesRejected = (context?: Record<string, unknown>): void => {
	if (signingOut || scopesRejected()) return;
	setScopesRejected(true);
	log.warn("the server rejected a call for a missing scope", context);
};

export const beginSignOut = (): void => {
	signingOut = true;
	setDead(false);
	setDeadCode(undefined);
};

export const markSessionDead = (
	code: ColibriErrorCode,
	context?: Record<string, unknown>,
): void => {
	if (signingOut || dead()) return;

	setDeadCode(code);
	setDead(true);
	log.warn("the session can no longer be used", { code });
	reportError(new ColibriError({ code, severity: "warning", context }), {
		stage: "session",
	});
};

export const noteAuthSuccess = (): void => {
	failures = 0;
};

export const noteAuthFailure = (
	code: ColibriErrorCode,
	context?: Record<string, unknown>,
): void => {
	if (signingOut || dead()) return;

	if (HARD_CODES.has(code)) {
		markSessionDead(code, context);
		return;
	}
	if (!SOFT_CODES.has(code)) return;

	const now = Date.now();
	if (failures === 0 || now - windowStartedAt > FAILURE_WINDOW_MS) {
		failures = 1;
		windowStartedAt = now;
	} else {
		failures += 1;
	}

	if (failures >= FAILURES_UNTIL_DEAD) {
		markSessionDead(code, { ...context, consecutiveFailures: failures });
	}
};

export const noteSessionDeleted = (cause: unknown): void => {
	const code = classifyThrown(cause).code;
	markSessionDead(needsReauthentication(code) ? code : "InvalidToken", {
		stage: "oauth.delete",
	});
};

const MINT_LXM = "com.atproto.server.getServiceAuth";

const DPOP_PROOF_CODES = new Set(["invalid_dpop_proof", "use_dpop_nonce"]);

const dpopCodeFromChallenge = (res: Response): string | undefined => {
	const challenge = res.headers.get("www-authenticate");
	if (!challenge?.startsWith("DPoP")) return undefined;
	return /error="([^"]+)"/.exec(challenge)?.[1];
};

const dpopCodeFromBody = async (res: Response): Promise<string | undefined> => {
	try {
		return readEnvelope(await res.clone().text()).code;
	} catch {
		return undefined;
	}
};

const isProofFailure = async (res: Response): Promise<boolean> => {
	const code = dpopCodeFromChallenge(res) ?? (await dpopCodeFromBody(res));
	return code !== undefined && DPOP_PROOF_CODES.has(code);
};

export const observeSession = (
	url: string,
	pending: Promise<Response>,
): Promise<Response> =>
	pending.then(
		async (res) => {
			if (res.ok) noteAuthSuccess();
			else if (res.status === 401 && !url.includes(MINT_LXM)) {
				if (!(await isProofFailure(res))) {
					noteAuthFailure("AuthRequired", { status: res.status });
				}
			}
			return res;
		},
		(err: unknown) => {
			noteAuthFailure(classifyThrown(err).code);
			throw err;
		},
	);
