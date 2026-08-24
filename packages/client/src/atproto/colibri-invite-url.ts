const INVITE_HOSTS = new Set([
	"colibri.social",
	"next.colibri.social",
	"spaces.colibri.social",
]);

export const parseColibriInviteUrl = (uri: string): string | null => {
	let url: URL;
	try {
		url = new URL(uri);
	} catch {
		return null;
	}

	const currentHost =
		typeof window === "undefined" ? undefined : window.location.host;
	if (!INVITE_HOSTS.has(url.hostname) && url.host !== currentHost) return null;

	const match = url.pathname.match(/^\/invite\/([^/]+)\/?$/);
	if (!match) return null;

	const code = decodeURIComponent(match[1]);
	return code.includes("/") ? null : code;
};
