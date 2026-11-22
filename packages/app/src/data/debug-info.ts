import {
	isVerboseLogging,
	type LogEntry,
	logEntries,
} from "@colibri-social/lib";
import type { DiagnosticsField, DiagnosticsSection } from "@colibri-social/ui";
import { appViewUrl } from "../auth/appview";
import { resolvePdsHost } from "../auth/identity";
import { formatLogs } from "./log-buffer";
import {
	formatVideoSample,
	latestVideoStats,
	type VideoStatsSample,
} from "./voice/video-stats";

const RECENT_LOG_LINES = 60;

const value = (label: string, text: string): DiagnosticsField => ({
	kind: "value",
	label,
	value: text,
});

const list = (label: string, items: string[]): DiagnosticsField => ({
	kind: "list",
	label,
	items,
});

const isNative = () =>
	typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const nativeFields = async (): Promise<DiagnosticsField[]> => {
	try {
		const app = await import("@tauri-apps/api/app");
		const [version, tauri, identifier] = await Promise.all([
			app.getVersion(),
			app.getTauriVersion(),
			app.getIdentifier(),
		]);
		return [
			value("App version", version),
			value("Tauri version", tauri),
			value("Bundle identifier", identifier),
		];
	} catch {
		return [];
	}
};

const appSection = async (
	native = isNative(),
): Promise<DiagnosticsSection> => ({
	title: "App",
	fields: [
		value("Runtime", native ? "native" : "web"),
		value("Build", import.meta.env.DEV ? "development" : "production"),
		...(native ? await nativeFields() : []),
	],
});

const screenOf = () =>
	typeof screen === "undefined"
		? "unknown"
		: `${screen.width}x${screen.height}`;

const viewportOf = () =>
	typeof window === "undefined"
		? "unknown"
		: `${window.innerWidth}x${window.innerHeight}`;

const deviceSection = (): DiagnosticsSection => ({
	title: "Device",
	fields: [
		value("Locale", navigator.language || "unknown"),
		value("Timezone", Intl.DateTimeFormat().resolvedOptions().timeZone),
		value("Screen", screenOf()),
		value("Viewport", viewportOf()),
		value("Pixel ratio", String(window.devicePixelRatio || "unknown")),
		value("User agent", navigator.userAgent || "unknown"),
	],
});

export type AccountInput = {
	did: string;
	handle: string;
	liveStatus?: string;
	liveNode?: string;
	resolvePds?: (did: string) => Promise<string | undefined>;
	resolveNode?: (origin: string) => Promise<string | undefined>;
};

const NODE_PROBE_TIMEOUT_MS = 3_000;

export const nodeNameAt = async (
	origin: string,
	fetchImpl: typeof fetch = fetch,
): Promise<string | undefined> => {
	const response = await fetchImpl(new URL("/health", origin), {
		signal: AbortSignal.timeout(NODE_PROBE_TIMEOUT_MS),
	});
	const id = response.headers.get("colibri-node");
	const region = response.headers.get("colibri-node-region");

	if (!id) return undefined;

	return region ? `${id} (${region})` : id;
};

const liveNodeOf = async (input: AccountInput): Promise<string> => {
	if (!input.liveNode) return "unknown";

	const name = await (input.resolveNode ?? nodeNameAt)(input.liveNode).catch(
		() => undefined,
	);

	return name ? `${name} via ${input.liveNode}` : input.liveNode;
};

export const accountSection = async (
	input: AccountInput,
): Promise<DiagnosticsSection> => {
	const [pds, liveNode] = await Promise.all([
		(input.resolvePds ?? resolvePdsHost)(input.did).catch(() => undefined),
		liveNodeOf(input),
	]);
	return {
		title: "Account and services",
		fields: [
			value("DID", input.did),
			value("Handle", input.handle),
			value("PDS host", pds ?? "unknown"),
			value("AppView", appViewUrl()),
			value("Live connection", input.liveStatus ?? "unknown"),
			value("Live node", liveNode),
		],
	};
};

const connectionType = () =>
	(navigator as Navigator & { connection?: { effectiveType?: string } })
		.connection?.effectiveType ?? "unavailable";

const notificationPermission = () =>
	typeof Notification === "undefined" ? "unsupported" : Notification.permission;

const runtimeSection = (experiments: string[]): DiagnosticsSection => ({
	title: "Runtime",
	fields: [
		value("Online", String(navigator.onLine)),
		value("Connection type", connectionType()),
		value("Notification permission", notificationPermission()),
		list("Experiments", experiments),
	],
});

export const logSection = (
	entries: readonly LogEntry[] = logEntries(),
): DiagnosticsSection => ({
	title: "Recent log",
	fields: [
		value("Detailed logging", String(isVerboseLogging())),
		value("Entries kept", String(entries.length)),
		value(
			"Warnings and errors",
			String(
				entries.filter(
					(entry) => entry.level === "warn" || entry.level === "error",
				).length,
			),
		),
		list(
			"Last lines",
			formatLogs(entries.slice(-RECENT_LOG_LINES)).split("\n").filter(Boolean),
		),
	],
});

export const videoSection = (
	samples: readonly VideoStatsSample[] = latestVideoStats(),
): DiagnosticsSection => ({
	title: "Call video",
	fields: [list("Streams", samples.map(formatVideoSample))],
});

export const collectDiagnostics = async (
	input: AccountInput & { experiments: string[] },
): Promise<DiagnosticsSection[]> => {
	const [app, account] = await Promise.all([
		appSection(),
		accountSection(input),
	]);
	return [
		app,
		deviceSection(),
		account,
		runtimeSection(input.experiments),
		videoSection(),
		logSection(),
	];
};

const labelWidthOf = (sections: readonly DiagnosticsSection[]) =>
	Math.max(
		0,
		...sections.flatMap((section) =>
			section.fields
				.filter((field) => field.kind === "value")
				.map((field) => field.label.length),
		),
	);

const formatField = (field: DiagnosticsField, width: number) => {
	if (field.kind === "list") {
		const items =
			field.items.length > 0
				? field.items.map((item) => `  - ${item}`).join("\n")
				: "  - None";
		return `${field.label}:\n${items}`;
	}
	return `${`${field.label}:`.padEnd(width + 1)} ${field.value}`;
};

export const formatDiagnostics = (sections: readonly DiagnosticsSection[]) => {
	const width = labelWidthOf(sections);
	return sections
		.map(
			(section) =>
				`## ${section.title}\n${section.fields
					.map((field) => formatField(field, width))
					.join("\n")}`,
		)
		.join("\n\n");
};
