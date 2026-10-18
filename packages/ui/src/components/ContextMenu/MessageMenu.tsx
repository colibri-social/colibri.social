import { ChecklistIcon } from "@solar-icons/solid/bold/checklist";
import { CopyIcon } from "@solar-icons/solid/bold/copy";
import { CopyAddIcon } from "@solar-icons/solid/bold/copy-add";
import { EyeIcon } from "@solar-icons/solid/bold/eye";
import { ForbiddenCircleIcon } from "@solar-icons/solid/bold/forbidden-circle";
import { ForwardIcon } from "@solar-icons/solid/bold/forward";
import { GalleryDownloadIcon } from "@solar-icons/solid/bold/gallery-download";
import { HeartIcon } from "@solar-icons/solid/bold/heart";
import { LinkIcon } from "@solar-icons/solid/bold/link";
import { LinkMinimalisticIcon } from "@solar-icons/solid/bold/link-minimalistic";
import { PenIcon } from "@solar-icons/solid/bold/pen";
import { ReplyIcon } from "@solar-icons/solid/bold/reply";
import { StarIcon } from "@solar-icons/solid/bold/star";
import { TrashBinTrashIcon } from "@solar-icons/solid/bold/trash-bin-trash";
import { type JSX, Show } from "solid-js";
import { ThreadIcon } from "../../icons/custom";
import { MenuEntryGroups } from "../DropdownMenu/DropdownMenu";
import { ContextMenu, MenuItem, MenuSeparator } from "./Menu";
import { type DeveloperMenuActions, developerEntry } from "./menu-entries";

export type MessageMenuLink = {
	onCopy?: () => void;
	onOpen?: () => void;
};

export type MessageMenuImage = {
	onCopy?: () => void;
	onDownload?: () => void;
};

export const ImageMenuItems = (props: MessageMenuImage) => (
	<>
		<Show when={props.onCopy}>
			<MenuItem
				icon={<CopyAddIcon />}
				label="Copy image"
				onSelect={props.onCopy}
			/>
		</Show>
		<Show when={props.onDownload}>
			<MenuItem
				icon={<GalleryDownloadIcon />}
				label="Download image"
				onSelect={props.onDownload}
			/>
		</Show>
	</>
);

export const hasImageActions = (image: MessageMenuImage | undefined) =>
	!!(image?.onCopy || image?.onDownload);

export type MessageMenuGif = {
	saved: boolean;
	onToggle: () => void;
};

export type MessageMenuActions = DeveloperMenuActions & {
	onCopySelection?: () => void;
	link?: MessageMenuLink;
	image?: MessageMenuImage;
	onEdit?: () => void;
	onReply?: () => void;
	onForward?: () => void;
	onOpenThread?: () => void;
	onSelect?: () => void;
	onCopyText?: () => void;
	gif?: MessageMenuGif;
	onLinkPreviews?: () => void;
	onViewReactions?: () => void;
	onDelete?: () => void;
	hidden?: boolean;
	onHide?: () => void;
	onUnhide?: () => void;
};

export const MessageMenuItems = (props: MessageMenuActions) => {
	const developer = () => developerEntry(props);
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
			developer()
		);
	const hideAction = () => (props.hidden ? props.onUnhide : props.onHide);
	const hasDanger = () => !!(props.onDelete || hideAction());

	return (
		<>
			<Show when={props.onCopySelection}>
				<MenuItem
					icon={<CopyIcon />}
					label="Copy"
					onSelect={props.onCopySelection}
				/>
				<Show
					when={
						hasLink() ||
						hasImageActions(props.image) ||
						hasPrimary() ||
						hasUtility() ||
						hasDanger()
					}
				>
					<MenuSeparator />
				</Show>
			</Show>
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
				<Show
					when={
						hasImageActions(props.image) ||
						hasPrimary() ||
						hasUtility() ||
						hasDanger()
					}
				>
					<MenuSeparator />
				</Show>
			</Show>
			<Show when={hasImageActions(props.image)}>
				<ImageMenuItems {...(props.image ?? {})} />
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
			<Show when={developer()}>
				{(entry) => <MenuEntryGroups entries={[entry()]} />}
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

export type ImageContextMenuProps = MessageMenuImage & {
	disabled?: boolean;
	contentClass?: string;
	onOpenChange?: (open: boolean) => void;
	class?: string;
	children?: JSX.Element;
};

export const ImageContextMenu = (props: ImageContextMenuProps) => (
	<ContextMenu
		disabled={props.disabled || !hasImageActions(props)}
		onOpenChange={props.onOpenChange}
		class={props.class}
		aria-label="Image options"
		contentClass={props.contentClass}
		menu={
			<ImageMenuItems onCopy={props.onCopy} onDownload={props.onDownload} />
		}
	>
		{props.children}
	</ContextMenu>
);

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
