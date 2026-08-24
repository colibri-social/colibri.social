import { webAppOrigin } from "../utils/web-origin";
import { isChannelSpaceType } from "./lexicons";
import { channelSpaceRef, parseSpace } from "./space-ref";

const CHANNEL_HOSTS = new Set([
	"colibri.social",
	"next.colibri.social",
	"spaces.colibri.social",
]);

const DEEP_LINK_PROTOCOL = "social.colibri:";

const CHANNEL_PATH = /^\/app\/c\/([^/]+)\/([^/]+)\/([^/]+)/;

export type ChannelUrlTarget = {
	community: string;
	channelType: string;
	channelSkey: string;
	channelSpace: string;
};

const build = (
	community: string,
	channelType: string,
	skey: string,
): ChannelUrlTarget | null => {
	if (!community || !channelType || !skey) return null;
	if (!community.startsWith("did:")) return null;

	const channelSkey = decodeURIComponent(skey);
	if (!channelSkey) return null;

	const channelSpace = channelSpaceRef(community, channelType, channelSkey);
	if (!channelSpace) return null;

	return { community, channelType, channelSkey, channelSpace };
};

export const parseChannelPath = (pathname: string): ChannelUrlTarget | null => {
	const match = CHANNEL_PATH.exec(pathname);
	if (!match) return null;

	return build(match[1], match[2], match[3]);
};

export const parseColibriChannelUrl = (
	input: string,
): ChannelUrlTarget | null => {
	let url: URL;
	try {
		url = new URL(input.trim());
	} catch {
		return null;
	}

	if (url.protocol === DEEP_LINK_PROTOCOL) {
		const segments = [url.host, ...url.pathname.split("/")].filter(Boolean);
		const index = segments.indexOf("channel");
		if (index === -1) return null;
		return build(segments[index + 1], segments[index + 2], segments[index + 3]);
	}

	if (url.protocol !== "http:" && url.protocol !== "https:") return null;

	const currentHost =
		typeof window === "undefined" ? undefined : window.location.host;
	if (!CHANNEL_HOSTS.has(url.hostname) && url.host !== currentHost) return null;

	return parseChannelPath(url.pathname);
};

export const buildChannelPath = (space: string): string | undefined => {
	const parsed = parseSpace(space);
	if (!parsed) return undefined;

	if (!isChannelSpaceType(parsed.type)) return undefined;

	return `/app/c/${parsed.authority}/${parsed.type}/${encodeURIComponent(parsed.skey)}`;
};

export const buildColibriChannelUrl = (space: string): string | undefined => {
	const path = buildChannelPath(space);
	return path === undefined ? undefined : `${webAppOrigin()}${path}`;
};
