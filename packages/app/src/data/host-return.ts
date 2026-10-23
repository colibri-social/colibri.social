import { createLogger } from "@colibri-social/lib";
import type { HostSignInFailure } from "./hosting";

const log = createLogger("host-return");

export type HostReturn =
	| { status: "done"; request?: string }
	| { status: "failed"; request?: string; failure: HostSignInFailure };

const HOST_RETURN_PARAMS = [
	"hostRequest",
	"hostStatus",
	"hostFailure",
] as const;

const FAILURES = new Set<string>([
	"cancelled",
	"wrongAccount",
	"spacesUnsupported",
	"alreadyHosts",
	"failed",
]);

export const APP_RETURN_HREF = "social.colibri:/";

export const readHostReturn = (
	params: URLSearchParams,
): HostReturn | undefined => {
	const status = params.get("hostStatus");
	const request = params.get("hostRequest") || undefined;
	if (status === "done") {
		log.info("returned from a finished host sign-in");
		return { status: "done", request };
	}
	if (status !== "failed") return undefined;
	const reported = params.get("hostFailure") ?? "failed";
	const failure = (
		FAILURES.has(reported) ? reported : "failed"
	) as HostSignInFailure;
	log.warn("returned from a failed host sign-in", { code: failure });
	return { status: "failed", request, failure };
};

const handlers = new Set<(outcome: HostReturn) => void>();
let pending: HostReturn | undefined;

export const deliverHostReturn = (outcome: HostReturn) => {
	if (handlers.size === 0) {
		pending = outcome;
		return;
	}
	for (const handler of [...handlers]) handler(outcome);
};

export const listenForHostReturn = (handler: (outcome: HostReturn) => void) => {
	handlers.add(handler);
	const waiting = pending;
	pending = undefined;
	if (waiting) handler(waiting);
	return () => {
		handlers.delete(handler);
	};
};

export const captureHostReturn = (
	location: Pick<Location, "href"> = window.location,
	history: Pick<History, "state" | "replaceState"> = window.history,
) => {
	const url = new URL(location.href);
	const outcome = readHostReturn(url.searchParams);
	if (!outcome) return;
	for (const param of HOST_RETURN_PARAMS) url.searchParams.delete(param);
	history.replaceState(history.state, "", url);
	deliverHostReturn(outcome);
};

export const hostReturnFailureMessage = (
	failure: HostSignInFailure,
): string => {
	switch (failure) {
		case "cancelled":
			return "Signing in was cancelled. Go back to where you started to try again.";
		case "wrongAccount":
			return "You signed in as a different account. Go back to where you started to try again.";
		case "spacesUnsupported":
			return "That account's server can't host Spaces yet.";
		case "alreadyHosts":
			return "That account already hosts a Space.";
		default:
			return "Signing in didn't finish. Go back to where you started to try again.";
	}
};
