import { ChecklistIcon } from "@solar-icons/solid/bold/checklist";
import { CopyIcon } from "@solar-icons/solid/bold/copy";
import { ForbiddenCircleIcon } from "@solar-icons/solid/bold/forbidden-circle";
import { ForwardIcon } from "@solar-icons/solid/bold/forward";
import { MenuDotsIcon } from "@solar-icons/solid/bold/menu-dots";
import { PenIcon } from "@solar-icons/solid/bold/pen";
import { ReplyIcon } from "@solar-icons/solid/bold/reply";
import { SmileCircleIcon } from "@solar-icons/solid/bold/smile-circle";
import { TrashBinTrashIcon } from "@solar-icons/solid/bold/trash-bin-trash";
import { For, type JSX, Show } from "solid-js";
import { ThreadIcon } from "../../icons/custom";
import { cx } from "../../utils/cx";
import { useShiftHeld } from "../../utils/gestures/shift-held";
import { DropdownMenu } from "../DropdownMenu/DropdownMenu";
import { Tooltip, TooltipContent, TooltipTrigger } from "../Tooltip/Tooltip";
import type { RenderEmoji } from "./ReactionBar";

export const toolbarActionClass = cx(
	"group/action flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-control-sm outline-none",
	"text-muted-foreground hover:bg-popover-highlight hover:text-foreground data-expanded:bg-popover-highlight data-expanded:text-foreground",
	"focus-ring-inset",
);

const toolbarGlyphClass = cx(
	"flex size-5 items-center justify-center [&>img]:size-[18px] [&>svg]:size-5",
	"transition-transform duration-[calc(120ms*var(--motion-scale))] ease-out",
	"group-hover/action:scale-110 group-data-expanded/action:scale-110",
	"motion-reduce:transition-none motion-reduce:group-hover/action:scale-100",
	"reduced-motion:transition-none reduced-motion:group-hover/action:scale-100",
);

const destructiveActionClass =
	"text-destructive hover:bg-destructive/15 hover:text-destructive";

export type ToolbarActionProps = {
	label: string;
	icon: JSX.Element;
	onClick?: (event: MouseEvent) => void;
	action?: string;
	tone?: "default" | "destructive";
};

export const ToolbarAction = (props: ToolbarActionProps) => (
	<Tooltip>
		<TooltipTrigger
			as="button"
			type="button"
			data-toolbar-action={props.action}
			aria-label={props.label}
			onClick={(event: MouseEvent) => props.onClick?.(event)}
			class={cx(
				toolbarActionClass,
				props.tone === "destructive" && destructiveActionClass,
			)}
		>
			<span aria-hidden="true" class={toolbarGlyphClass}>
				{props.icon}
			</span>
		</TooltipTrigger>
		<TooltipContent>{props.label}</TooltipContent>
	</Tooltip>
);

const defaultRenderEmoji: RenderEmoji = (emoji) => (
	<span class="text-base leading-none">{emoji}</span>
);

export type MessageToolbarProps = {
	own?: boolean;
	recentReactions?: string[];
	onReact?: (emoji: string) => void;
	renderEmoji?: RenderEmoji;
	reactLabel?: (emoji: string) => string;
	onAddReaction?: (event: MouseEvent) => void;
	onEdit?: () => void;
	onReply?: () => void;
	onForward?: () => void;
	onOpenThread?: () => void;
	onCopyText?: () => void;
	onSelect?: () => void;
	onHide?: () => void;
	onDelete?: () => void;
	menu?: JSX.Element;
	menuOpen?: boolean;
	onMenuOpenChange?: (open: boolean) => void;
	class?: string;
};

