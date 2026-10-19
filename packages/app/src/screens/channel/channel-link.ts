import { isVoiceChannel } from "../../data/ids";
import type { ChannelView } from "../../data/types";
import type { Navigator } from "../../shell/stack";
import { clickVoiceChannel } from "../voice/voice-click";
import { openVoicePrompt } from "../voice/voice-prompt";

export const openLinkedChannel = (options: {
	space: string;
	skey: string;
	channel: ChannelView | undefined;
	stack: Navigator;
	desktop: boolean;
	confirmJoin: boolean;
}) => {
	const { space, skey, channel, stack } = options;
	if (channel && isVoiceChannel(channel)) {
		if (options.desktop) {
			clickVoiceChannel({
				space,
				channel,
				stack,
				confirmJoin: options.confirmJoin,
			});
		} else {
			openVoicePrompt({ space, channel: channel.space });
		}
		return;
	}
	stack.replaceTop({
		kind: "chat",
		space,
		channel: skey,
		...(channel ? { channelType: channel.type } : {}),
	});
};
