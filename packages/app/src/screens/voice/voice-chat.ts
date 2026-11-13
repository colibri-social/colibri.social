import { sameChannel } from "../../data/channel-layout";
import { isVoiceChannel } from "../../data/ids";
import type { DataStore } from "../../data/store";
import type { ChannelView, CommunityView } from "../../data/types";
import { voice } from "../../data/voice";
import type { VoicePermissions } from "../../data/voice/types";

const VOICE_CHAT = "voice.chat";

export type VoiceChatAccess = {
	channel: ChannelView;
	isOwner: boolean;
	guest: boolean;
	callPermissions: VoicePermissions | undefined;
};

export const canSeeVoiceChat = (access: VoiceChatAccess) => {
	if (!isVoiceChannel(access.channel)) return true;
	if (access.guest) return false;
	if (access.callPermissions && !access.callPermissions.has(VOICE_CHAT)) {
		return false;
	}
	if (access.isOwner) return true;
	const granted = access.channel.viewer.permissions;

	return !granted || granted.includes(VOICE_CHAT);
};

export const voiceChatAvailable = (
	data: Pick<DataStore, "space">,
	community: CommunityView | undefined,
	channel: ChannelView | undefined,
) => {
	if (!community || !channel) return true;
	const call = voice.current();
	const inCall = !!call && sameChannel(call.channel, channel.space);

	return canSeeVoiceChat({
		channel,
		isOwner: !!community.viewer.isOwner,
		guest: data.space(community).isGuestChannel(channel.space),
		callPermissions: inCall ? voice.permissions() : undefined,
	});
};
