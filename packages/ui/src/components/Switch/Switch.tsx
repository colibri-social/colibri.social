import { Switch as KobalteSwitch } from "@kobalte/core/switch";
import { createSignal, type JSX, Show, splitProps } from "solid-js";
import { cx } from "../../utils/cx";
import { useHaptics } from "../../utils/haptics";
import {
	prefersReducedMotion,
	springs,
	springTransition,
} from "../../utils/motion";
import { createSlot } from "../../utils/slot";

const TRACK_WIDTH = 40;
const TRACK_HEIGHT = 20;
const THUMB_SIZE = 16;
const THUMB_STRETCHED = 21;
const INSET = 2;
const DRAG_THRESHOLD = 3;
const FLICK_VELOCITY = 0.35;

export type SwitchProps = {
	checked?: boolean;
	defaultChecked?: boolean;
	onChange?: (checked: boolean) => void;
	disabled?: boolean;
	label?: JSX.Element;
	description?: JSX.Element;
	name?: string;
	value?: string;
	id?: string;
	class?: string;
	"aria-label"?: string;
};

const clamp = (value: number) => Math.min(1, Math.max(0, value));

export const Switch = (props: SwitchProps) => {
	const [local, rest] = splitProps(props, [
		"checked",
		"defaultChecked",
		"onChange",
		"disabled",
		"label",
		"description",
		"class",
		"aria-label",
	]);
	const haptics = useHaptics();
	const [internal, setInternal] = createSignal(local.defaultChecked ?? false);
	const checked = () => local.checked ?? internal();
	const label = createSlot(() => local.label);
	const description = createSlot(() => local.description);

	const [pressed, setPressed] = createSignal(false);
	const [dragProgress, setDragProgress] = createSignal<number | null>(null);

	const commit = (next: boolean) => {
		if (next === checked()) return;
		setInternal(next);
		local.onChange?.(next);
		haptics.selection();
	};

	const thumbWidth = () => (pressed() ? THUMB_STRETCHED : THUMB_SIZE);
	const travel = () => TRACK_WIDTH - INSET * 2 - thumbWidth();
	const progress = () => dragProgress() ?? (checked() ? 1 : 0);
	const thumbX = () => INSET + progress() * travel();

	let drag:
		| {
				pointerId: number;
				startX: number;
				startProgress: number;
				moved: boolean;
				lastX: number;
				lastTime: number;
				velocity: number;
				crossed: boolean;
		  }
		| undefined;
	let suppressClick = false;

	const onPointerDown: JSX.EventHandler<HTMLDivElement, PointerEvent> = (
		event,
	) => {
		if (local.disabled || event.button !== 0) return;
		if (event.currentTarget.hasPointerCapture?.(event.pointerId) === false) {
			try {
				event.currentTarget.setPointerCapture(event.pointerId);
			} catch {}
		}
		setPressed(true);
		drag = {
			pointerId: event.pointerId,
			startX: event.clientX,
			startProgress: checked() ? 1 : 0,
			moved: false,
			lastX: event.clientX,
			lastTime: event.timeStamp,
			velocity: 0,
			crossed: checked(),
		};
	};

	const onPointerMove: JSX.EventHandler<HTMLDivElement, PointerEvent> = (
		event,
	) => {
		if (!drag || event.pointerId !== drag.pointerId) return;
		const dx = event.clientX - drag.startX;
		if (!drag.moved && Math.abs(dx) < DRAG_THRESHOLD) return;
		drag.moved = true;

		const elapsed = Math.max(1, event.timeStamp - drag.lastTime);
		drag.velocity = (event.clientX - drag.lastX) / elapsed;
		drag.lastX = event.clientX;
		drag.lastTime = event.timeStamp;

		const next = clamp(drag.startProgress + dx / travel());
		setDragProgress(next);

		const past = next > 0.5;
		if (past !== drag.crossed) {
			drag.crossed = past;
			haptics.selection();
		}
	};

	const endDrag = (event: PointerEvent, cancelled: boolean) => {
		if (!drag || event.pointerId !== drag.pointerId) return;
		const { moved, velocity } = drag;
		const current = dragProgress();
		drag = undefined;
		setPressed(false);

		if (!moved || current === null) {
			setDragProgress(null);
			return;
		}

		suppressClick = true;
		setDragProgress(null);
		if (cancelled) return;

		const flicked = Math.abs(velocity) > FLICK_VELOCITY;
		const next = flicked ? velocity > 0 : current > 0.5;
		if (next !== checked()) {
			setInternal(next);
			local.onChange?.(next);
		}
	};

	const onClick = () => {
		if (suppressClick) {
			suppressClick = false;
			return;
		}
		if (local.disabled) return;
		commit(!checked());
	};

	const thumbTransition = () => {
		if (dragProgress() !== null) return "none";
		if (prefersReducedMotion()) return "none";
		return springTransition(["transform", "width"], springs.toggle);
	};

	return (
		<KobalteSwitch
			{...rest}
			checked={checked()}
			onChange={commit}
			disabled={local.disabled}
			class={cx(
				"group/switch inline-flex items-start gap-3 data-disabled:cursor-not-allowed",
				local.class,
			)}
		>
			<KobalteSwitch.Input class="peer" aria-label={local["aria-label"]} />
			<div
				aria-hidden="true"
				data-switch-control=""
				data-pressed={pressed() || undefined}
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={(event) => endDrag(event, false)}
				onPointerCancel={(event) => endDrag(event, true)}
				onLostPointerCapture={(event) => endDrag(event, true)}
				onClick={onClick}
				class={cx(
					"relative shrink-0 cursor-pointer touch-none select-none rounded-full border border-border bg-secondary",
					"transition-[box-shadow,border-color] duration-[calc(var(--duration-color)*var(--motion-scale))]",
					"peer-focus-visible:border-primary peer-focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_25%,transparent)]",
					"group-data-disabled/switch:cursor-not-allowed group-data-disabled/switch:opacity-50",
				)}
				style={{
					width: `${TRACK_WIDTH + 2}px`,
					height: `${TRACK_HEIGHT + 2}px`,
				}}
			>
				<span
					class="absolute inset-0 rounded-full bg-primary"
					style={{
						opacity: progress(),
						transition:
							dragProgress() === null
								? "opacity calc(var(--duration-color) * var(--motion-scale)) var(--ease-out-quick)"
								: "none",
					}}
				/>
				<span
					class="absolute top-[2px] left-0 h-4 rounded-full bg-white shadow-[0_0_4px_rgb(0_0_0/0.25)]"
					style={{
						width: `${thumbWidth()}px`,
						transform: `translateX(${thumbX()}px)`,
						transition: thumbTransition(),
					}}
				/>
			</div>
			<Show when={label.has() || description.has()}>
				<div class="flex min-w-0 flex-col gap-0.5">
					<Show when={label.has()}>
						<KobalteSwitch.Label class="cursor-pointer text-sm font-semibold text-foreground group-data-disabled/switch:cursor-not-allowed">
							{label()}
						</KobalteSwitch.Label>
					</Show>
					<Show when={description.has()}>
						<KobalteSwitch.Description class="text-xs text-muted-foreground">
							{description()}
						</KobalteSwitch.Description>
					</Show>
				</div>
			</Show>
		</KobalteSwitch>
	);
};
