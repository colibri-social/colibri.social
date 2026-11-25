import { l } from "@atproto/lex";
import type { ChannelSpaceType } from "./lexicons.js";
import {
	CHANNEL_SPACE_TYPES,
	isChannelSpaceType,
	isThreadSpaceType,
	SPACE_TYPES,
} from "./lexicons.js";

export type ParsedSpace = {
	authority: string;
	type: string;
	skey: string;
};

const LEGACY_URL_TYPES: Record<string, ChannelSpaceType> = {
	text: SPACE_TYPES.channelText,
	voice: SPACE_TYPES.channelVoice,
};

export const SPACE_URI_PREFIX = "at:space/";

const LEGACY_SPACE_URI_PREFIX = "at://";
const LEGACY_SPACE_MARKER = "space";

const spaceSegments = (uri: string): Array<string> | undefined => {
	if (uri.startsWith(SPACE_URI_PREFIX)) {
		return uri.slice(SPACE_URI_PREFIX.length).split("/");
	}

	if (!uri.startsWith(LEGACY_SPACE_URI_PREFIX)) return undefined;

	const [authority = "", marker, ...rest] = uri
		.slice(LEGACY_SPACE_URI_PREFIX.length)
		.split("/");

	if (marker !== LEGACY_SPACE_MARKER) return undefined;

	return [authority, ...rest];
};

const completeSegments = (uri: string): Array<string> | undefined => {
	const segments = spaceSegments(uri);
	if (!segments || (segments.length !== 3 && segments.length !== 6)) {
		return undefined;
	}

	return segments.every(Boolean) ? segments : undefined;
};

export const spaceUri = (authority: string, type: string, skey: string) => {
	return `${SPACE_URI_PREFIX}${authority}/${type}/${skey}`;
};

export const threadSpace = (community: string, skey: string) => {
	return spaceUri(community, SPACE_TYPES.channelThread, skey);
};

export const isSpaceUri = (uri: string): boolean => {
	return completeSegments(uri) !== undefined;
};

export const canonicalSpaceUri = (uri: string): string => {
	const segments = completeSegments(uri);
	return segments ? `${SPACE_URI_PREFIX}${segments.join("/")}` : uri;
};

export const legacySpaceUri = (uri: string): string => {
	const segments = completeSegments(uri);
	if (!segments) return uri;

	const [authority, ...rest] = segments;

	return `${LEGACY_SPACE_URI_PREFIX}${authority}/${LEGACY_SPACE_MARKER}/${rest.join("/")}`;
};

const DID_SEGMENT = "did:[a-z]+:[a-zA-Z0-9._:%-]+";
const NSID_SEGMENT = "[a-zA-Z0-9.-]+";
const KEY_SEGMENT = "[a-zA-Z0-9._~:-]+";
const TAIL = `/(${NSID_SEGMENT})/(${KEY_SEGMENT})(?:/(${DID_SEGMENT})/(${NSID_SEGMENT})/(${KEY_SEGMENT}))?`;
const LEGACY_IN_TEXT = new RegExp(`at://(${DID_SEGMENT})/space${TAIL}`, "g");
const CANONICAL_IN_TEXT = new RegExp(`at:space/(${DID_SEGMENT})${TAIL}`, "g");

export const canonicalSpaceUrisInText = (text: string) => {
	return text.replace(LEGACY_IN_TEXT, (match) => canonicalSpaceUri(match));
};

export const legacySpaceUrisInText = (text: string) => {
	return text.replace(CANONICAL_IN_TEXT, (match) => legacySpaceUri(match));
};

export const mapSpaceUris = (
	value: unknown,
	map: (uri: string) => string,
): unknown => {
	if (typeof value === "string") return map(value);
	if (Array.isArray(value)) return value.map((item) => mapSpaceUris(item, map));
	if (typeof value !== "object" || value === null) return value;
	const prototype = Object.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null) return value;

	return Object.fromEntries(
		Object.entries(value).map(([key, item]) => [
			map(key),
			mapSpaceUris(item, map),
		]),
	);
};

export const canonicalSpaceUris = <T>(value: T): T => {
	return mapSpaceUris(value, canonicalSpaceUri) as T;
};

export const asSpaceRef = (ref: string): l.SpaceRefString => {
	const canonical = canonicalSpaceUri(ref);
	if (!l.isSpaceRefString(canonical)) {
		throw new TypeError(
			`expected a space reference, got ${JSON.stringify(ref)}`,
		);
	}

	return canonical;
};

export const parseSpace = (ref: string): ParsedSpace | undefined => {
	const segments = spaceSegments(ref);
	if (segments?.length !== 3) return undefined;

	const [authority, type, skey] = segments;
	if (!authority || !type || !skey) return undefined;

	return { authority, type, skey };
};

export const spaceType = (ref: string): string | undefined =>
	parseSpace(ref)?.type;

export const spaceAuthority = (ref: string): string | undefined =>
	parseSpace(ref)?.authority;

export const spaceSkey = (ref: string): string | undefined =>
	parseSpace(ref)?.skey;

export const isChannelSpace = (ref: string): boolean => {
	const parsed = parseSpace(ref);
	return parsed !== undefined && isChannelSpaceType(parsed.type);
};

export const isThreadSpace = (ref: string): boolean => {
	const parsed = parseSpace(ref);
	return parsed !== undefined && isThreadSpaceType(parsed.type);
};

export const threadSpaceRef = (
	community: string,
	skey: string,
): string | undefined => {
	if (!community || !skey) return undefined;
	return threadSpace(community, skey);
};

export const channelSpaceType = (
	urlType: string,
): ChannelSpaceType | undefined =>
	isChannelSpaceType(urlType) ? urlType : LEGACY_URL_TYPES[urlType];

export const channelSpaceRef = (
	community: string,
	urlType: string,
	skey: string,
): string | undefined => {
	const type = channelSpaceType(urlType);
	if (!type) return undefined;
	return spaceUri(community, type, skey);
};

export const spaceRecordUri = (
	space: string,
	author: string,
	collection: string,
	rkey: string,
): string | undefined => {
	if (!parseSpace(space)) return undefined;
	return `${canonicalSpaceUri(space)}/${author}/${collection}/${rkey}`;
};

export type ParsedSpaceRecord = {
	space: string;
	author: string;
	collection: string;
	rkey: string;
};

export const parseSpaceRecordUri = (
	uri: string,
): ParsedSpaceRecord | undefined => {
	const segments = spaceSegments(uri);
	if (segments?.length !== 6) return undefined;
	const [authority, type, skey, author, collection, rkey] = segments;
	if (!authority || !type || !skey || !author || !collection || !rkey)
		return undefined;
	return {
		space: spaceUri(authority, type, skey),
		author,
		collection,
		rkey,
	};
};

export const sameSpaceRecordRef = (
	space: string,
	collection: string,
	uri: string | undefined,
	fallback: { did: string; rkey: string } | undefined,
): { did: string; rkey: string } | undefined => {
	const parsed = uri ? parseSpaceRecordUri(uri) : undefined;
	if (
		parsed &&
		parsed.space === canonicalSpaceUri(space) &&
		parsed.collection === collection
	) {
		return { did: parsed.author, rkey: parsed.rkey };
	}
	return fallback ? { did: fallback.did, rkey: fallback.rkey } : undefined;
};

export const channelSpaceCandidates = (
	community: string,
	skey: string,
): Array<string> =>
	CHANNEL_SPACE_TYPES.map((type) => spaceUri(community, type, skey));
