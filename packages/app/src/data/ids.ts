import type { ChannelView, CommunityView, SpaceRef } from "./types";

export const spaceKey = (space: Pick<CommunityView, "did">) => space.did;

export const skeyOf = (space: SpaceRef | string) =>
	space.slice(space.lastIndexOf("/") + 1);

export const channelSlug = (channel: Pick<ChannelView, "space">) =>
	skeyOf(channel.space);

export const isVoiceChannel = (channel: Pick<ChannelView, "type">) =>
	channel.type === "social.colibri.beta.channel.voice";
