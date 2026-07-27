import { isTauriRuntime } from "../notifications/environment";

export type NetworkInformation = {
	effectiveType?: string;
	downlink?: number;
	rtt?: number;
	saveData?: boolean;
	type?: string;
};

export const getConnection = (): NetworkInformation | undefined => {
	if (typeof navigator === "undefined") return undefined;
	const nav = navigator as Navigator & {
		connection?: NetworkInformation;
		mozConnection?: NetworkInformation;
		webkitConnection?: NetworkInformation;
	};
	return nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
};

export const timeZone = (): string => {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone;
	} catch {
		return "unknown";
	}
};

export const nativeOsInfo = async () => {
	if (!isTauriRuntime()) return {};
	try {
		const os = await import("@tauri-apps/plugin-os");
		return {
			platform: os.platform(),
			osVersion: os.version(),
			osType: os.type(),
			arch: os.arch(),
		};
	} catch {
		return {};
	}
};

export const deviceContext = async () => {
	const nav =
		typeof navigator === "undefined"
			? undefined
			: (navigator as Navigator & {
					deviceMemory?: number;
					standalone?: boolean;
				});

	return {
		...(await nativeOsInfo()),
		native: isTauriRuntime(),
		userAgent: nav?.userAgent,
		language: nav?.language,
		languages: nav?.languages?.join(","),
		timeZone: timeZone(),
		utcOffsetMinutes: new Date().getTimezoneOffset(),
		hardwareConcurrency: nav?.hardwareConcurrency,
		deviceMemory: nav?.deviceMemory,
		maxTouchPoints: nav?.maxTouchPoints,
		screen:
			typeof screen === "undefined"
				? undefined
				: `${screen.width}x${screen.height}`,
		viewport:
			typeof window === "undefined"
				? undefined
				: `${window.innerWidth}x${window.innerHeight}`,
		pixelRatio: typeof window === "undefined" ? undefined : devicePixelRatio,
		standalone: nav?.standalone,
	};
};
