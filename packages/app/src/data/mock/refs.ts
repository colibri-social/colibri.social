import type {
	CommunityView,
	Datetime,
	Did,
	MessageView,
	SpaceRef,
} from "../types";

export const asDid = (value: string) => value as Did;
export const asHandle = (value: string) => value as CommunityView["handle"];
export const asDatetime = (time: number) =>
	new Date(time).toISOString() as Datetime;
export const asUri = (value: string) =>
	value as NonNullable<CommunityView["picture"]>;

export const TEXT_TYPE = "social.colibri.beta.channel.text";
export const VOICE_TYPE = "social.colibri.beta.channel.voice";

export type ChannelKind = "text" | "voice";

export const spaceRef = (community: Did, kind: ChannelKind, skey: string) =>
	`at://${community}/space/${kind === "voice" ? VOICE_TYPE : TEXT_TYPE}/${skey}` as SpaceRef;

export const parseSpaceRef = (ref: string) => {
	const match = /^at:\/\/([^/]+)\/space\/([^/]+)\/([^/]+)$/.exec(ref);
	if (!match) return undefined;
	return {
		community: match[1] as Did,
		type: match[2] as string,
		skey: match[3] as string,
	};
};

const TID_ALPHABET = "234567abcdefghijklmnopqrstuvwxyz";

export const tidFor = (time: number, clock = 0) => {
	let micros = BigInt(Math.floor(time)) * 1000n + BigInt(clock % 1000);
	let out = "";
	for (let index = 0; index < 11; index++) {
		out = TID_ALPHABET[Number(micros & 31n)] + out;
		micros >>= 5n;
	}
	const clockId = clock % 1024;
	return `${out}${TID_ALPHABET[(clockId >> 5) & 31]}${TID_ALPHABET[clockId & 31]}`;
};

export const messageUri = (author: Did, rkey: string) =>
	`at://${author}/social.colibri.beta.message/${rkey}` as MessageView["uri"];
