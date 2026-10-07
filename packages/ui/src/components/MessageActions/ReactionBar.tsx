import { SmileCircleIcon } from "@solar-icons/solid/bold/smile-circle";
import {
	createEffect,
	createMemo,
	For,
	type JSX,
	on,
	Show,
	splitProps,
} from "solid-js";
import { cx } from "../../utils/cx";
import { createLongPress } from "../../utils/gestures/long-press";
import { iconEffectClass } from "../../utils/icon-fx";
import { playKeyframes } from "../../utils/motion";
import { createRipple } from "../../utils/ripple";
import { Emoji } from "../Emoji/Emoji";
import { Tooltip, TooltipContent, TooltipTrigger } from "./Tooltip";

export type Reaction = {
	emoji: string;
	count: number;
	mine?: boolean;
	reactors?: string[];
	label?: string;
};

export type RenderEmoji = (emoji: string) => JSX.Element;

const defaultRenderEmoji: RenderEmoji = (emoji) => (
	<Emoji emoji={emoji} class="size-4 text-base [&]:m-0" />
);

const EMOJI_POP: Keyframe[] = [
	{ transform: "scale(1)" },
	{ transform: "scale(1.3)", offset: 0.35 },
	{ transform: "scale(0.94)", offset: 0.7 },
	{ transform: "scale(1)" },
];

const reactedBy = (reactors: string[], count: number) => {
	if (reactors.length === 0) return `${count} reacted`;
	const shown = reactors.slice(0, 3);
	const others = count - shown.length;
	if (others > 0)
		return `${shown.join(", ")} and ${others} ${others === 1 ? "other" : "others"} reacted`;
	if (shown.length === 1) return `${shown[0]} reacted`;
	return `${shown.slice(0, -1).join(", ")} and ${shown.at(-1)} reacted`;
};

export type ReactionChipProps = Reaction & {
	onToggle?: (emoji: string, mine: boolean) => void;
	onShowReactors?: (emoji: string) => void;
	renderEmoji?: RenderEmoji;
	disabled?: boolean;
	class?: string;
};

export const ReactionChip = (props: ReactionChipProps) => {
	const ripple = createRipple();
	let emojiElement: HTMLSpanElement | undefined;
	let countElement: HTMLSpanElement | undefined;
	const mine = createMemo(() => !!props.mine);
	const count = createMemo(() => props.count);

	createEffect(
		on(
			mine,
			() =>
				playKeyframes(emojiElement, EMOJI_POP, {
					duration: 360,
					easing: "cubic-bezier(0.2, 0, 0, 1)",
				}),
			{ defer: true },
		),
	);

	createEffect(
		on(
			count,
			(count, previous) => {
				if (previous === undefined) return;
				const direction = count > previous ? 1 : -1;
				playKeyframes(
					countElement,
					[
						{ transform: `translateY(${direction * 60}%)`, opacity: 0 },
						{ transform: "translateY(0)", opacity: 1 },
					],
					{ duration: 200, easing: "cubic-bezier(0.2, 0, 0, 1)" },
				);
			},
			{ defer: true },
		),
	);

	const attach = (element: HTMLButtonElement) => {
		ripple(element);
		createLongPress(element, {
			enabled: () => !!props.onShowReactors && !props.disabled,
			onLongPress: () => props.onShowReactors?.(props.emoji),
		});
	};

	return (
		<Tooltip disabled={props.disabled}>
			<TooltipTrigger
				as="button"
				ref={attach}
				type="button"
				data-reaction={props.emoji}
				data-mine={props.mine || undefined}
				aria-pressed={!!props.mine}
				aria-label={`${props.label ?? props.emoji} ${props.count}`}
				disabled={props.disabled}
				onClick={() => props.onToggle?.(props.emoji, !!props.mine)}
				class={cx(
					"ripple inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-control-sm border px-2 outline-none",
					"focus-visible:shadow-[0_0_0_2px_var(--primary)] disabled:cursor-not-allowed disabled:opacity-50",
					props.mine
						? "border-primary bg-[color-mix(in_srgb,var(--primary)_18%,transparent)] text-[color-mix(in_srgb,var(--primary)_35%,var(--foreground))] hover:bg-[color-mix(in_srgb,var(--primary)_26%,transparent)]"
						: "border-border bg-popover text-muted-foreground hover:bg-popover-highlight",
					props.class,
				)}
			>
				<span
					ref={emojiElement}
					aria-hidden="true"
					class="flex size-4 items-center justify-center [&>img]:size-4"
				>
					{(props.renderEmoji ?? defaultRenderEmoji)(props.emoji)}
				</span>
				<span
					aria-hidden="true"
					class="relative overflow-hidden text-sm font-semibold tabular-nums"
				>
					<span ref={countElement} class="block">
						{props.count}
					</span>
				</span>
			</TooltipTrigger>
			<TooltipContent>
				{reactedBy(props.reactors ?? [], props.count)}
			</TooltipContent>
		</Tooltip>
	);
};

export type AddReactionButtonProps = {
	label?: string;
	onClick?: (event: MouseEvent) => void;
	disabled?: boolean;
	class?: string;
};

export const AddReactionButton = (props: AddReactionButtonProps) => {
	const ripple = createRipple();
	return (
		<button
			ref={ripple}
			type="button"
			data-icon-host=""
			aria-label={props.label ?? "Add reaction"}
			title={props.label ?? "Add reaction"}
			disabled={props.disabled}
			onClick={(event) => props.onClick?.(event)}
			class={cx(
				"ripple inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-control-sm border border-border bg-popover text-muted-foreground outline-none",
				"hover:bg-popover-highlight hover:text-foreground focus-visible:shadow-[0_0_0_2px_var(--primary)]",
				"disabled:cursor-not-allowed disabled:opacity-50",
				props.class,
			)}
		>
			<span class={iconEffectClass("wiggle", "press")}>
				<SmileCircleIcon class="size-4" />
			</span>
		</button>
	);
};

export type ReactionBarProps = {
	reactions: Reaction[];
	onToggle?: (emoji: string, mine: boolean) => void;
	onAdd?: (event: MouseEvent) => void;
	onShowReactors?: (emoji: string) => void;
	renderEmoji?: RenderEmoji;
	addLabel?: string;
	disabled?: boolean;
	class?: string;
};

export const ReactionBar = (props: ReactionBarProps) => {
	const [local, rest] = splitProps(props, ["class", "reactions"]);
	return (
		<div
			data-reaction-bar=""
			class={cx("flex flex-wrap items-center gap-1", local.class)}
		>
			<For each={local.reactions.map((reaction) => reaction.emoji)}>
				{(emoji) => {
					const reaction = () =>
						local.reactions.find((item) => item.emoji === emoji);
					return (
						<ReactionChip
							emoji={emoji}
							count={reaction()?.count ?? 0}
							mine={reaction()?.mine}
							reactors={reaction()?.reactors}
							label={reaction()?.label}
							onToggle={rest.onToggle}
							onShowReactors={rest.onShowReactors}
							renderEmoji={rest.renderEmoji}
							disabled={rest.disabled}
						/>
					);
				}}
			</For>
			<Show when={!rest.disabled}>
				<AddReactionButton label={rest.addLabel} onClick={rest.onAdd} />
			</Show>
		</div>
	);
};
