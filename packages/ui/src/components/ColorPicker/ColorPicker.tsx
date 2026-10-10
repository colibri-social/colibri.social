import { Popover as KobaltePopover } from "@kobalte/core/popover";
import { AddIcon } from "@solar-icons/solid/bold/add";
import { PipetteIcon } from "@solar-icons/solid/bold/pipette";
import { TrashBinTrashIcon } from "@solar-icons/solid/bold/trash-bin-trash";
import {
	createEffect,
	createSignal,
	For,
	type JSX,
	on,
	Show,
	splitProps,
} from "solid-js";
import { cx } from "../../utils/cx";
import { useHaptics } from "../../utils/haptics";
import { createRipple } from "../../utils/ripple";
import { Drawer, DrawerContent } from "../Drawer/Drawer";
import { Popover, PopoverContent } from "../Popover/Popover";
import { Slider } from "../Slider/Slider";
import { TextField } from "../TextField/TextField";
import {
	DEFAULT_SWATCHES,
	type Hsv,
	hexToHsv,
	hsvToHex,
	isLightColor,
	normalizeHex,
} from "./color";

export { DEFAULT_SWATCHES, isLightColor, normalizeHex } from "./color";

const AREA_STEP = 0.01;
const AREA_PAGE_STEP = 0.1;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const focusRing = "focus-ring";

export type ColorPickerPanelProps = {
	value: string;
	onChange: (hex: string) => void;
	onChangeEnd?: (hex: string) => void;
	presets?: string[];
	class?: string;
};

