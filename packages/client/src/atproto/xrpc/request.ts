import { configureXrpc } from "@colibri-social/lib";
import { reportError } from "../../errors/report";
import {
	noteScopesRejected,
	sessionDead,
	sessionDeadCode,
} from "../session-health";

export type { CallOptions, Method, Output } from "@colibri-social/lib";
export {
	call,
	QUEUED_HEADER,
	setDpopDiagnosticsProvider,
} from "@colibri-social/lib";

configureXrpc({
	report: (error, options) => reportError(error, options),
	sessionDead,
	sessionDeadCode,
	noteScopesRejected,
});
