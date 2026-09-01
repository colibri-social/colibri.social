import { type Component, For, Show } from "solid-js";
import type { ProfileView } from "../../../atproto/views";
import { cx } from "../../../utils/cva";
import { Avatar } from "./Avatar";

export const AvatarStack: Component<{
	users: ReadonlyArray<ProfileView>;
	max?: number;
	class?: string;
}> = (props) => {
	const max = () => props.max ?? 5;
	const shown = () => props.users.slice(0, max());
	const overflow = () => props.users.length - shown().length;

	return (
		<div class={cx("flex shrink-0 flex-row items-center", props.class)}>
			<For each={shown()}>
				{(user, index) => (
					<Avatar
						user={user}
						size="small"
						disableState
						class={index() === 0 ? "" : "-ml-2"}
					/>
				)}
			</For>
			<Show when={overflow() > 0}>
				<span class="-ml-2 flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground outline outline-card">
					+{overflow() > 9 ? "9" : overflow()}
				</span>
			</Show>
		</div>
	);
};
