import { ActorData } from "@colibri-social/lib";
import { Component } from "solid-js";
import { Avatar } from "./Avatar";
import { DisplayableName } from "./DisplayableName";

export const InlineProfile: Component<{ user: ActorData; color?: boolean }> = (
	props,
) => {
	return (
		<div class="flex flex-row gap-2 items-center">
			<Avatar user={props.user} size="small" disableState={false} />
			<DisplayableName color={props.color} user={props.user} />
		</div>
	);
};
