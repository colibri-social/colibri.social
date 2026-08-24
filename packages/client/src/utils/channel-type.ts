import { SPACE_TYPES } from "../atproto/lexicons";

export const isTextChannelType = (type: string): boolean =>
	type === "text" || type === SPACE_TYPES.channelText;

export const isVoiceChannelType = (type: string): boolean =>
	type === "voice" || type === SPACE_TYPES.channelVoice;
