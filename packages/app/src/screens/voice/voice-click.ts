import { channelSlug } from "../../data/ids";
import { type ChannelView, VOICE_CHANNEL } from "../../data/types";
import { voice } from "../../data/voice";
import type { Navigator } from "../../shell/stack";

const isConnectedHere = (channelUri: string) =>
	voice.current()?.channel === channelUri &&
	voice.connection().state === "connected";

export const canJoinVoice = (channel: ChannelView) =>
	channel.viewer.canPost !== false;

export const clickVoiceChannel = (options: {
	space: string;
	channel: ChannelView;
	stack: Navigator;
	confirmJoin: boolean;
}) => {
	const { space, channel, stack } = options;
	const inCall = voice.current()?.channel === channel.space;
	if (!channel.viewer.canRead && !inCall) return;
	if (
		!isConnectedHere(channel.space) &&
		!options.confirmJoin &&
		canJoinVoice(channel)
	) {
		voice.join({ space, channel: channel.space });
		return;
	}
	stack.push({
		kind: "chat",
		channelType: VOICE_CHANNEL,
		space,
		channel: channelSlug(channel),
	});
};
