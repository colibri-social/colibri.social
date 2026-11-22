import { useLocale } from "@kobalte/core/i18n";
import { Slider as KobalteSlider } from "@kobalte/core/slider";
import {
	createMemo,
	createSignal,
	For,
	Index,
	type JSX,
	onCleanup,
	Show,
	splitProps,
} from "solid-js";
import { cx } from "../../utils/cx";
import { useHaptics } from "../../utils/haptics";
import { createSlot } from "../../utils/slot";

export type SliderMark = {
	value: number;
	label?: JSX.Element;
};

export type SliderProps = {
	value?: number[];
	defaultValue?: number[];
	snap?: boolean;
	snapZone?: number;
	onChange?: (values: number[]) => void;
	onChangeEnd?: (values: number[]) => void;
	minValue?: number;
	maxValue?: number;
	step?: number;
	minStepsBetweenThumbs?: number;
	label?: JSX.Element;
	description?: JSX.Element;
	showValue?: boolean;
	formatValue?: (value: number) => string;
	marks?: SliderMark[];
	fill?: boolean;
	trackClass?: string;
	trackStyle?: JSX.CSSProperties;
	thumbStyle?: (value: number, index: number) => JSX.CSSProperties;
	thumbLabels?: string[];
	disabled?: boolean;
	name?: string;
	id?: string;
	class?: string;
	"aria-label"?: string;
};

const DEFAULT_MIN = 0;
const DEFAULT_MAX = 100;
const DEFAULT_SNAP_ZONE = 0.03;
const DOUBLE_PRESS_GAP_MS = 300;
const TAP_MAX_MS = 350;
const TAP_MOVE_TOLERANCE = 6;
const DOUBLE_PRESS_SLOP = 32;

type Press = {
	index: number;
	x: number;
	y: number;
	at: number;
	moved: boolean;
};
type Tap = { index: number; x: number; y: number; at: number };

const HOVER_STEP_KEYS = new Set([
	"ArrowLeft",
	"ArrowRight",
	"ArrowUp",
	"ArrowDown",
	"Home",
	"End",
	"PageUp",
	"PageDown",
]);
const NON_TEXT_INPUT_TYPES = new Set([
	"button",
	"checkbox",
	"color",
	"file",
	"hidden",
	"image",
	"radio",
	"range",
	"reset",
	"submit",
]);

let hoveredSlider: symbol | undefined;

const isEditing = (element: Element | null) => {
	if (!(element instanceof HTMLElement)) return false;
	if (element.isContentEditable) return true;
	if (element instanceof HTMLInputElement) {
		return !NON_TEXT_INPUT_TYPES.has(element.type);
	}

	return (
		element instanceof HTMLTextAreaElement ||
		element instanceof HTMLSelectElement
	);
};

const ownsArrowKeys = (element: Element | null) => {
	return Boolean(element?.closest('[role="slider"], input[type="range"]'));
};

const snapToStep = (value: number, min: number, max: number, step: number) => {
	const remainder = (value - min) % step;
	let snapped =
		Math.abs(remainder) * 2 >= step
			? value + Math.sign(remainder) * (step - Math.abs(remainder))
			: value - remainder;

	if (snapped < min) snapped = min;
	else if (snapped > max) snapped = min + Math.floor((max - min) / step) * step;

	const text = step.toString();
	const dot = text.indexOf(".");
	const precision = dot >= 0 ? text.length - dot : 0;
	if (precision === 0) return snapped;

	const scale = 10 ** precision;

	return Math.round(snapped * scale) / scale;
};

const motion =
	"duration-[calc(120ms*var(--motion-scale))] ease-(--ease-out-quick) motion-reduce:transition-none reduced-motion:transition-none";