export const MessageToolbar = (props: MessageToolbarProps) => {
	const recent = () => (props.recentReactions ?? []).slice(0, 3);
	const shiftHeld = useShiftHeld();
	const extras = () =>
		props.own
			? [props.onReply, props.onOpenThread, props.onCopyText, props.onDelete]
			: [props.onOpenThread, props.onCopyText, props.onSelect, props.onHide];
	const hasExtras = () => extras().some(Boolean);
	const revealed = () => shiftHeld() && hasExtras();

	return (
		<div
			role="toolbar"
			aria-label="Message actions"
			data-message-toolbar=""
			data-own={props.own || undefined}
			class={cx(
				"flex w-fit items-center gap-0.5 rounded-control border border-border bg-popover p-0.5 shadow-overlay",
				props.class,
			)}
		>
			<For each={recent()}>
				{(emoji) => (
					<ToolbarAction
						action="react"
						label={props.reactLabel?.(emoji) ?? `React with ${emoji}`}
						icon={(props.renderEmoji ?? defaultRenderEmoji)(emoji)}
						onClick={() => props.onReact?.(emoji)}
					/>
				)}
			</For>
			<Show when={recent().length > 0}>
				<div
					aria-hidden="true"
					data-toolbar-separator=""
					class="mx-0.5 h-5 w-px shrink-0 bg-border"
				/>
			</Show>
			<Show when={props.onAddReaction}>
				<ToolbarAction
					action="add-reaction"
					label="Add reaction"
					icon={<SmileCircleIcon />}
					onClick={(event) => props.onAddReaction?.(event)}
				/>
			</Show>
			<Show
				when={props.own}
				fallback={
					<Show when={props.onReply}>
						<ToolbarAction
							action="reply"
							label="Reply"
							icon={<ReplyIcon />}
							onClick={() => props.onReply?.()}
						/>
					</Show>
				}
			>
				<Show when={props.onEdit}>
					<ToolbarAction
						action="edit"
						label="Edit"
						icon={<PenIcon />}
						onClick={() => props.onEdit?.()}
					/>
				</Show>
			</Show>
			<Show when={props.onForward}>
				<ToolbarAction
					action="forward"
					label="Forward"
					icon={<ForwardIcon />}
					onClick={() => props.onForward?.()}
				/>
			</Show>
			<Show when={hasExtras()}>
				<div
					data-toolbar-extras=""
					data-revealed={revealed() || undefined}
					aria-hidden={revealed() ? undefined : "true"}
					inert={!revealed() || undefined}
					class="-ml-0.5 grid grid-cols-[0fr] data-revealed:ml-0 data-revealed:grid-cols-[1fr]"
				>
					<div class="flex min-w-0 items-center gap-0.5 overflow-hidden">
						<Show
							when={props.own}
							fallback={
								<>
									<Show when={props.onOpenThread}>
										<ToolbarAction
											action="open-thread"
											label="Open thread"
											icon={<ThreadIcon />}
											onClick={() => props.onOpenThread?.()}
										/>
									</Show>
									<Show when={props.onCopyText}>
										<ToolbarAction
											action="copy-text"
											label="Copy text"
											icon={<CopyIcon />}
											onClick={() => props.onCopyText?.()}
										/>
									</Show>
									<Show when={props.onSelect}>
										<ToolbarAction
											action="select"
											label="Select messages"
											icon={<ChecklistIcon />}
											onClick={() => props.onSelect?.()}
										/>
									</Show>
									<Show when={props.onHide}>
										<ToolbarAction
											action="hide"
											label="Hide message"
											icon={<ForbiddenCircleIcon />}
											tone="destructive"
											onClick={() => props.onHide?.()}
										/>
									</Show>
								</>
							}
						>
							<Show when={props.onReply}>
								<ToolbarAction
									action="reply"
									label="Reply"
									icon={<ReplyIcon />}
									onClick={() => props.onReply?.()}
								/>
							</Show>
							<Show when={props.onOpenThread}>
								<ToolbarAction
									action="open-thread"
									label="Open thread"
									icon={<ThreadIcon />}
									onClick={() => props.onOpenThread?.()}
								/>
							</Show>
							<Show when={props.onCopyText}>
								<ToolbarAction
									action="copy-text"
									label="Copy text"
									icon={<CopyIcon />}
									onClick={() => props.onCopyText?.()}
								/>
							</Show>
							<Show when={props.onDelete}>
								<ToolbarAction
									action="delete"
									label="Delete message"
									icon={<TrashBinTrashIcon />}
									tone="destructive"
									onClick={() => props.onDelete?.()}
								/>
							</Show>
						</Show>
					</div>
				</div>
			</Show>
			<Show when={props.menu}>
				<DropdownMenu
					label="More actions"
					triggerClass={toolbarActionClass}
					triggerProps={{ title: "More actions" }}
					trigger={
						<span aria-hidden="true" class={toolbarGlyphClass}>
							<MenuDotsIcon />
						</span>
					}
					open={props.menuOpen}
					onOpenChange={props.onMenuOpenChange}
					placement="bottom-end"
					menu={props.menu}
				/>
			</Show>
		</div>
	);
};
