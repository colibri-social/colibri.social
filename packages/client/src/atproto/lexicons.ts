import { com, social } from "@colibri-social/lexicons";

export const colibri = social.colibri.beta;

export const space = com.atproto.space;

export const simplespace = com.atproto.simplespace;

export type {
	ChannelSpaceType,
	Collection,
	Permission,
	SpaceType,
} from "@colibri-social/lexicons";
export {
	asAtUri,
	asCid,
	asDatetime,
	asDid,
	asDidOrUndefined,
	asHandle,
	asNsid,
	asRecordKey,
	asSpaceRef,
	asSpaceRefOrUndefined,
	asTid,
	asUri,
	asUriOrUndefined,
	CHANNEL_SPACE_TYPES,
	COLLECTIONS,
	COMMUNITY_SPACE_TYPES,
	channelSpace,
	communitySpaces,
	isChannelSpaceType,
	isPermission,
	isThreadSpaceType,
	LABEL_VALUES,
	MalformedValueError,
	PERMISSIONS,
	preferencesSpace,
	SELF,
	SPACE_TYPES,
	spaceUri,
	threadSpace,
} from "@colibri-social/lexicons";