export const ColorPickerPanel = (props: ColorPickerPanelProps) => {
	const haptics = useHaptics();
	const initial = () => normalizeHex(props.value) ?? "#000000";
	const [hsv, setHsv] = createSignal<Hsv>(hexToHsv(initial()));
	const hex = () => hsvToHex(hsv());
	const [draft, setDraft] = createSignal(initial().slice(1));
	const [draftInvalid, setDraftInvalid] = createSignal(false);
	const [editingHex, setEditingHex] = createSignal(false);

	createEffect(
		on(
			() => normalizeHex(props.value),
			(next) => {
				if (!next || next === hex()) return;
				const parsed = hexToHsv(next);
				const keepHue = parsed.s === 0 || parsed.v === 0;
				setHsv({ ...parsed, h: keepHue ? hsv().h : parsed.h });
				if (!editingHex()) {
					setDraft(next.slice(1));
					setDraftInvalid(false);
				}
			},
			{ defer: true },
		),
	);

	const commit = (next: Hsv) => {
		setHsv(next);
		const nextHex = hsvToHex(next);
		if (!editingHex()) {
			setDraft(nextHex.slice(1));
			setDraftInvalid(false);
		}
		if (nextHex !== normalizeHex(props.value)) props.onChange(nextHex);
	};

	const end = () => props.onChangeEnd?.(hex());

	const pick = (value: string) => {
		const normalized = normalizeHex(value);
		if (!normalized) return;
		const parsed = hexToHsv(normalized);
		const keepHue = parsed.s === 0 || parsed.v === 0;
		commit({ ...parsed, h: keepHue ? hsv().h : parsed.h });
		end();
	};

	let area: HTMLDivElement | undefined;
	let areaPointer: number | undefined;
	let keyboardDirty = false;

	const setFromPointer = (event: PointerEvent) => {
		if (!area) return;
		const rect = area.getBoundingClientRect();
		const s = clamp01((event.clientX - rect.left) / rect.width);
		const v = clamp01(1 - (event.clientY - rect.top) / rect.height);
		commit({ ...hsv(), s, v });
	};

	const onAreaPointerDown = (
		event: PointerEvent & { currentTarget: HTMLDivElement },
	) => {
		if (event.button !== 0) return;
		event.preventDefault();
		areaPointer = event.pointerId;
		try {
			event.currentTarget.setPointerCapture(event.pointerId);
		} catch {}
		event.currentTarget
			.querySelector<HTMLElement>("[data-color-area-thumb]")
			?.focus();
		setFromPointer(event);
	};

	const onAreaPointerMove = (event: PointerEvent) => {
		if (event.pointerId !== areaPointer) return;
		setFromPointer(event);
	};

	const onAreaPointerEnd = (event: PointerEvent) => {
		if (event.pointerId !== areaPointer) return;
		areaPointer = undefined;
		end();
	};

	const onAreaKeyDown = (event: KeyboardEvent) => {
		const step = event.shiftKey ? AREA_PAGE_STEP : AREA_STEP;
		const current = hsv();
		const moves: Record<string, Partial<Hsv>> = {
			ArrowLeft: { s: clamp01(current.s - step) },
			ArrowRight: { s: clamp01(current.s + step) },
			ArrowUp: { v: clamp01(current.v + step) },
			ArrowDown: { v: clamp01(current.v - step) },
			PageUp: { v: clamp01(current.v + AREA_PAGE_STEP) },
			PageDown: { v: clamp01(current.v - AREA_PAGE_STEP) },
			Home: { s: 0 },
			End: { s: 1 },
		};
		const move = moves[event.key];
		if (!move) return;
		event.preventDefault();
		keyboardDirty = true;
		const next = { ...current, ...move };
		if ((next.s === 0 || next.s === 1) && next.s !== current.s)
			haptics.selection();
		commit(next);
	};

	const hueHex = () => hsvToHex({ h: hsv().h, s: 1, v: 1 });

	const onDraftChange = (value: string) => {
		const cleaned = value.replace(/^#/, "").slice(0, 6);
		setDraft(cleaned);
		const normalized = normalizeHex(cleaned);
		setDraftInvalid(false);
		if (normalized) {
			const parsed = hexToHsv(normalized);
			const keepHue = parsed.s === 0 || parsed.v === 0;
			commit({ ...parsed, h: keepHue ? hsv().h : parsed.h });
		}
	};

	let draftAtFocus = "";

	const settleDraft = () => {
		if (!editingHex()) return;
		setEditingHex(false);
		const normalized = normalizeHex(draft());
		if (!normalized) {
			setDraftInvalid(true);
			return;
		}
		setDraft(hex().slice(1));
		setDraftInvalid(false);
		if (normalized !== draftAtFocus) end();
	};

	const swatches = () => props.presets ?? DEFAULT_SWATCHES;

	return (
		<div
			data-color-picker=""
			class={cx("flex w-full flex-col gap-3", props.class)}
		>
			<div
				ref={area}
				data-color-area=""
				onPointerDown={onAreaPointerDown}
				onPointerMove={onAreaPointerMove}
				onPointerUp={onAreaPointerEnd}
				onPointerCancel={onAreaPointerEnd}
				onLostPointerCapture={onAreaPointerEnd}
				class="relative h-40 w-full cursor-crosshair touch-none rounded-control shadow-[inset_0_0_0_1px_var(--border)] select-none"
				style={{
					"background-color": hueHex(),
					"background-image":
						"linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)",
				}}
			>
				<div
					role="slider"
					tabIndex={0}
					data-color-area-thumb=""
					aria-label="Saturation and brightness"
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={Math.round(hsv().s * 100)}
					aria-valuetext={`Saturation ${Math.round(hsv().s * 100)}%, brightness ${Math.round(hsv().v * 100)}%`}
					onKeyDown={onAreaKeyDown}
					onBlur={() => {
						if (!keyboardDirty) return;
						keyboardDirty = false;
						end();
					}}
					class={cx(
						"absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_4px_rgb(0_0_0/0.45)]",
						"focus-ring",
					)}
					style={{
						left: `${hsv().s * 100}%`,
						top: `${(1 - hsv().v) * 100}%`,
						"background-color": hex(),
					}}
				/>
			</div>
			<div class="flex items-center gap-2">
				<Slider
					aria-label="Hue"
					class="min-w-0 flex-1"
					value={[Math.round(hsv().h)]}
					minValue={0}
					maxValue={360}
					step={1}
					fill={false}
					formatValue={(value) => `${value} degrees`}
					trackClass="h-3"
					trackStyle={{
						"background-image":
							"linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
					}}
					thumbStyle={() => ({
						"background-color": hueHex(),
						border: "3px solid #fff",
					})}
					onChange={([h]) => commit({ ...hsv(), h })}
					onChangeEnd={end}
				/>
			</div>
			<TextField
				aria-label="Hex color"
				value={draft()}
				onChange={onDraftChange}
				leading={<span class="font-semibold">#</span>}
				trailing={
					<span
						aria-hidden="true"
						class="size-4 rounded-[4px] border border-border"
						style={{ "background-color": hex() }}
					/>
				}
				autocomplete="off"
				maxLength={7}
				error={draftInvalid() ? "Use 3 or 6 hex digits" : undefined}
				onKeyDown={(event) => {
					if (event.key === "Enter") {
						event.preventDefault();
						settleDraft();
					}
				}}
				ref={(input) => {
					input.addEventListener("focus", () => {
						setEditingHex(true);
						draftAtFocus = hex();
					});
					input.addEventListener("blur", settleDraft);
					input.spellcheck = false;
				}}
			/>
			<Show when={swatches().length > 0}>
				<fieldset class="m-0 grid min-w-0 grid-cols-[repeat(auto-fill,minmax(28px,1fr))] gap-2 border-0 p-0">
					<legend class="sr-only">Preset colors</legend>
					<For each={swatches()}>
						{(swatch) => {
							const normalized = normalizeHex(swatch) ?? swatch;
							const selected = () => normalized === hex();
							return (
								<button
									type="button"
									aria-label={normalized}
									aria-pressed={selected()}
									data-color-preset={normalized}
									onClick={() => pick(normalized)}
									class={cx(
										"aspect-square w-full cursor-pointer rounded-control-sm border border-border",
										"transition-[scale,box-shadow] duration-[calc(var(--duration-color)*var(--motion-scale))] ease-(--ease-out-quick) active:scale-95",
										"outline-none focus-ring",
										selected() &&
											"shadow-[0_0_0_2px_var(--popover),0_0_0_4px_var(--foreground)]",
									)}
									style={{ "background-color": normalized }}
								/>
							);
						}}
					</For>
				</fieldset>
			</Show>
		</div>
	);
};

type TriggerButtonProps = Omit<
	JSX.ButtonHTMLAttributes<HTMLButtonElement>,
	"children" | "color" | "ref"
> & {
	ref?: HTMLButtonElement | ((element: HTMLButtonElement) => void);
};

const useRippleRef = (ref: () => TriggerButtonProps["ref"]) => {
	const ripple = createRipple();
	return (element: HTMLButtonElement) => {
		ripple(element);
		const forwarded = ref();
		if (typeof forwarded === "function") forwarded(element);
	};
};

export type ColorSwatchButtonProps = TriggerButtonProps & {
	color: string;
	label: string;
};

export const ColorSwatchButton = (props: ColorSwatchButtonProps) => {
	const [local, rest] = splitProps(props, ["color", "label", "class", "ref"]);
	const ref = useRippleRef(() => local.ref);
	const light = () => isLightColor(normalizeHex(local.color) ?? "#000000");

	return (
		<button
			type="button"
			aria-label={`${local.label}, ${normalizeHex(local.color) ?? local.color}`}
			{...rest}
			ref={ref}
			data-color-swatch-button=""
			class={cx(
				"relative flex h-full w-full cursor-pointer items-center justify-center overflow-hidden rounded-control border border-border",
				"transition-[scale] duration-200 ease-out active:scale-[0.97] motion-reduce:transition-none",
				"disabled:cursor-not-allowed disabled:opacity-50",
				focusRing,
				light() ? "text-black/80" : "text-white/90",
				local.class,
			)}
			style={{ "background-color": local.color }}
		>
			<PipetteIcon aria-hidden="true" class="size-4" />
		</button>
	);
};

export type ColorSwatchFrameProps = {
	label: string;
	onRemove?: () => void;
	removeLabel?: string;
	class?: string;
	children: JSX.Element;
};

export const ColorSwatchFrame = (props: ColorSwatchFrameProps) => (
	<div
		data-color-swatch=""
		class={cx("relative flex h-10 min-w-0 flex-1", props.class)}
	>
		{props.children}
		<Show when={props.onRemove}>
			{(onRemove) => (
				<button
					type="button"
					aria-label={
						props.removeLabel ?? `Remove ${props.label.toLowerCase()}`
					}
					data-color-swatch-remove=""
					onClick={() => onRemove()()}
					class={cx(
						"absolute -top-3 -right-3 z-10 flex size-6 cursor-pointer items-center justify-center rounded-full border border-border bg-secondary text-foreground",
						"before:absolute before:-inset-2 before:content-['']",
						"hover:bg-secondary-highlight active:scale-95",
						focusRing,
					)}
				>
					<TrashBinTrashIcon aria-hidden="true" class="size-4" />
				</button>
			)}
		</Show>
	</div>
);

export type ColorSwatchProps = ColorSwatchButtonProps & {
	onRemove?: () => void;
	removeLabel?: string;
};

export const ColorSwatch = (props: ColorSwatchProps) => {
	const [local, rest] = splitProps(props, ["onRemove", "removeLabel", "class"]);
	return (
		<ColorSwatchFrame
			label={rest.label}
			onRemove={local.onRemove}
			removeLabel={local.removeLabel}
			class={local.class}
		>
			<ColorSwatchButton {...rest} />
		</ColorSwatchFrame>
	);
};

export type ColorRowProps = TriggerButtonProps & {
	color: string;
	label: JSX.Element;
};

export const ColorRow = (props: ColorRowProps) => {
	const [local, rest] = splitProps(props, ["color", "label", "class", "ref"]);
	const ref = useRippleRef(() => local.ref);
	const hex = () => normalizeHex(local.color) ?? local.color;

	return (
		<button
			type="button"
			{...rest}
			ref={ref}
			data-color-row=""
			class={cx(
				"ripple flex h-10 w-full shrink-0 cursor-pointer items-center gap-2 rounded-control bg-secondary px-3 text-left text-foreground hover:bg-secondary-highlight",
				"disabled:cursor-not-allowed disabled:opacity-50",
				"outline-none focus-ring-inset",
				local.class,
			)}
		>
			<span class="min-w-0 flex-1 truncate text-sm font-semibold">
				{local.label}
			</span>
			<span class="shrink-0 text-xs font-semibold text-muted-foreground tabular-nums">
				{hex()}
			</span>
			<span
				aria-hidden="true"
				class="size-4 shrink-0 rounded-[4px] border border-border"
				style={{ "background-color": local.color }}
			/>
		</button>
	);
};

export type ColorPickerProps = {
	value: string;
	onChange: (hex: string) => void;
	onChangeEnd?: (hex: string) => void;
	label: string;
	variant?: "swatch" | "row";
	platform?: "desktop" | "mobile";
	presets?: string[];
	onRemove?: () => void;
	removeLabel?: string;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	disabled?: boolean;
	class?: string;
};

export const ColorPicker = (props: ColorPickerProps) => {
	const [internalOpen, setInternalOpen] = createSignal(false);
	const open = () => props.open ?? internalOpen();
	const setOpen = (next: boolean) => {
		setInternalOpen(next);
		props.onOpenChange?.(next);
	};

	const panel = () => (
		<ColorPickerPanel
			value={props.value}
			onChange={props.onChange}
			onChangeEnd={props.onChangeEnd}
			presets={props.presets}
		/>
	);

	const desktopTrigger = () =>
		props.variant === "row" ? (
			<KobaltePopover.Trigger
				as={ColorRow}
				color={props.value}
				label={props.label}
				disabled={props.disabled}
				class={props.class}
			/>
		) : (
			<ColorSwatchFrame
				label={props.label}
				onRemove={props.onRemove}
				removeLabel={props.removeLabel}
				class={props.class}
			>
				<KobaltePopover.Trigger
					as={ColorSwatchButton}
					color={props.value}
					label={props.label}
					disabled={props.disabled}
				/>
			</ColorSwatchFrame>
		);

	const mobileTrigger = () => {
		const shared = {
			"aria-haspopup": "dialog" as const,
			"aria-expanded": open(),
			onClick: () => setOpen(true),
			disabled: props.disabled,
		};
		return props.variant === "row" ? (
			<ColorRow
				{...shared}
				color={props.value}
				label={props.label}
				class={props.class}
			/>
		) : (
			<ColorSwatch
				{...shared}
				color={props.value}
				label={props.label}
				onRemove={props.onRemove}
				removeLabel={props.removeLabel}
				class={props.class}
			/>
		);
	};

	return (
		<Show
			when={props.platform === "mobile"}
			fallback={
				<Popover open={open()} onOpenChange={setOpen} placement="bottom-start">
					{desktopTrigger()}
					<PopoverContent aria-label={props.label} class="w-72 p-3">
						{panel()}
					</PopoverContent>
				</Popover>
			}
		>
			{mobileTrigger()}
			<Drawer open={open()} onOpenChange={setOpen}>
				<DrawerContent title={props.label}>{panel()}</DrawerContent>
			</Drawer>
		</Show>
	);
};

export type AddColorSwatchProps = {
	label?: string;
	disabled?: boolean;
	onClick: () => void;
	ref?: (element: HTMLButtonElement) => void;
	class?: string;
};

export const AddColorSwatch = (props: AddColorSwatchProps) => {
	const ripple = createRipple();
	return (
		<div
			data-color-swatch=""
			class={cx("relative flex h-10 min-w-0 flex-1", props.class)}
		>
			<button
				type="button"
				ref={(element) => {
					ripple(element);
					props.ref?.(element);
				}}
				data-color-swatch-add=""
				disabled={props.disabled}
				onClick={() => props.onClick()}
				class={cx(
					"relative flex h-full w-full cursor-pointer items-center justify-center gap-1.5 overflow-hidden rounded-control border border-dashed border-muted-foreground/40 text-sm font-semibold text-muted-foreground",
					"hover:border-muted-foreground/60 hover:bg-secondary hover:text-foreground",
					"transition-[scale] duration-200 ease-out active:scale-[0.97] motion-reduce:transition-none",
					"disabled:cursor-not-allowed disabled:opacity-50",
					focusRing,
				)}
			>
				<AddIcon aria-hidden="true" class="size-4" />
				{props.label ?? "Add color"}
			</button>
		</div>
	);
};

const companionColor = (hex: string) => {
	const base = hexToHsv(normalizeHex(hex) ?? "#000000");
	return hsvToHex({
		h: (base.h + 40) % 360,
		s: Math.max(base.s, 0.45),
		v: Math.max(base.v, 0.6),
	});
};

export type ThemeColorPickerProps = {
	colors: string[];
	onChange: (colors: string[]) => void;
	onChangeEnd?: (colors: string[]) => void;
	platform?: "desktop" | "mobile";
	presets?: string[];
	primaryLabel?: string;
	secondaryLabel?: string;
	addLabel?: string;
	disabled?: boolean;
	class?: string;
};

export const ThemeColorPicker = (props: ThemeColorPickerProps) => {
	const [secondaryOpen, setSecondaryOpen] = createSignal(false);
	let addButton: HTMLButtonElement | undefined;
	const primary = () => props.colors[0] ?? "#000000";
	const secondary = () => props.colors[1];

	const add = () => {
		props.onChange([primary(), companionColor(primary())]);
		setSecondaryOpen(true);
	};

	const remove = () => {
		setSecondaryOpen(false);
		props.onChange([primary()]);
		props.onChangeEnd?.([primary()]);
		queueMicrotask(() => addButton?.focus());
	};

	return (
		<div data-theme-colors="" class={cx("flex gap-2", props.class)}>
			<ColorPicker
				label={props.primaryLabel ?? "Primary theme color"}
				value={primary()}
				platform={props.platform}
				presets={props.presets}
				disabled={props.disabled}
				onChange={(hex) =>
					props.onChange(secondary() ? [hex, secondary() as string] : [hex])
				}
				onChangeEnd={(hex) =>
					props.onChangeEnd?.(
						secondary() ? [hex, secondary() as string] : [hex],
					)
				}
			/>
			<Show
				when={secondary()}
				fallback={
					<AddColorSwatch
						label={props.addLabel}
						disabled={props.disabled}
						onClick={add}
						ref={(element) => {
							addButton = element;
						}}
					/>
				}
			>
				{(color) => (
					<ColorPicker
						label={props.secondaryLabel ?? "Secondary theme color"}
						value={color()}
						platform={props.platform}
						presets={props.presets}
						disabled={props.disabled}
						open={secondaryOpen()}
						onOpenChange={setSecondaryOpen}
						onRemove={remove}
						onChange={(hex) => props.onChange([primary(), hex])}
						onChangeEnd={(hex) => props.onChangeEnd?.([primary(), hex])}
					/>
				)}
			</Show>
		</div>
	);
};
