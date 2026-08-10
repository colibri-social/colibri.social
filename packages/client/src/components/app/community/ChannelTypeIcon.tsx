import { type Component, Match, Switch } from "solid-js";
import ChatCircleDotsIcon from "~icons/ph/chat-circle-dots";
import ChatsIcon from "~icons/ph/chats";
import SpeakerLowIcon from "~icons/ph/speaker-low";
import {
	isForumChannelType,
	isVoiceChannelType,
} from "../../../utils/channel-type";

export const ChannelTypeIcon: Component<{ type: string; class?: string }> = (
	props,
) => (
	<Switch fallback={<ChatCircleDotsIcon class={props.class} />}>
		<Match when={isVoiceChannelType(props.type)}>
			<SpeakerLowIcon class={props.class} />
		</Match>
		<Match when={isForumChannelType(props.type)}>
			<ChatsIcon class={props.class} />
		</Match>
	</Switch>
);
