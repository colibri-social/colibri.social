import {
	formatLogEntry,
	isVerboseLogging,
	type LogEntry,
	logEntries,
	setVerboseLogging,
} from "@colibri-social/lib";
import type { LogLine } from "@colibri-social/ui";
import { createSignal, onCleanup } from "solid-js";

export const LOG_REFRESH_MS = 1000;

const timeOf = (atMs: number) =>
	new Date(atMs).toLocaleTimeString(undefined, {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});

const messageOf = (entry: LogEntry) =>
	entry.data ? `${entry.message} ${JSON.stringify(entry.data)}` : entry.message;

export const toLogLine = (entry: LogEntry): LogLine => ({
	time: timeOf(entry.atMs),
	level: entry.level,
	scope: entry.scope,
	message: messageOf(entry),
});

export const formatLogs = (entries: readonly LogEntry[]) =>
	entries.map(formatLogEntry).join("\n");

export const createLogFeed = (refreshMs = LOG_REFRESH_MS) => {
	const [entries, setEntries] = createSignal<readonly LogEntry[]>(logEntries());
	const [verbose, setVerbose] = createSignal(isVerboseLogging());
	const timer = setInterval(() => {
		const next = logEntries();
		const current = entries();
		if (
			next.length !== current.length ||
			next.at(-1)?.atMs !== current.at(-1)?.atMs ||
			next[0]?.atMs !== current[0]?.atMs
		)
			setEntries(next);
	}, refreshMs);
	onCleanup(() => clearInterval(timer));
	return {
		lines: () => entries().map(toLogLine),
		text: () => formatLogs(entries()),
		verbose,
		setVerbose: (enabled: boolean) => {
			setVerboseLogging(enabled);
			setVerbose(isVerboseLogging());
		},
	};
};
