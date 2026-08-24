import { type Component, Match, Switch } from "solid-js";
import ChatCircleDotsIcon from "~icons/ph/chat-circle-dots";
import LockSimpleIcon from "~icons/ph/lock-simple";
import SpeakerLowIcon from "~icons/ph/speaker-low";
import { isVoiceChannelType } from "../../../utils/channel-type";

export const ChannelTypeIcon: Component<{
	type: string;
	private?: boolean;
	class?: string;
}> = (props) => (
	<Switch fallback={<ChatCircleDotsIcon class={props.class} />}>
		<Match when={props.private}>
			<LockSimpleIcon class={props.class} />
		</Match>
		<Match when={isVoiceChannelType(props.type)}>
			<SpeakerLowIcon class={props.class} />
		</Match>
	</Switch>
);
