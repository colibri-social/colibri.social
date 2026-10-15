import {
	configureLogger,
	formatLog,
	formatLogEntry,
	type LogLevel,
	logEntries,
	resetLog,
	setLogLevel,
	setVerboseLogging,
} from "@colibri-social/lib";
import * as Sentry from "@sentry/solid";
import { setDiagnosticsProvider } from "../errors/report";

export type { LogEntry, Logger, LogLevel } from "@colibri-social/lib";
export {
	createLogger,
	formatLog,
	isVerboseLogging,
	logEntries,
	resetLog,
	setLogLevel,
	setVerboseLogging,
} from "@colibri-social/lib";

configureLogger({
	dev: import.meta.env.DEV,
	breadcrumb: (entry) =>
		Sentry.addBreadcrumb({
			category: entry.scope,
			message: entry.message,
			level: entry.level === "warn" ? "warning" : "error",
			data: entry.data,
		}),
});

interface ColibriLog {
	entries: typeof logEntries;
	dump: (limit?: number) => string;
	setLevel: (level: LogLevel) => void;
	setVerbose: (enabled: boolean) => void;
	reset: () => void;
}

declare global {
	interface Window {
		__colibriLog?: ColibriLog;
	}
}

const RECENT_FOR_REPORT = 40;

setDiagnosticsProvider(() => {
	const recent = logEntries().slice(-RECENT_FOR_REPORT);
	if (recent.length === 0) return undefined;
	return { recent: recent.map(formatLogEntry) };
});

if (typeof window !== "undefined") {
	window.__colibriLog = {
		entries: logEntries,
		dump: (limit) => {
			const text = formatLog(limit);
			console.info(text);
			return text;
		},
		setLevel: setLogLevel,
		setVerbose: setVerboseLogging,
		reset: resetLog,
	};
}
