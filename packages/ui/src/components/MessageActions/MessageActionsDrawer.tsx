import { ChecklistIcon } from "@solar-icons/solid/bold/checklist";
import { CopyIcon } from "@solar-icons/solid/bold/copy";
import { EyeIcon } from "@solar-icons/solid/bold/eye";
import { ForbiddenCircleIcon } from "@solar-icons/solid/bold/forbidden-circle";
import { ForwardIcon } from "@solar-icons/solid/bold/forward";
import { PenIcon } from "@solar-icons/solid/bold/pen";
import { ReplyIcon } from "@solar-icons/solid/bold/reply";
import { SmileCircleIcon } from "@solar-icons/solid/bold/smile-circle";
import { TrashBinTrashIcon } from "@solar-icons/solid/bold/trash-bin-trash";
import {
	createEffect,
	For,
	type JSX,
	on,
	onCleanup,
	onMount,
	Show,
} from "solid-js";
import { ThreadIcon } from "../../icons/custom";
import { cx } from "../../utils/cx";
import { createRipple } from "../../utils/ripple";
import { DeveloperModeCard } from "../DeveloperMode/DeveloperModeCard";
import { Drawer, DrawerContent } from "../Drawer/Drawer";
import { DestructiveRow, ListGroup } from "../List/List";
import type { RenderEmoji } from "./ReactionBar";

const defaultRenderEmoji: RenderEmoji = (emoji) => (
	<span class="text-2xl leading-none">{emoji}</span>
);

export type ActionRowProps = {
	label: JSX.Element;
	icon?: JSX.Element;
	onClick?: (event: MouseEvent) => void;
	disabled?: boolean;
	class?: string;
};

export const ActionRow = (props: ActionRowProps) => {
	const ripple = createRipple();
	return (
		<button
			ref={ripple}
			type="button"
			disabled={props.disabled}
			onClick={(event) => props.onClick?.(event)}
			class={cx(
				"ripple flex h-10 w-full shrink-0 cursor-pointer items-center gap-2 px-3 text-left text-foreground outline-none",
				"hover:bg-secondary-highlight focus-ring-inset",
				"disabled:cursor-not-allowed disabled:opacity-50",
				props.class,
			)}
		>
			<Show when={props.icon}>
				<span class="flex size-6 shrink-0 items-center justify-center [&>svg]:size-6">
					{props.icon}
				</span>
			</Show>
			<span class="min-w-0 flex-1 truncate text-sm font-semibold">
				{props.label}
			</span>
		</button>
	);
};

const QuickReaction = (props: {
	label: string;
	onClick: () => void;
	children: JSX.Element;
}) => {
	const ripple = createRipple();
	return (
		<button
			ref={ripple}
			type="button"
			aria-label={props.label}
			onClick={() => props.onClick()}
			class={cx(
				"ripple flex h-12 min-w-0 flex-1 cursor-pointer items-center justify-center rounded-control-lg bg-secondary text-muted-foreground outline-none",
				"hover:bg-secondary-highlight focus-ring-inset",
				"[&>img]:size-6 [&>svg]:size-6",
			)}
		>
			{props.children}
		</button>
	);
};

export type MessageActionsDrawerProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	quickReactions?: string[];
	onReact?: (emoji: string) => void;
	onMoreReactions?: () => void;
	renderEmoji?: RenderEmoji;
	reactLabel?: (emoji: string) => string;
	onEdit?: () => void;
	onReply?: () => void;
	onForward?: () => void;
	onOpenThread?: () => void;
	onSelect?: () => void;
	onCopyText?: () => void;
	hidden?: boolean;
	onHide?: () => void;
	onUnhide?: () => void;
	onDelete?: () => void;
	developer?: MessageDeveloperInfo;
	label?: string;
};

export type MessageDeveloperInfo = {
	atUri: string;
	pdslsHref?: string;
	onCopy?: () => void;
};

