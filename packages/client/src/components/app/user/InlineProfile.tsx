import type { Component } from "solid-js";
import type { ProfileView } from "../../../atproto/views";
import { Avatar } from "./Avatar";
import { DisplayableName } from "./DisplayableName";

export const InlineProfile: Component<{
	user: ProfileView;
	color?: boolean;
}> = (props) => {
	return (
		<div class="flex flex-row gap-2 items-center">
			<Avatar user={props.user} size="small" disableState={false} />
			<DisplayableName color={props.color} user={props.user} />
		</div>
	);
};
