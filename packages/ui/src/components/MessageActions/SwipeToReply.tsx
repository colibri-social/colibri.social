import { ReplyIcon } from "@solar-icons/solid/bold/reply";
import { batch, createSignal, type JSX, onCleanup, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { createSwipe } from "../../utils/gestures/swipe";
import { useHaptics } from "../../utils/haptics";
import { iconEffectClass, playIconEffect } from "../../utils/icon-fx";
import { animateSpring, type SpringHandle, springs } from "../../utils/motion";

export const REPLY_SWIPE_THRESHOLD = 60;
export const MAX_REPLY_DRAG = 88;
const REVEAL_TUCK = 16;

export type SwipeToReplyProps = {
	onReply?: () => void;
	enabled?: boolean;
	threshold?: number;
	maxDrag?: number;
	class?: string;
	surfaceClass?: string;
	children?: JSX.Element;
};

export const SwipeToReply = (props: SwipeToReplyProps) => {
	const haptics = useHaptics();
	const [offset, setOffset] = createSignal(0);
	const [active, setActive] = createSignal(false);
	const threshold = () => props.threshold ?? REPLY_SWIPE_THRESHOLD;
	const maxDrag = () => props.maxDrag ?? MAX_REPLY_DRAG;
	const enabled = () => props.enabled ?? true;
	const progress = () => Math.min(1, Math.abs(offset()) / threshold());
	const exposed = () => Math.max(0, -offset());
	let arrow: HTMLSpanElement | undefined;
	let crossed = false;
	let spring: SpringHandle | undefined;

	onCleanup(() => spring?.stop());

	const settle = () => {
		const from = offset();
		crossed = false;
		spring?.stop();
		spring = animateSpring({
			from,
			to: 0,
			config: springs.toggle,
			onUpdate: (value) => setOffset(Math.min(0, Math.round(value))),
		});
		const handle = spring;
		void handle.finished.then(() => {
			if (spring === handle) setActive(false);
		});
	};

	const move = (dx: number | null) => {
		if (dx === null) {
			settle();
			return;
		}
		spring?.stop();
		const next = Math.min(0, Math.round(Math.max(dx, -maxDrag())));
		batch(() => {
			setActive(true);
			setOffset(next);
		});
		const past = Math.abs(next) >= threshold();
		if (past && !crossed) {
			crossed = true;
			haptics.impact("light");
			if (arrow) void playIconEffect(arrow);
		} else if (!past && crossed) {
			crossed = false;
		}
	};

	return (
		<div
			data-swipe-to-reply=""
			data-swiping={active() || undefined}
			class={cx(
				"relative w-full",
				enabled() && "overflow-x-hidden",
				props.class,
			)}
		>
			<Show when={enabled() && active()}>
				<div
					aria-hidden="true"
					data-swipe-reveal=""
					data-exposed={exposed()}
					class="pointer-events-none absolute inset-y-0 right-0 overflow-hidden bg-primary"
					style={{
						width: `${exposed() > 0 ? exposed() + REVEAL_TUCK : 0}px`,
						visibility: exposed() > 0 ? "visible" : "hidden",
					}}
				>
					<span
						class="absolute top-1/2 text-primary-foreground"
						style={{
							right: `${Math.max(4, Math.abs(offset()) / 2 - 10)}px`,
							opacity: progress(),
							transform: `translateY(-50%) translateX(${(1 - progress()) * 24}px)`,
						}}
					>
						<span
							ref={arrow}
							data-swipe-arrow=""
							data-crossed={progress() >= 1 || undefined}
							class={iconEffectClass("pop")}
						>
							<ReplyIcon class="size-5" />
						</span>
					</span>
				</div>
			</Show>
			<div
				ref={(element) =>
					createSwipe(element, {
						enabled,
						threshold: threshold(),
						onSwipeLeft: () => props.onReply?.(),
						onSwipeMove: move,
					})
				}
				data-swipe-content=""
				class={cx(
					"relative",
					enabled() && "touch-pan-y touch-pinch-zoom",
					active() && (props.surfaceClass ?? "bg-background"),
				)}
				style={{
					transform: offset() !== 0 ? `translateX(${offset()}px)` : undefined,
					"border-radius":
						exposed() > 0
							? `0 ${progress() * 16}px ${progress() * 16}px 0`
							: undefined,
				}}
			>
				{props.children}
			</div>
		</div>
	);
};
