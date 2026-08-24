import { type Component, Show } from "solid-js";
import EyeIcon from "~icons/ph/eye";
import EyeSlashIcon from "~icons/ph/eye-slash";
import type { ProfileView } from "../../../../atproto/views";
import { useMessageContext } from "../../../../contexts/Message";
import User from "../../user";
import { MessageTimestamp } from "./MessageTimestamp";

const RevealToggle: Component<{ label: string; icon: Component }> = (props) => {
	const { toggleRevealed } = useMessageContext();

	return (
		<button
			type="button"
			class="flex flex-row items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
			onClick={toggleRevealed}
		>
			<props.icon />
			<span>{props.label}</span>
		</button>
	);
};

export const HiddenMessagePlaceholder: Component<{
	author: ProfileView;
	createdAt: string;
	showAuthor: boolean;
}> = (props) => (
	<div class="flex flex-col gap-1 w-full min-w-0 justify-center pb-2">
		<Show when={props.showAuthor}>
			<div class="flex gap-2 text-sm items-baseline flex-wrap">
				<span class="font-bold">
					<User.DisplayableName user={props.author} />
				</span>
				<small class="text-muted-foreground">
					<MessageTimestamp datetime={props.createdAt} />
				</small>
			</div>
		</Show>
		<div class="flex flex-row items-center gap-3 flex-wrap">
			<span class="text-sm italic text-muted-foreground">
				Hidden by a moderator.
			</span>
			<RevealToggle label="Show anyway" icon={EyeIcon} />
		</div>
	</div>
);

export const HiddenMessageNotice: Component = () => (
	<div class="flex flex-row items-center gap-3 pl-14 pb-1 flex-wrap">
		<span class="text-xs italic text-muted-foreground">
			Hidden by a moderator.
		</span>
		<RevealToggle label="Hide again" icon={EyeSlashIcon} />
	</div>
);
