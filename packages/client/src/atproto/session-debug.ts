import type { ColibriErrorCode } from "../errors/codes";
import { createLogger } from "../utils/logger";
import { endSession } from "./session";
import {
	markSessionDead,
	noteAuthFailure,
	sessionDead,
	sessionDeadCode,
} from "./session-health";

const log = createLogger("session/debug");

const DEBUG_STAGE = "debug.console";

interface SessionState {
	dead: boolean;
	code: ColibriErrorCode | undefined;
}

interface ColibriSessionDebug {
	state: () => SessionState;
	expire: (code?: ColibriErrorCode) => SessionState;
	fail: (code?: ColibriErrorCode) => SessionState;
	signOut: () => void;
	help: () => void;
}

declare global {
	interface Window {
		__colibriSession?: ColibriSessionDebug;
	}
}

const HELP = [
	"__colibriSession.expire(code?)  end the session (default ExpiredToken) and redirect to sign-in",
	"__colibriSession.fail(code?)    record one auth failure (default AuthRequired), three inside 60s end the session",
	"__colibriSession.signOut()      take the deliberate sign-out path instead, bypassing the session-health gate",
	"__colibriSession.state()        read back { dead, code }",
	"",
	"expire() reports a warning to Sentry exactly as a real session death does, tagged",
	`stage "${DEBUG_STAGE}". Both expire() and fail() no-op once the session is already`,
	"gone or a sign-out is under way, so check the returned state if nothing happens.",
].join("\n");

const state = (): SessionState => ({
	dead: sessionDead(),
	code: sessionDeadCode(),
});

export const initSessionDebug = (): void => {
	if (typeof window === "undefined") return;

	window.__colibriSession = {
		state,
		expire: (code = "ExpiredToken") => {
			log.warn("ending the session from the console", { code });
			markSessionDead(code, { stage: DEBUG_STAGE });
			return state();
		},
		fail: (code = "AuthRequired") => {
			log.warn("recording an auth failure from the console", { code });
			noteAuthFailure(code, { stage: DEBUG_STAGE });
			return state();
		},
		signOut: () => {
			log.warn("signing out from the console");
			void endSession();
		},
		help: () => console.info(HELP),
	};
};
