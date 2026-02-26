import { type Component, Match, Switch } from "solid-js";
import type { ChannelType } from "@/utils/sdk";
import { ChatCircleDots } from "../icons/ChatCircleDots";
import { Chats } from "../icons/Chats";
import { SpeakerLow } from "../icons/SpeakerLow";

/**
 * A component that returns the correct icon for a given channel type.
 */
export const ImageForChannelType: Component<{
	channelType: ChannelType | string;
}> = (props) => {
	return (
		<Switch>
			<Match when={props.channelType === "text"}>
				<ChatCircleDots />
			</Match>
			<Match when={props.channelType === "voice"}>
				<SpeakerLow />
			</Match>
			<Match when={props.channelType === "forum"}>
				<Chats />
			</Match>
		</Switch>
	);
};
