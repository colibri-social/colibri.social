import type { AT_URI } from "@colibri-social/lib";
import { AtURI, toRecordUri } from "../utils/at-uri";
import { webAppOrigin } from "../utils/web-origin";
import {
	communityUriToUrlCompatible,
	urlSegmentToUri,
} from "./community-uri-to-url-compatible";

const CHANNEL_HOSTS = new Set(["colibri.social", "next.colibri.social"]);

const DEEP_LINK_PROTOCOL = "social.colibri:";

const CHANNEL_PATH = /^\/app\/c\/([^/]+)\/([^/]+)\/([^/]+)/;

const CHANNEL_TYPE =
	/^(?:text|voice|forum|link|social\.colibri\.channel\.[a-z]+)$/;

export type ChannelUrlTarget = {
	communitySegment: string;
	communityUri: AT_URI<"social.colibri.community">;
	channelType: string;
	channelRkey: string;
	channelUri: string;
};

const build = (
	communitySegment: string,
	channelType: string,
	rkey: string,
): ChannelUrlTarget | null => {
	if (!communitySegment || !channelType || !rkey) return null;
	if (!CHANNEL_TYPE.test(channelType)) return null;

	const communityUri = urlSegmentToUri(communitySegment);
	const did = AtURI.parseAtURI(communityUri).did;
	if (!did?.startsWith("did:")) return null;

	const channelRkey = decodeURIComponent(rkey);
	if (!channelRkey) return null;

	return {
		communitySegment,
		communityUri,
		channelType,
		channelRkey,
		channelUri: toRecordUri(did, "social.colibri.channel", channelRkey),
	};
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

export const buildChannelPath = (target: {
	communityUri: string;
	channelType: string;
	channelRkey: string;
}): string => {
	const segment = communityUriToUrlCompatible(
		target.communityUri as AT_URI<"social.colibri.community">,
	);
	return `/app/c/${segment}/${target.channelType}/${encodeURIComponent(target.channelRkey)}`;
};

export const buildColibriChannelUrl = (target: {
	communityUri: string;
	channelType: string;
	channelRkey: string;
}): string => `${webAppOrigin()}${buildChannelPath(target)}`;
