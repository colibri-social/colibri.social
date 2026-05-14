import { type Component, Match, Switch } from "solid-js";
import { Icon } from "@/components/solid/icons/Icon";
import type { ChannelType } from "@/utils/sdk";

/**
 * A component that returns the correct icon for a given channel type.
 */
export const ImageForChannelType: Component<{
	channelType: ChannelType | string;
}> = (props) => {
	return (
		<Switch>
			<Match when={props.channelType === "text"}>
				<Icon variant="regular" name="chat-circle-dots-icon" />
			</Match>
			<Match when={props.channelType === "voice"}>
				<Icon variant="fill" name="speaker-low-icon" />
			</Match>
			<Match when={props.channelType === "forum"}>
				<Icon variant="regular" name="chats-icon" />
			</Match>
		</Switch>
	);
};
