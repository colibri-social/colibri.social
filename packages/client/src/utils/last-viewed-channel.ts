const COMMUNITY_SEGMENT = /^\/app\/c\/([^/]+)/;

export const lastViewedChannelPath = (pathname: string): string | undefined => {
	const segment = COMMUNITY_SEGMENT.exec(pathname)?.[1];
	if (!segment) return undefined;
	let raw: string | null = null;
	try {
		raw = localStorage.getItem(`${segment}:last-viewed`);
	} catch {
		return undefined;
	}
	if (!raw) return undefined;
	try {
		const channel = JSON.parse(raw) as { uri: string; type: string };
		const identifier = channel.uri.split("/").pop();
		if (!identifier) return undefined;
		return `/app/c/${segment}/${channel.type}/${identifier}`;
	} catch {
		return undefined;
	}
};
