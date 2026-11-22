import { redactData, redactText } from "./redact.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
	atMs: number;
	level: LogLevel;
	scope: string;
	message: string;
	data: Record<string, unknown> | undefined;
}

export interface Logger {
	debug: (message: string, data?: Record<string, unknown>) => void;
	info: (message: string, data?: Record<string, unknown>) => void;
	warn: (message: string, data?: Record<string, unknown>) => void;
	error: (message: string, data?: Record<string, unknown>) => void;
	child: (suffix: string) => Logger;
}

const MAX_ENTRIES = 500;
const LEVEL_ORDER: Record<LogLevel, number> = {
	debug: 10,
	info: 20,
	warn: 30,
	error: 40,
};

export interface LoggerHost {
	dev: boolean;
	breadcrumb: (entry: LogEntry) => void;
}

let host: LoggerHost = { dev: false, breadcrumb: () => {} };

const VERBOSE_STORAGE_KEY = "colibri:verbose-logging";

const entries: Array<LogEntry> = [];

const readVerbose = (): boolean => {
	if (typeof localStorage === "undefined") return false;
	try {
		return localStorage.getItem(VERBOSE_STORAGE_KEY) === "1";
	} catch {
		return false;
	}
};

let minLevel: LogLevel = readVerbose() ? "debug" : "info";

export const configureLogger = (next: Partial<LoggerHost>): void => {
	host = { ...host, ...next };
	if (host.dev) minLevel = "debug";
};

export const setLogLevel = (level: LogLevel): void => {
	minLevel = level;
};

export const setVerboseLogging = (enabled: boolean): void => {
	minLevel = enabled ? "debug" : host.dev ? "debug" : "info";
	if (typeof localStorage === "undefined") return;
	try {
		if (enabled) localStorage.setItem(VERBOSE_STORAGE_KEY, "1");
		else localStorage.removeItem(VERBOSE_STORAGE_KEY);
	} catch {}
};

export const isVerboseLogging = (): boolean => minLevel === "debug";

export const logEntries = (): Array<LogEntry> => [...entries];

export const resetLog = (): void => {
	entries.length = 0;
};

const SCOPE_COLOURS = [
	"#60a5fa",
	"#34d399",
	"#fbbf24",
	"#f472b6",
	"#a78bfa",
	"#22d3ee",
];

const colourFor = (scope: string): string => {
	let hash = 0;
	for (let index = 0; index < scope.length; index += 1) {
		hash = (hash * 31 + scope.charCodeAt(index)) % 4096;
	}
	return SCOPE_COLOURS[hash % SCOPE_COLOURS.length] ?? "#60a5fa";
};

const CONSOLE_METHOD: Record<LogLevel, "debug" | "info" | "warn" | "error"> = {
	debug: "debug",
	info: "info",
	warn: "warn",
	error: "error",
};

const emitToConsole = (entry: LogEntry): void => {
	if (typeof console === "undefined") return;

	const method = CONSOLE_METHOD[entry.level];
	if (host.dev) {
		const style = `color:${colourFor(entry.scope)};font-weight:bold`;
		if (entry.data) {
			console[method](`%c[${entry.scope}]`, style, entry.message, entry.data);
		} else {
			console[method](`%c[${entry.scope}]`, style, entry.message);
		}
		return;
	}

	if (entry.level !== "warn" && entry.level !== "error") return;
	if (entry.data)
		console[method](`[${entry.scope}] ${entry.message}`, entry.data);
	else console[method](`[${entry.scope}] ${entry.message}`);
};

const record = (
	level: LogLevel,
	scope: string,
	message: string,
	data: Record<string, unknown> | undefined,
): void => {
	const entry: LogEntry = {
		atMs: Date.now(),
		level,
		scope,
		message: redactText(message),
		data: redactData(data),
	};

	entries.push(entry);
	if (entries.length > MAX_ENTRIES) entries.shift();

	if (LEVEL_ORDER[level] >= LEVEL_ORDER[minLevel]) emitToConsole(entry);

	if (level === "warn" || level === "error") {
		host.breadcrumb(entry);
	}
};

export const createLogger = (scope: string): Logger => ({
	debug: (message, data) => record("debug", scope, message, data),
	info: (message, data) => record("info", scope, message, data),
	warn: (message, data) => record("warn", scope, message, data),
	error: (message, data) => record("error", scope, message, data),
	child: (suffix) => createLogger(`${scope}/${suffix}`),
});

export const formatLogEntry = (entry: LogEntry): string => {
	const time = new Date(entry.atMs).toISOString().slice(11, 23);
	const suffix = entry.data ? ` ${JSON.stringify(entry.data)}` : "";
	return `${time} ${entry.level.toUpperCase().padEnd(5)} [${entry.scope}] ${entry.message}${suffix}`;
};

export const formatLog = (limit = MAX_ENTRIES): string =>
	entries.slice(-limit).map(formatLogEntry).join("\n");
