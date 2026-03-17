import { type Component, Show } from "solid-js";

export const SmallUser: Component<{
	did: string;
	avatar?: string;
	displayName?: string;
	handle?: string;
	hideAvatar?: boolean;
}> = (props) => {
	return (
		<div class="inline text-wrap">
			<Show when={!props.hideAvatar}>
				<img
					src={props.avatar || "/user-placeholder.png"}
					width={20}
					height={20}
					alt={props.displayName || props.handle}
					class="rounded-full inline mr-2 relative bottom-0.5"
				/>
			</Show>
			<span class="text-wrap">{props.displayName || props.handle}</span>
		</div>
	);
};
