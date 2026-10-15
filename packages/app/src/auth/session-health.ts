import {
	type ColibriErrorCode,
	classifyThrown,
	createLogger,
	needsReauthentication,
	readEnvelope,
} from "@colibri-social/lib";
import { type Accessor, createSignal } from "solid-js";

const log = createLogger("session");

const FAILURE_WINDOW_MS = 60_000;
const FAILURES_UNTIL_DEAD = 3;
const HARD_CODES = new Set<ColibriErrorCode>(["ExpiredToken", "InvalidToken"]);
const SOFT_CODES = new Set<ColibriErrorCode>(["AuthRequired"]);
const MINT_LXM = "com.atproto.server.getServiceAuth";
const DPOP_PROOF_CODES = new Set(["invalid_dpop_proof", "use_dpop_nonce"]);

export type SessionHealth = {
	dead: Accessor<boolean>;
	deadCode: Accessor<ColibriErrorCode | undefined>;
	scopesRejected: Accessor<boolean>;
	noteAuthFailure: (code: ColibriErrorCode) => void;
	noteAuthSuccess: () => void;
	noteScopesRejected: () => void;
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

export const createSessionHealth = (
	now: () => number = Date.now,
): SessionHealth => {
	const [dead, setDead] = createSignal(false);
	const [deadCode, setDeadCode] = createSignal<ColibriErrorCode>();
	const [scopesRejected, setScopesRejected] = createSignal(false);
	let suspended = false;
	let failures = 0;
	let windowStartedAt = 0;

	const markDead = (code: ColibriErrorCode) => {
		if (suspended || dead()) return;
		setDeadCode(code);
		setDead(true);
		log.warn("the session can no longer be used", { code });
	};

	const noteAuthFailure = (code: ColibriErrorCode) => {
		if (suspended || dead()) return;
		if (HARD_CODES.has(code)) {
			markDead(code);
			return;
		}
		if (!SOFT_CODES.has(code)) return;
		const at = now();
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
		noteAuthFailure,
		noteAuthSuccess,
		noteScopesRejected: () => {
			if (suspended || scopesRejected()) return;
			setScopesRejected(true);
			log.warn("a call was rejected for missing access");
		},
		noteSessionDeleted: (cause) => {
			const code = classifyThrown(cause).code;
			markDead(needsReauthentication(code) ? code : "InvalidToken");
		},
		markDead,
		observe: (url, pending) =>
			pending.then(
				async (res) => {
					if (res.ok) noteAuthSuccess();
					else if (res.status === 401 && !url.includes(MINT_LXM)) {
						const code = await dpopCode(res);
						if (!code || !DPOP_PROOF_CODES.has(code)) {
							noteAuthFailure("AuthRequired");
						}
					}
					return res;
				},
				(err: unknown) => {
					noteAuthFailure(classifyThrown(err).code);
					throw err;
				},
			),
		reset: () => {
			suspended = false;
			failures = 0;
			setDead(false);
			setDeadCode(undefined);
			setScopesRejected(false);
		},
		suspend: () => {
			suspended = true;
			setDead(false);
			setDeadCode(undefined);
		},
	};
};