export const MessageActionsDrawer = (props: MessageActionsDrawerProps) => {
	let freshInput = false;
	const markFresh = () => {
		freshInput = true;
	};

	createEffect(
		on(
			() => props.open,
			(open) => {
				if (open) freshInput = false;
			},
		),
	);

	onMount(() => {
		window.addEventListener("pointerdown", markFresh, true);
		window.addEventListener("keydown", markFresh, true);
		onCleanup(() => {
			window.removeEventListener("pointerdown", markFresh, true);
			window.removeEventListener("keydown", markFresh, true);
		});
	});

	const handleOpenChange = (next: boolean) => {
		if (!next && !freshInput) return;
		props.onOpenChange(next);
	};

	const run = (handler?: () => void) => () => {
		props.onOpenChange(false);
		handler?.();
	};
	const hasPrimary = () =>
		!!(
			props.onEdit ||
			props.onReply ||
			props.onForward ||
			props.onOpenThread ||
			props.onSelect
		);
	const hasModeration = () =>
		!!(props.hidden ? props.onUnhide : props.onHide) || !!props.onDelete;

	return (
		<Drawer open={props.open} onOpenChange={handleOpenChange}>
			<DrawerContent aria-label={props.label ?? "Message actions"}>
				<Show
					when={
						(props.quickReactions ?? []).length > 0 || props.onMoreReactions
					}
				>
					<div data-quick-reactions="" class="flex items-center gap-2 py-0.5">
						<For each={props.quickReactions ?? []}>
							{(emoji) => (
								<QuickReaction
									label={props.reactLabel?.(emoji) ?? `React with ${emoji}`}
									onClick={run(() => props.onReact?.(emoji))}
								>
									{(props.renderEmoji ?? defaultRenderEmoji)(emoji)}
								</QuickReaction>
							)}
						</For>
						<Show when={props.onMoreReactions}>
							<QuickReaction
								label="More reactions"
								onClick={run(props.onMoreReactions)}
							>
								<SmileCircleIcon />
							</QuickReaction>
						</Show>
					</div>
				</Show>
				<Show when={hasPrimary()}>
					<ListGroup>
						<Show when={props.onEdit}>
							<ActionRow
								icon={<PenIcon />}
								label="Edit message"
								onClick={run(props.onEdit)}
							/>
						</Show>
						<Show when={props.onReply}>
							<ActionRow
								icon={<ReplyIcon />}
								label="Reply"
								onClick={run(props.onReply)}
							/>
						</Show>
						<Show when={props.onForward}>
							<ActionRow
								icon={<ForwardIcon />}
								label="Forward"
								onClick={run(props.onForward)}
							/>
						</Show>
						<Show when={props.onOpenThread}>
							<ActionRow
								icon={<ThreadIcon />}
								label="Open thread"
								onClick={run(props.onOpenThread)}
							/>
						</Show>
						<Show when={props.onSelect}>
							<ActionRow
								icon={<ChecklistIcon />}
								label="Select messages"
								onClick={run(props.onSelect)}
							/>
						</Show>
					</ListGroup>
				</Show>
				<Show when={props.onCopyText}>
					<ListGroup>
						<ActionRow
							icon={<CopyIcon />}
							label="Copy text"
							onClick={run(props.onCopyText)}
						/>
					</ListGroup>
				</Show>
				<Show when={hasModeration()}>
					<ListGroup>
						<Show
							when={props.hidden}
							fallback={
								<Show when={props.onHide}>
									<DestructiveRow
										icon={<ForbiddenCircleIcon />}
										label="Hide message"
										onClick={run(props.onHide)}
									/>
								</Show>
							}
						>
							<Show when={props.onUnhide}>
								<ActionRow
									icon={<EyeIcon />}
									label="Unhide message"
									onClick={run(props.onUnhide)}
								/>
							</Show>
						</Show>
						<Show when={props.onDelete}>
							<DestructiveRow
								icon={<TrashBinTrashIcon />}
								label="Delete message"
								onClick={run(props.onDelete)}
							/>
						</Show>
					</ListGroup>
				</Show>
				<Show when={props.developer}>
					{(developer) => (
						<DeveloperModeCard
							copyLabel="Copy AT-URI"
							copyValue={developer().atUri}
							onCopy={developer().onCopy}
							pdslsHref={developer().pdslsHref}
						/>
					)}
				</Show>
			</DrawerContent>
		</Drawer>
	);
};
