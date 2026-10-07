import { ChecklistIcon } from "@solar-icons/solid/bold/checklist";
import { CopyIcon } from "@solar-icons/solid/bold/copy";
import { EyeIcon } from "@solar-icons/solid/bold/eye";
import { ForbiddenCircleIcon } from "@solar-icons/solid/bold/forbidden-circle";
import { ForwardIcon } from "@solar-icons/solid/bold/forward";
import { HeartIcon } from "@solar-icons/solid/bold/heart";
import { InfoCircleIcon } from "@solar-icons/solid/bold/info-circle";
import { LinkIcon } from "@solar-icons/solid/bold/link";
import { LinkMinimalisticIcon } from "@solar-icons/solid/bold/link-minimalistic";
import { PenIcon } from "@solar-icons/solid/bold/pen";
import { ReplyIcon } from "@solar-icons/solid/bold/reply";
import { StarIcon } from "@solar-icons/solid/bold/star";
import { TrashBinTrashIcon } from "@solar-icons/solid/bold/trash-bin-trash";
import { type JSX, Show } from "solid-js";
import { ThreadIcon } from "../../icons/custom";
import { ContextMenu, MenuItem, MenuSeparator } from "./Menu";

export type MessageMenuLink = {
	onCopy?: () => void;
	onOpen?: () => void;
};

export type MessageMenuGif = {
	saved: boolean;
	onToggle: () => void;
};

export type MessageMenuActions = {
	link?: MessageMenuLink;
	onEdit?: () => void;
	onReply?: () => void;
	onForward?: () => void;
	onOpenThread?: () => void;
	onSelect?: () => void;
	onCopyText?: () => void;
	gif?: MessageMenuGif;
	onLinkPreviews?: () => void;
	onViewReactions?: () => void;
	onDebugInfo?: () => void;
	onDelete?: () => void;
	hidden?: boolean;
	onHide?: () => void;
	onUnhide?: () => void;
};

export const MessageMenuItems = (props: MessageMenuActions) => {
	const hasLink = () => !!(props.link?.onCopy || props.link?.onOpen);
	const hasPrimary = () =>
		!!(
			props.onEdit ||
			props.onReply ||
			props.onForward ||
			props.onOpenThread ||
			props.onSelect
		);
	const hasUtility = () =>
		!!(
			props.onCopyText ||
			props.gif ||
			props.onLinkPreviews ||
			props.onViewReactions ||
			props.onDebugInfo
		);
	const hideAction = () => (props.hidden ? props.onUnhide : props.onHide);
	const hasDanger = () => !!(props.onDelete || hideAction());

	return (
		<>
			<Show when={hasLink()}>
				<Show when={props.link?.onOpen}>
					<MenuItem
						icon={<LinkMinimalisticIcon />}
						label="Open link"
						onSelect={props.link?.onOpen}
					/>
				</Show>
				<Show when={props.link?.onCopy}>
					<MenuItem
						icon={<LinkIcon />}
						label="Copy link"
						onSelect={props.link?.onCopy}
					/>
				</Show>
				<Show when={hasPrimary() || hasUtility() || hasDanger()}>
					<MenuSeparator />
				</Show>
			</Show>
			<Show when={props.onEdit}>
				<MenuItem
					icon={<PenIcon />}
					label="Edit message"
					onSelect={props.onEdit}
				/>
			</Show>
			<Show when={props.onReply}>
				<MenuItem icon={<ReplyIcon />} label="Reply" onSelect={props.onReply} />
			</Show>
			<Show when={props.onForward}>
				<MenuItem
					icon={<ForwardIcon />}
					label="Forward"
					onSelect={props.onForward}
				/>
			</Show>
			<Show when={props.onOpenThread}>
				<MenuItem
					icon={<ThreadIcon />}
					label="Open thread"
					onSelect={props.onOpenThread}
				/>
			</Show>
			<Show when={props.onSelect}>
				<MenuItem
					icon={<ChecklistIcon />}
					label="Select messages"
					onSelect={props.onSelect}
				/>
			</Show>
			<Show when={hasPrimary() && (hasUtility() || hasDanger())}>
				<MenuSeparator />
			</Show>
			<Show when={props.onCopyText}>
				<MenuItem
					icon={<CopyIcon />}
					label="Copy text"
					onSelect={props.onCopyText}
				/>
			</Show>
			<Show when={props.gif}>
				{(gif) => (
					<MenuItem
						icon={<StarIcon class={gif().saved ? "text-warning" : undefined} />}
						label={gif().saved ? "Remove saved GIF" : "Save GIF"}
						onSelect={gif().onToggle}
					/>
				)}
			</Show>
			<Show when={props.onLinkPreviews}>
				<MenuItem
					icon={<LinkIcon />}
					label="Link previews"
					onSelect={props.onLinkPreviews}
				/>
			</Show>
			<Show when={props.onViewReactions}>
				<MenuItem
					icon={<HeartIcon />}
					label="View reactions"
					onSelect={props.onViewReactions}
				/>
			</Show>
			<Show when={props.onDebugInfo}>
				<MenuItem
					icon={<InfoCircleIcon />}
					label="Show debug information"
					onSelect={props.onDebugInfo}
				/>
			</Show>
			<Show when={hasDanger() && (hasPrimary() || hasUtility())}>
				<MenuSeparator />
			</Show>
			<Show when={props.onDelete}>
				<MenuItem
					icon={<TrashBinTrashIcon />}
					label="Delete message"
					tone="destructive"
					onSelect={props.onDelete}
				/>
			</Show>
			<Show
				when={props.hidden}
				fallback={
					<Show when={props.onHide}>
						<MenuItem
							icon={<ForbiddenCircleIcon />}
							label="Hide message"
							tone="destructive"
							onSelect={props.onHide}
						/>
					</Show>
				}
			>
				<Show when={props.onUnhide}>
					<MenuItem
						icon={<EyeIcon />}
						label="Unhide message"
						onSelect={props.onUnhide}
					/>
				</Show>
			</Show>
		</>
	);
};

export type MessageContextMenuProps = MessageMenuActions & {
	disabled?: boolean;
	onOpenChange?: (open: boolean) => void;
	class?: string;
	children?: JSX.Element;
};

export const MessageContextMenu = (props: MessageContextMenuProps) => (
	<ContextMenu
		disabled={props.disabled}
		onOpenChange={props.onOpenChange}
		class={props.class}
		aria-label="Message options"
		menu={<MessageMenuItems {...props} />}
	>
		{props.children}
	</ContextMenu>
);
