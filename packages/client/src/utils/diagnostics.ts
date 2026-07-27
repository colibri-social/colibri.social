import {
	getGrantedScopeSets,
	getMissingScopeSets,
	scopeSetLabel,
} from "../atproto/scopes";
import type { SocketStatus } from "../contexts/Socket";
import { getBackend } from "../notifications";
import { isTauriRuntime } from "../notifications/environment";
import { hasCachedFcmToken } from "../notifications/push-fcm";
import {
	hasWebPushSubscription,
	isPushSupported,
} from "../notifications/push-web";
import { getPreferredAppViewUrl, verifyColibriAppView } from "./appview";
import { deviceContext, getConnection } from "./device-context";
import {
	detectPackageManagerChannel,
	getAppVersion,
	type InstallChannel,
} from "./updater";

export type DiagnosticsField =
	| { kind: "value"; label: string; value: string }
	| { kind: "list"; label: string; items: Array<string> };
export type DiagnosticsSection = {
	title: string;
	fields: Array<DiagnosticsField>;
};

const value = (label: string, value: string): DiagnosticsField => ({
	kind: "value",
	label,
	value,
});

const list = (label: string, items: Array<string>): DiagnosticsField => ({
	kind: "list",
	label,
	items,
});

export type DiagnosticsInput = {
	did: string;
	handle: string;
	pdsHost: string;
	grantedScopes: string | undefined;
	socketStatus: SocketStatus;
	nativeNotifications: boolean;
	experiments: Record<string, boolean>;
};

const clientVersion = (): string =>
	typeof __CLIENT_VERSION__ === "undefined" ? "unknown" : __CLIENT_VERSION__;

const clientCommit = (): string =>
	typeof __CLIENT_COMMIT__ === "undefined" ? "unknown" : __CLIENT_COMMIT__;

const installChannelLabel = (channel: InstallChannel | null): string => {
	if (channel === "homebrew") return "Homebrew";
	if (channel === "scoop") return "Scoop";
	if (channel === "direct") return "Direct install";
	return "Unknown";
};

const collectAppSection = async (): Promise<DiagnosticsSection> => {
	const native = isTauriRuntime();
	const fields: Array<DiagnosticsField> = [
		value("App version", await getAppVersion()),
		value("Client version", clientVersion()),
		value("Client commit", clientCommit()),
		value("Runtime", native ? "native" : "web"),
		value("Build", import.meta.env.DEV ? "development" : "production"),
	];

	if (native) {
		try {
			const { getTauriVersion, getIdentifier } = await import(
				"@tauri-apps/api/app"
			);
			fields.push(
				value("Tauri version", await getTauriVersion()),
				value("Bundle identifier", await getIdentifier()),
			);
		} catch {}

		const channel = await detectPackageManagerChannel();
		fields.push(value("Install channel", installChannelLabel(channel)));
	}

	return { title: "App", fields };
};

const collectDeviceSection = async (): Promise<DiagnosticsSection> => {
	const device = await deviceContext();
	const fields: Array<DiagnosticsField> = [];

	if (device.platform) fields.push(value("Platform", device.platform));
	if (device.osVersion) fields.push(value("OS version", device.osVersion));
	if (device.osType) fields.push(value("OS type", device.osType));
	if (device.arch) fields.push(value("Architecture", device.arch));

	fields.push(
		value("Locale", device.language ?? "unknown"),
		value("Timezone", device.timeZone),
		value("Screen", device.screen ?? "unknown"),
		value("Viewport", device.viewport ?? "unknown"),
		value(
			"Pixel ratio",
			device.pixelRatio ? String(device.pixelRatio) : "unknown",
		),
		value("User agent", device.userAgent ?? "unknown"),
	);

	return { title: "Device", fields };
};

const scopeSetLabels = (nsids: Array<string>): Array<string> => [
	...new Set(nsids.map(scopeSetLabel)),
];

const collectAccountSection = async (
	input: DiagnosticsInput,
): Promise<DiagnosticsSection> => {
	const appViewUrl = getPreferredAppViewUrl();
	const description = await verifyColibriAppView(appViewUrl);

	return {
		title: "Account & services",
		fields: [
			value("DID", input.did),
			value("Handle", input.handle),
			value("PDS host", input.pdsHost),
			list(
				"Permissions granted",
				input.grantedScopes
					? scopeSetLabels(getGrantedScopeSets(input.grantedScopes))
					: ["unknown"],
			),
			list(
				"Permissions missing",
				input.grantedScopes
					? scopeSetLabels(getMissingScopeSets(input.grantedScopes))
					: ["unknown"],
			),
			value("AppView", appViewUrl),
			value(
				"AppView software",
				description
					? `${description.software} ${description.flavor} v${description.version}`
					: "unreachable",
			),
		],
	};
};

const collectRuntimeSection = async (
	input: DiagnosticsInput,
): Promise<DiagnosticsSection> => {
	const connection = getConnection();
	const backend = getBackend();
	const [permission, pushSubscribed] = await Promise.all([
		backend.getPermission(),
		hasWebPushSubscription(),
	]);

	const enabledExperiments = Object.entries(input.experiments)
		.filter(([, enabled]) => enabled)
		.map(([id]) => id);

	return {
		title: "Runtime",
		fields: [
			value("Socket status", input.socketStatus),
			value(
				"Online",
				typeof navigator === "undefined" ? "unknown" : String(navigator.onLine),
			),
			value("Connection type", connection?.effectiveType ?? "unavailable"),
			value("Notification backend", backend.name),
			value("Notification support", String(backend.isSupported())),
			value("Notification permission", permission),
			value(
				"Native notifications preference",
				String(input.nativeNotifications),
			),
			value(
				"Web push",
				isPushSupported()
					? pushSubscribed
						? "present"
						: "none"
					: "unsupported",
			),
			value("FCM token", hasCachedFcmToken() ? "present" : "none"),
			list("Experiments", enabledExperiments),
		],
	};
};

export const collectDiagnostics = async (
	input: DiagnosticsInput,
): Promise<Array<DiagnosticsSection>> => {
	return Promise.all([
		collectAppSection(),
		collectDeviceSection(),
		collectAccountSection(input),
		collectRuntimeSection(input),
	]);
};

const labelWidthOf = (sections: Array<DiagnosticsSection>): number =>
	Math.max(
		...sections.flatMap((section) =>
			section.fields
				.filter((field) => field.kind === "value")
				.map((field) => field.label.length),
		),
	);

const formatField = (field: DiagnosticsField, labelWidth: number): string => {
	if (field.kind === "list") {
		const items =
			field.items.length > 0
				? field.items.map((item) => `  - ${item}`).join("\n")
				: "  - None";
		return `${field.label}:\n${items}`;
	}
	return `${(`${field.label}:`).padEnd(labelWidth + 1)} ${field.value}`;
};

export const formatDiagnostics = (
	sections: Array<DiagnosticsSection>,
): string => {
	const labelWidth = labelWidthOf(sections);

	const body = sections
		.map((section) => {
			const rows = section.fields
				.map((field) => formatField(field, labelWidth))
				.join("\n");
			return `${section.title}\n${rows}`;
		})
		.join("\n\n");

	return `\`\`\`\n${body}\n\`\`\``;
};
