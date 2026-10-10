import { createSignal, For, type JSX, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { useHaptics } from "../../utils/haptics";
import { formatClock } from "./format";

export type ScrubberTone = "surface" | "overlay";

export type ScrubberProps = {
	value: number;
	max: number;
	label: string;
	buffered?: [number, number][];
	onSeek?: (time: number) => void;
	onSeekStart?: () => void;
	onSeekEnd?: (time: number) => void;
	formatTime?: (time: number) => string;
	valueText?: (value: number, max: number) => string;
	step?: number;
	tone?: ScrubberTone;
	disabled?: boolean;
	class?: string;
};

const clamp = (value: number, min: number, max: number) =>
	Math.min(max, Math.max(min, value));

const toneClasses: Record<
	ScrubberTone,
	{ track: string; buffered: string; fill: string; thumb: string; tip: string }
> = {
	surface: {
		track: "bg-foreground/15",
		buffered: "bg-foreground/25",
		fill: "bg-foreground",
		thumb: "bg-foreground",
		tip: "bg-popover text-foreground border border-border",
	},
	overlay: {
		track: "bg-white/25",
		buffered: "bg-white/40",
		fill: "bg-white",
		thumb: "bg-white",
		tip: "bg-black/80 text-white",
	},
};

const motionClass =
	"duration-[calc(120ms*var(--motion-scale))] ease-out motion-reduce:transition-none reduced-motion:transition-none";

export const Scrubber = (props: ScrubberProps) => {
	const haptics = useHaptics();
	const [dragging, setDragging] = createSignal(false);
	const [dragValue, setDragValue] = createSignal(0);
	const [hover, setHover] = createSignal<{ x: number; time: number }>();
	let track: HTMLDivElement | undefined;
	let atEdge: "start" | "end" | undefined;

	const max = () => (Number.isFinite(props.max) ? Math.max(props.max, 0) : 0);
	const current = () => clamp(dragging() ? dragValue() : props.value, 0, max());
	const percent = (time: number) => (max() > 0 ? (time / max()) * 100 : 0);
	const format = (time: number) => (props.formatTime ?? formatClock)(time);
	const tone = () => toneClasses[props.tone ?? "surface"];
	const valueText = () =>
		props.valueText
			? props.valueText(current(), max())
			: `${format(current())} of ${format(max())}`;

	const timeAt = (clientX: number) => {
		const rect = track?.getBoundingClientRect();
		if (!rect || rect.width === 0) return 0;
		return clamp((clientX - rect.left) / rect.width, 0, 1) * max();
	};

	const tickEdge = (time: number, pointerType: string) => {
		const edge = time <= 0 ? "start" : time >= max() ? "end" : undefined;
		if (edge && edge !== atEdge && pointerType !== "mouse") haptics.selection();
		atEdge = edge;
	};

	const onPointerDown: JSX.EventHandler<HTMLDivElement, PointerEvent> = (
		event,
	) => {
		if (props.disabled || max() <= 0) return;
		if (event.pointerType === "mouse" && event.button !== 0) return;
		event.preventDefault();
		event.stopPropagation();
		try {
			event.currentTarget.setPointerCapture(event.pointerId);
		} catch {}
		event.currentTarget.focus({ preventScroll: true });
		const time = timeAt(event.clientX);
		atEdge = undefined;
		setDragValue(time);
		setDragging(true);
		props.onSeekStart?.();
		props.onSeek?.(time);
		tickEdge(time, event.pointerType);
	};

	const onPointerMove: JSX.EventHandler<HTMLDivElement, PointerEvent> = (
		event,
	) => {
		if (event.pointerType === "mouse") {
			const rect = track?.getBoundingClientRect();
			if (rect)
				setHover({
					x: clamp(event.clientX - rect.left, 0, rect.width),
					time: timeAt(event.clientX),
				});
		}
		if (!dragging()) return;
		event.stopPropagation();
		const time = timeAt(event.clientX);
		setDragValue(time);
		props.onSeek?.(time);
		tickEdge(time, event.pointerType);
	};

	const finish = (event: PointerEvent) => {
		if (!dragging()) return;
		event.stopPropagation();
		const time = dragValue();
		setDragging(false);
		props.onSeekEnd?.(time);
	};

	const seekTo = (time: number) => {
		const next = clamp(time, 0, max());
		props.onSeek?.(next);
		props.onSeekEnd?.(next);
	};

	const onKeyDown: JSX.EventHandler<HTMLDivElement, KeyboardEvent> = (
		event,
	) => {
		if (props.disabled || max() <= 0) return;
		const step = props.step ?? 5;
		const page = max() * 0.1;
		const moves: Record<string, number> = {
			ArrowRight: props.value + step,
			ArrowUp: props.value + step,
			ArrowLeft: props.value - step,
			ArrowDown: props.value - step,
			PageUp: props.value + page,
			PageDown: props.value - page,
			Home: 0,
			End: max(),
		};
		const target = moves[event.key];
		if (target === undefined) return;
		event.preventDefault();
		event.stopPropagation();
		seekTo(target);
	};

	const active = () => dragging() || hover() !== undefined;

	return (
		<div
			role="slider"
			tabIndex={0}
			aria-label={props.label}
			aria-valuemin={0}
			aria-valuemax={Math.round(max())}
			aria-valuenow={Math.round(current())}
			aria-valuetext={valueText()}
			aria-disabled={props.disabled || undefined}
			data-scrubber=""
			data-dragging={dragging() || undefined}
			data-active={active() || undefined}
			class={cx(
				"group/scrubber relative flex h-6 min-w-0 cursor-pointer touch-none items-center outline-none select-none",
				"focus-visible:rounded-control-xs focus-ring",
				props.disabled && "cursor-not-allowed opacity-50",
				props.class,
			)}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={finish}
			onPointerCancel={finish}
			onPointerLeave={() => setHover(undefined)}
			onKeyDown={onKeyDown}
		>
			<div
				ref={track}
				data-scrubber-track=""
				class={cx(
					"relative h-[3px] w-full rounded-full transition-[height]",
					motionClass,
					tone().track,
					"group-data-[active]/scrubber:h-[5px] group-focus-visible/scrubber:h-[5px]",
				)}
			>
				<For each={props.buffered ?? []}>
					{(range) => (
						<span
							aria-hidden="true"
							data-scrubber-buffered=""
							class={cx("absolute inset-y-0 rounded-full", tone().buffered)}
							style={{
								left: `${percent(range[0])}%`,
								width: `${Math.max(0, percent(range[1]) - percent(range[0]))}%`,
							}}
						/>
					)}
				</For>
				<span
					aria-hidden="true"
					data-scrubber-fill=""
					class={cx("absolute inset-y-0 left-0 rounded-full", tone().fill)}
					style={{ width: `${percent(current())}%` }}
				/>
				<span
					aria-hidden="true"
					data-scrubber-thumb=""
					class={cx(
						"absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 scale-0 rounded-full shadow-[0_1px_3px_rgb(0_0_0/0.4)] transition-transform",
						motionClass,
						tone().thumb,
						"group-data-[active]/scrubber:scale-100 group-focus-visible/scrubber:scale-100",
					)}
					style={{ left: `${percent(current())}%` }}
				/>
			</div>
			<Show when={hover()}>
				{(point) => (
					<span
						aria-hidden="true"
						data-scrubber-tip=""
						class={cx(
							"pointer-events-none absolute bottom-full mb-1.5 -translate-x-1/2 rounded-control-xs px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap tabular-nums",
							tone().tip,
						)}
						style={{ left: `${point().x}px` }}
					>
						{format(point().time)}
					</span>
				)}
			</Show>
		</div>
	);
};
