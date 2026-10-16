import { createEffect, on } from "solid-js";
import { cx } from "../../utils/cx";
import { motionScale, playKeyframes } from "../../utils/motion";
import { Button } from "../Button/Button";

export type UnsavedChangesBarPlatform = "mobile" | "desktop";

export type UnsavedChangesBarProps = {
	visible: boolean;
	saving?: boolean;
	saveDisabled?: boolean;
	attention?: number;
	platform?: UnsavedChangesBarPlatform;
	saveLabel?: string;
	onCancel: () => void;
	onSave: () => void;
	class?: string;
};

export const UNSAVED_CHANGES_TEXT = "You have unsaved changes";

const SHAKE_MS = 420;
const FLASH_MS = 720;

const shakeKeyframes: Keyframe[] = [
	{ transform: "translateX(0)" },
	{ transform: "translateX(-8px)", offset: 0.15 },
	{ transform: "translateX(7px)", offset: 0.3 },
	{ transform: "translateX(-5px)", offset: 0.45 },
	{ transform: "translateX(4px)", offset: 0.6 },
	{ transform: "translateX(-2px)", offset: 0.75 },
	{ transform: "translateX(0)" },
];

const flash = (card: HTMLElement | undefined) => {
	if (!card?.animate) return;
	const tone = getComputedStyle(card).getPropertyValue("--destructive").trim();
	if (!tone) return;
	const lit = { borderColor: tone, boxShadow: `0 0 0 2px ${tone}` };
	const rest = { boxShadow: "0 0 0 0 transparent" };
	card.animate([rest, lit, rest, lit, rest], {
		duration: FLASH_MS * motionScale(),
		easing: "ease-out",
	});
};

const motion =
	"transition-[opacity,translate] ease-out motion-reduce:transition-none reduced-motion:transition-none data-[visible]:duration-200 not-data-[visible]:duration-150";

export const UnsavedChangesBar = (props: UnsavedChangesBarProps) => {
	const mobile = () => props.platform === "mobile";
	let shaker: HTMLDivElement | undefined;
	let card: HTMLDivElement | undefined;

	createEffect(
		on(
			() => props.attention ?? 0,
			(count, previous) => {
				if (!count || count === previous || !props.visible) return;
				playKeyframes(shaker, shakeKeyframes, {
					duration: SHAKE_MS,
					easing: "ease-out",
				});
				flash(card);
			},
			{ defer: true },
		),
	);

	const buttonSize = () =>
		mobile() ? "h-11 rounded-control-lg px-4" : "h-8 rounded-control-sm px-3";

	return (
		<div
			data-unsaved-changes-slot=""
			class={cx(
				"pointer-events-none sticky z-10 mt-auto flex shrink-0 justify-center",
				mobile() ? "bottom-safe-offset-4" : "bottom-4",
				props.class,
			)}
		>
			<div
				ref={shaker}
				data-unsaved-changes-bar=""
				data-visible={props.visible || undefined}
				data-attention={(props.attention ?? 0) > 0 || undefined}
				inert={!props.visible || undefined}
				aria-hidden={!props.visible || undefined}
				class={cx(
					"flex w-full min-w-0 justify-center",
					motion,
					props.visible ? "opacity-100" : "translate-y-1 opacity-0",
				)}
			>
				<div
					ref={card}
					class={cx(
						"pointer-events-auto flex max-w-md min-w-0 items-center gap-2 border bg-popover p-1 pl-3.5 text-foreground shadow-overlay",
						mobile() ? "w-full rounded-sheet" : "rounded-surface",
						(props.attention ?? 0) > 0 ? "border-destructive" : "border-border",
					)}
				>
					<p
						role="status"
						class="m-0 mr-1 min-w-0 flex-1 truncate text-sm font-semibold"
					>
						{props.visible ? UNSAVED_CHANGES_TEXT : ""}
					</p>
					<Button
						variant="secondary"
						class={buttonSize()}
						disabled={props.saving}
						onClick={() => props.onCancel()}
					>
						Cancel
					</Button>
					<Button
						class={buttonSize()}
						loading={props.saving}
						disabled={props.saveDisabled}
						onClick={() => props.onSave()}
					>
						{props.saveLabel ?? "Save"}
					</Button>
				</div>
			</div>
		</div>
	);
};
