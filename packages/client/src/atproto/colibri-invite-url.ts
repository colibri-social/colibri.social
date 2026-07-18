const INVITE_HOSTS = new Set(["colibri.social", "next.colibri.social"]);

export const parseColibriInviteUrl = (uri: string): string | null => {
	let url: URL;
	try {
		url = new URL(uri);
	} catch {
		return null;
	}

	if (!INVITE_HOSTS.has(url.hostname)) return null;

	const match = url.pathname.match(/^\/invite\/([^/]+)\/?$/);
	if (!match) return null;

	const code = decodeURIComponent(match[1]);
	return code.includes("/") ? null : code;
};
