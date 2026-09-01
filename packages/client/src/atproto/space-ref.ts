import type { ChannelSpaceType } from "./lexicons";
import {
	CHANNEL_SPACE_TYPES,
	isChannelSpaceType,
	isThreadSpaceType,
	SPACE_TYPES,
	spaceUri,
	threadSpace,
} from "./lexicons";

export type ParsedSpace = {
	authority: string;
	type: string;
	skey: string;
};

const LEGACY_URL_TYPES: Record<string, ChannelSpaceType> = {
	text: SPACE_TYPES.channelText,
	voice: SPACE_TYPES.channelVoice,
};

export const parseSpace = (ref: string): ParsedSpace | undefined => {
	if (!ref.startsWith("at://")) return undefined;

	const [authority, marker, type, skey, ...rest] = ref.slice(5).split("/");
	if (marker !== "space" || rest.length > 0) return undefined;
	if (!authority || !type || !skey) return undefined;

	return { authority, type, skey };
};

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
	return `${space}/${author}/${collection}/${rkey}`;
};

export const channelSpaceCandidates = (
	community: string,
	skey: string,
): Array<string> =>
	CHANNEL_SPACE_TYPES.map((type) => spaceUri(community, type, skey));