export const Slider = (props: SliderProps) => {
	const [local, rest] = splitProps(props, [
		"value",
		"defaultValue",
		"snap",
		"snapZone",
		"onChange",
		"onChangeEnd",
		"label",
		"description",
		"showValue",
		"formatValue",
		"marks",
		"fill",
		"trackClass",
		"trackStyle",
		"thumbStyle",
		"thumbLabels",
		"disabled",
		"class",
		"aria-label",
		"name",
	]);
	const haptics = useHaptics();
	const label = createSlot(() => local.label);
	const description = createSlot(() => local.description);

	const min = () => rest.minValue ?? DEFAULT_MIN;
	const max = () => rest.maxValue ?? DEFAULT_MAX;
	const [internal, setInternal] = createSignal<number[]>(
		local.value ?? local.defaultValue ?? [min()],
	);
	const values = () => local.value ?? internal();
	const format = (value: number) =>
		local.formatValue ? local.formatValue(value) : String(value);
	const valueText = () => values().map(format).join(" to ");
	const percent = (value: number) => {
		const span = max() - min();
		return span > 0 ? ((value - min()) / span) * 100 : 0;
	};

	const resetTarget = (index: number) => local.defaultValue?.[index];

	const resetThumb = (index: number) => {
		const target = resetTarget(index);
		if (target === undefined) return;
		const current = values();
		if (current[index] === target) return;
		const next = current.slice();
		next[index] = target;
		setInternal(next);
		local.onChange?.(next);
		local.onChangeEnd?.(next);
		haptics.selection();
	};

	let press: Press | undefined;
	let lastTap: Tap | undefined;

	const onWindowPointerMove = (event: PointerEvent) => {
		if (!press || press.moved) return;
		if (
			Math.hypot(event.clientX - press.x, event.clientY - press.y) >
			TAP_MOVE_TOLERANCE
		) {
			press.moved = true;
		}
	};

	const settlePress = (event: PointerEvent) => {
		const current = press;
		press = undefined;
		if (!current || event.type === "pointercancel") {
			lastTap = undefined;
			return;
		}
		const now = performance.now();
		if (current.moved || now - current.at > TAP_MAX_MS) {
			lastTap = undefined;
			return;
		}
		const previous = lastTap;
		if (
			previous &&
			previous.index === current.index &&
			current.at - previous.at <= DOUBLE_PRESS_GAP_MS &&
			Math.hypot(current.x - previous.x, current.y - previous.y) <=
				DOUBLE_PRESS_SLOP
		) {
			lastTap = undefined;
			resetThumb(current.index);
			return;
		}
		lastTap = { index: current.index, x: current.x, y: current.y, at: now };
	};

	const [dragging, setDragging] = createSignal(false);
	const stopDragging = (event?: PointerEvent) => {
		setDragging(false);
		window.removeEventListener("pointerup", stopDragging, true);
		window.removeEventListener("pointercancel", stopDragging, true);
		window.removeEventListener("pointermove", onWindowPointerMove, true);
		if (event) settlePress(event);
	};
	const startDragging = () => {
		if (local.disabled) return;
		setDragging(true);
		window.addEventListener("pointerup", stopDragging, true);
		window.addEventListener("pointercancel", stopDragging, true);
		window.addEventListener("pointermove", onWindowPointerMove, true);
	};
	const onThumbPointerDown = (event: PointerEvent, index: number) => {
		if (local.disabled) return;
		press = {
			index,
			x: event.clientX,
			y: event.clientY,
			at: performance.now(),
			moved: false,
		};
		startDragging();
	};
	onCleanup(() => stopDragging());

	const snap = (next: number[]) => {
		if (local.snap === false) return next;
		const zone =
			(local.snapZone ?? DEFAULT_SNAP_ZONE) * Math.max(0, max() - min());
		if (zone <= 0) return next;
		return next.map((value, index) => {
			const target = resetTarget(index);
			if (target === undefined) return value;
			return Math.abs(value - target) <= zone ? target : value;
		});
	};

	const markValues = createMemo(() =>
		(local.marks ?? []).map((mark) => mark.value),
	);
	const crossedMark = (previous: number[], next: number[]) =>
		next.some((value, index) => {
			const before = previous[index];
			if (before === undefined || before === value) return false;
			return markValues().some((mark) =>
				value > before
					? mark > before && mark <= value
					: mark < before && mark >= value,
			);
		});
	const markActive = (mark: number) => {
		const current = values();
		if (current.length > 1)
			return mark >= current[0] && mark <= current[current.length - 1];
		return mark <= current[0];
	};
	const labelShift = (mark: number) => {
		const position = percent(mark);
		if (position <= 0) return "0%";
		if (position >= 100) return "-100%";
		return "-50%";
	};
	const hitEdge = (previous: number[], next: number[]) =>
		next.some(
			(value, index) =>
				previous[index] !== value && (value === min() || value === max()),
		);

	const snappedInto = (previous: number[], next: number[]) =>
		next.some((value, index) => {
			const target = resetTarget(index);
			return (
				target !== undefined && value === target && previous[index] !== target
			);
		});

	const onChange = (raw: number[]) => {
		const previous = values();
		const next = dragging() ? snap(raw) : raw;
		if (next.every((value, index) => value === previous[index])) return;
		setInternal(next);
		local.onChange?.(next);
		if (
			crossedMark(previous, next) ||
			hitEdge(previous, next) ||
			(dragging() && snappedInto(previous, next))
		) {
			haptics.selection();
		}
	};

	const locale = useLocale();
	const hoverToken = Symbol();
	let root: HTMLElement | undefined;
	let pointerX: number | undefined;
	let hoverDirty = false;

	const step = () => rest.step ?? 1;
	const thumbGap = () => (rest.minStepsBetweenThumbs ?? 0) * step();
	const pageSize = () => {
		const raw = (max() - min()) / 10;

		return Math.max(snapToStep(raw, 0, raw + step(), step()), step());
	};
	const thumbMin = (current: number[], index: number) => {
		return index === 0 ? min() : current[index - 1] + thumbGap();
	};
	const thumbMax = (current: number[], index: number) => {
		return index === current.length - 1
			? max()
			: current[index + 1] - thumbGap();
	};

	const hoveredThumb = () => {
		const thumbs = root?.querySelectorAll<HTMLElement>("[data-slider-thumb]");
		if (!thumbs || thumbs.length < 2 || pointerX === undefined) return 0;

		let nearest = 0;
		let nearestDistance = Number.POSITIVE_INFINITY;
		thumbs.forEach((thumb, index) => {
			const rect = thumb.getBoundingClientRect();
			const distance = Math.abs(rect.left + rect.width / 2 - (pointerX ?? 0));
			if (distance < nearestDistance) {
				nearest = index;
				nearestDistance = distance;
			}
		});

		return nearest;
	};

	const steppedValue = (key: string, shift: boolean, index: number) => {
		const current = values();
		const value = current[index];
		if (value === undefined) return undefined;

		const lower = thumbMin(current, index);
		const upper = thumbMax(current, index);
		const arrow = shift ? pageSize() : step();
		const forward = locale.direction() === "rtl" ? -arrow : arrow;
		const deltas: Record<string, number> = {
			ArrowLeft: -forward,
			ArrowDown: -forward,
			ArrowRight: forward,
			ArrowUp: forward,
			PageUp: pageSize(),
			PageDown: -pageSize(),
		};

		let target: number;
		if (key === "Home") target = lower;
		else if (key === "End") target = upper;
		else target = snapToStep(value + (deltas[key] ?? 0), min(), max(), step());

		const next = current.slice();
		next[index] = snapToStep(target, lower, upper, step());

		return next;
	};

	const onHoverKeyDown = (event: KeyboardEvent) => {
		if (hoveredSlider !== hoverToken || local.disabled) return;
		if (event.defaultPrevented || event.isComposing) return;
		if (event.ctrlKey || event.altKey || event.metaKey) return;
		if (!HOVER_STEP_KEYS.has(event.key)) return;

		const active = document.activeElement;
		if (isEditing(active) || ownsArrowKeys(active)) return;

		event.preventDefault();
		event.stopPropagation();

		const previous = values();
		const next = steppedValue(event.key, event.shiftKey, hoveredThumb());
		if (!next || next.every((value, index) => value === previous[index])) {
			return;
		}

		hoverDirty = true;
		onChange(next);
	};

	const endHover = () => {
		if (hoveredSlider === hoverToken) hoveredSlider = undefined;
		window.removeEventListener("keydown", onHoverKeyDown, true);
		if (!hoverDirty) return;

		hoverDirty = false;
		local.onChangeEnd?.(values());
	};
	const startHover = (event: PointerEvent) => {
		if (event.pointerType === "touch") return;

		pointerX = event.clientX;
		hoveredSlider = hoverToken;
		window.addEventListener("keydown", onHoverKeyDown, true);
	};
	onCleanup(endHover);

	return (
		<KobalteSlider
			{...rest}
			ref={(element: HTMLElement) => {
				root = element;
			}}
			onPointerEnter={startHover}
			onPointerMove={(event: PointerEvent) => {
				pointerX = event.clientX;
			}}
			onPointerLeave={endHover}
			value={values()}
			onChange={onChange}
			onChangeEnd={(next) => local.onChangeEnd?.(next)}
			getValueLabel={() => valueText()}
			disabled={local.disabled}
			aria-label={local["aria-label"]}
			data-dragging={dragging() || undefined}
			class={cx(
				"group/slider relative flex w-full touch-none flex-col gap-2 select-none",
				"data-disabled:cursor-not-allowed data-disabled:opacity-50",
				local.class,
			)}
		>
			<Show when={label.has() || local.showValue}>
				<div class="flex min-h-5 items-center justify-between gap-3">
					<Show when={label.has()}>
						<KobalteSlider.Label class="min-w-0 truncate text-sm font-semibold text-foreground">
							{label()}
						</KobalteSlider.Label>
					</Show>
					<Show when={local.showValue}>
						<KobalteSlider.ValueLabel class="ml-auto shrink-0 text-sm font-semibold text-muted-foreground tabular-nums" />
					</Show>
				</div>
			</Show>
			<KobalteSlider.Track
				onPointerDown={startDragging}
				class="relative h-6 w-full cursor-pointer group-data-disabled/slider:cursor-not-allowed"
			>
				<div
					data-slider-rail=""
					class={cx(
						"pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-accent",
						local.trackClass,
					)}
					style={local.trackStyle}
				>
					<Show when={local.fill !== false}>
						<KobalteSlider.Fill
							data-slider-fill=""
							class="absolute inset-y-0 rounded-full bg-primary"
						/>
					</Show>
				</div>
				<For each={local.marks ?? []}>
					{(mark) => (
						<span
							aria-hidden="true"
							data-slider-mark=""
							data-active={markActive(mark.value) || undefined}
							class={cx(
								"pointer-events-none absolute top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-foreground",
								local.fill !== false && "data-active:bg-white/70",
							)}
							style={{ left: `${percent(mark.value)}%` }}
						/>
					)}
				</For>
				<Index each={values()}>
					{(value, index) => (
						<KobalteSlider.Thumb
							onPointerDown={(event: PointerEvent) =>
								onThumbPointerDown(event, index)
							}
							aria-valuetext={format(value())}
							aria-label={local.thumbLabels?.[index] ?? local["aria-label"]}
							data-slider-thumb=""
							class={cx(
								"top-1/2 block size-4 -translate-y-1/2 cursor-grab rounded-full bg-white shadow-[0_0_4px_rgb(0_0_0/0.35)]",
								"transition-[scale,box-shadow]",
								motion,
								"group-data-dragging/slider:cursor-grabbing group-data-dragging/slider:scale-125",
								"focus-ring",
								"group-data-disabled/slider:cursor-not-allowed",
							)}
							style={local.thumbStyle?.(value(), index)}
						></KobalteSlider.Thumb>
					)}
				</Index>
			</KobalteSlider.Track>
			<Show when={local.marks?.some((mark) => mark.label !== undefined)}>
				<div aria-hidden="true" class="relative h-4">
					<For each={local.marks ?? []}>
						{(mark) => (
							<Show when={mark.label !== undefined}>
								<span
									class="absolute top-0 text-xs font-semibold whitespace-nowrap text-muted-foreground tabular-nums"
									style={{
										left: `${percent(mark.value)}%`,
										transform: `translateX(${labelShift(mark.value)})`,
									}}
								>
									{mark.label}
								</span>
							</Show>
						)}
					</For>
				</div>
			</Show>
			<Show when={local.name}>
				{(name) => (
					<Index each={values()}>
						{(value) => <input type="hidden" name={name()} value={value()} />}
					</Index>
				)}
			</Show>
			<Show when={description.has()}>
				<KobalteSlider.Description class="text-xs text-muted-foreground">
					{description()}
				</KobalteSlider.Description>
			</Show>
		</KobalteSlider>
	);
};
