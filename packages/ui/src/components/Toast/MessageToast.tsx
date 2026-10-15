import { cx } from "../../utils/cx";
import { Avatar } from "../Avatar/Avatar";

export type MessageToastProps = {
	authorName: string;
	authorAvatar?: string;
	authorSeed?: string;
	location: string;
	spaceName?: string;
	text: string;
	onOpen: () => void;
	class?: string;
};

export const messageToastAnnouncement = (
	props: Pick<MessageToastProps, "authorName" | "location" | "spaceName">,
) =>
	props.spaceName
		? `New message from ${props.authorName} in ${props.location}, ${props.spaceName}`
		: `New message from ${props.authorName} in ${props.location}`;

export const MessageToast = (props: MessageToastProps) => (
	<button
		type="button"
		data-message-toast=""
		onClick={() => props.onOpen()}
		class={cx(
			"flex w-full cursor-pointer items-center gap-3 rounded-sheet py-3 pr-4 pl-3 text-left outline-none",
			"focus-ring-inset",
			"[@media(hover:hover)]:hover:bg-popover-highlight",
			props.class,
		)}
	>
		<Avatar
			src={props.authorAvatar}
			name={props.authorName}
			seed={props.authorSeed}
			size="md"
			aria-hidden="true"
		/>
		<span class="flex min-w-0 flex-1 flex-col gap-0.5">
			<span
				data-message-toast-header=""
				class="flex min-w-0 items-baseline gap-1.5 text-sm leading-5"
			>
				<span
					data-message-toast-author=""
					class="max-w-[60%] shrink-0 truncate font-semibold text-foreground"
				>
					{props.authorName}
				</span>
				<span
					data-message-toast-location=""
					class="min-w-0 flex-1 truncate text-xs text-muted-foreground"
				>
					{props.spaceName
						? `${props.spaceName} · ${props.location}`
						: props.location}
				</span>
			</span>
			<span
				data-message-toast-text=""
				class="truncate text-sm leading-5 text-muted-foreground"
			>
				{props.text}
			</span>
		</span>
	</button>
);
