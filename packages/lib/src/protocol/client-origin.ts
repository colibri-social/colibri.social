export const CLIENT_ORIGIN = "https://spaces.colibri.social";

const WEB_PROTOCOLS = new Set(["http:", "https:"]);

const inNativeShell = () =>
	typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const clientOrigin = (): string => {
	if (typeof location === "undefined" || inNativeShell()) return CLIENT_ORIGIN;
	return WEB_PROTOCOLS.has(location.protocol) ? location.origin : CLIENT_ORIGIN;
};
