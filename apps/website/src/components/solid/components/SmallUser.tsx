import { type Component, Show } from "solid-js";
import { useCommunityContext } from "../contexts/CommunityContext";

export const SmallUser: Component<{
	did: string;
	hideAvatar?: boolean;
	hoverable?: boolean;
}> = (props) => {
	const communityContext = useCommunityContext()!;
	const user = () =>
		communityContext.members().find((x) => x.member_did === props.did);
	return (
		<div
			class="inline text-wrap"
			classList={{
				"hover:bg-muted/50 w-full block! rounded-sm px-1": props.hoverable,
			}}
		>
			<Show when={!props.hideAvatar}>
				<img
					src={user()?.avatar_url || "/user-placeholder.png"}
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
