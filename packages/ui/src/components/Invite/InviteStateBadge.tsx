import { Show } from "solid-js";
import { cx } from "../../utils/cx";
import { type InviteState, inviteStateLabel } from "./invite-links";

export type InviteStateBadgeProps = {
	state: InviteState;
	class?: string;
};

export const InviteStateBadge = (props: InviteStateBadgeProps) => (
	<Show when={props.state !== "active"}>
		<span
			data-invite-state={props.state}
			class={cx(
				"inline-flex h-5 shrink-0 items-center rounded-badge bg-secondary px-1.5 text-xs font-semibold whitespace-nowrap text-muted-foreground",
				props.class,
			)}
		>
			{inviteStateLabel[props.state]}
		</span>
	</Show>
);
