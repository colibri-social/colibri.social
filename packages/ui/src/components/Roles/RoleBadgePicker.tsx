import { DangerCircleIcon } from "@solar-icons/solid/bold/danger-circle";
import { GalleryAddIcon } from "@solar-icons/solid/bold/gallery-add";
import {
	createEffect,
	createSignal,
	createUniqueId,
	For,
	type JSX,
	Match,
	on,
	onCleanup,
	Show,
	Switch,
} from "solid-js";
import { cx } from "../../utils/cx";
import {
	nameColorClass,
	nameColorStyle,
	themedColor,
} from "../../utils/name-color";
import { AnimatedImage } from "../AnimatedImage/AnimatedImage";
import { Button } from "../Button/Button";
import {
	ColorPicker,
	DEFAULT_SWATCHES,
	normalizeHex,
} from "../ColorPicker/ColorPicker";
import { Drawer, DrawerContent } from "../Drawer/Drawer";
import { Modal, ModalContent } from "../Modal/Modal";
import {
	describeImageLimits,
	validateImageFile,
} from "../Onboarding/ImageUploadTile";
import { SegmentedControl } from "../SegmentedControl/SegmentedControl";
import {
	DEFAULT_ROLE_BADGE_COLOR,
	ROLE_BADGE_ICONS,
	RoleBadgeGlyph,
	type RoleBadgeIconName,
	type RoleBadgeValue,
	type RoleIdentity,
} from "./RoleBadge";
import { RoleBadgeSettingRow } from "./RoleRow";

export const ROLE_BADGE_IMAGE_ACCEPT =
	"image/png,image/jpeg,image/webp,image/gif";
export const ROLE_BADGE_IMAGE_MAX_BYTES = 256 * 1024;

export type RoleBadgePickerTab = "icons" | "image";

export type RoleBadgePickerPlatform = "desktop" | "mobile";

export type RoleBadgePickerPanelProps = {
	role: RoleIdentity;
	value?: RoleBadgeValue;
	onChange: (value: RoleBadgeValue | undefined) => void;
	platform?: RoleBadgePickerPlatform;
	onUploadImage?: (file: File) => Promise<string>;
	imageMaxBytes?: number;
	colorPresets?: string[];
	class?: string;
};

const tabFor = (value: RoleBadgeValue | undefined): RoleBadgePickerTab =>
	value?.kind === "image" ? "image" : "icons";

const sameColor = (a: string | undefined, b: string | undefined) =>
	(a && normalizeHex(a)) === (b && normalizeHex(b));

const radioFocus =
	"has-[:focus-visible]:[outline:var(--focus-ring-width)_solid_var(--primary)] has-[:focus-visible]:[outline-offset:var(--focus-ring-offset)]";

const swatchChecked =
	"has-[:checked]:shadow-[0_0_0_2px_var(--popover),0_0_0_4px_var(--foreground)]";

const IconGrid = (props: {
	selected?: RoleBadgeIconName;
	color?: string;
	roleColor?: string;
	onSelect: (name: RoleBadgeIconName) => void;
}) => {
	const name = createUniqueId();
	return (
		<fieldset
			data-role-badge-icons=""
			class="m-0 grid min-w-0 grid-cols-8 gap-1 border-0 p-1"
		>
			<legend class="sr-only">Icon</legend>
			<For each={ROLE_BADGE_ICONS}>
				{(entry) => (
					<label
						data-checked={entry.name === props.selected ? "" : undefined}
						class={cx(
							"relative flex aspect-square w-full cursor-pointer items-center justify-center rounded-control-sm",
							"hover:bg-secondary-highlight",
							"has-[:checked]:bg-secondary-highlight has-[:checked]:shadow-[inset_0_0_0_1.5px_var(--primary)]",
							radioFocus,
						)}
					>
						<input
							type="radio"
							name={name}
							value={entry.name}
							aria-label={entry.label}
							checked={entry.name === props.selected}
							onChange={() => props.onSelect(entry.name)}
							class="sr-only"
						/>
						<RoleBadgeGlyph
							badge={{ kind: "icon", name: entry.name, color: props.color }}
							roleColor={props.roleColor}
							size="md"
						/>
					</label>
				)}
			</For>
		</fieldset>
	);
};

const ColorChoice = (props: {
	value?: string;
	roleColor?: string;
	presets: string[];
	platform: RoleBadgePickerPlatform;
	onChange: (color: string | undefined) => void;
}) => {
	const name = createUniqueId();
	const options = () => {
		const seen = new Set<string>();
		const list: { color?: string; label: string }[] = [];
		if (props.roleColor) list.push({ label: "Role color" });
		for (const color of props.presets) {
			const hex = normalizeHex(color);
			if (!hex || seen.has(hex)) continue;
			if (props.roleColor && sameColor(hex, props.roleColor)) continue;
			seen.add(hex);
			list.push({ color: hex, label: hex });
		}
		return list;
	};
	const isChecked = (color: string | undefined) =>
		color === undefined
			? props.value === undefined
			: sameColor(color, props.value);
	const custom = () =>
		props.value !== undefined &&
		!options().some(
			(option) => option.color && sameColor(option.color, props.value),
		);

	return (
		<fieldset class="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
			<legend class="mb-2 text-sm font-medium text-muted-foreground">
				Badge color
			</legend>
			<div class="flex flex-wrap items-center gap-2 p-1">
				<For each={options()}>
					{(option) => (
						<label
							class={cx(
								"relative flex size-8 cursor-pointer items-center justify-center rounded-full border border-border",
								swatchChecked,
								radioFocus,
							)}
							style={{ "background-color": option.color ?? props.roleColor }}
						>
							<input
								type="radio"
								name={name}
								aria-label={option.label}
								checked={isChecked(option.color)}
								onChange={() => props.onChange(option.color)}
								class="sr-only"
							/>
						</label>
					)}
				</For>
				<ColorPicker
					label="Custom badge color"
					value={props.value ?? props.roleColor ?? DEFAULT_ROLE_BADGE_COLOR}
					onChange={(hex) => props.onChange(hex)}
					platform={props.platform}
					class={cx(
						"size-8 flex-none [&_[data-color-swatch-button]]:rounded-full",
						custom() &&
							"[&_[data-color-swatch-button]]:shadow-[0_0_0_2px_var(--popover),0_0_0_4px_var(--foreground)]",
					)}
				/>
			</div>
		</fieldset>
	);
};

const BadgeImageUpload = (props: {
	value?: Extract<RoleBadgeValue, { kind: "image" }>;
	roleColor?: string;
	maxBytes: number;
	uploading: boolean;
	pendingSrc?: string;
	error?: string;
	onError: (message: string | undefined) => void;
	onFile: (file: File) => void;
	onRemove: () => void;
}) => {
	let input: HTMLInputElement | undefined;
	const errorId = createUniqueId();
	const limitsId = createUniqueId();
	const titleId = createUniqueId();
	const [dragging, setDragging] = createSignal(false);
	let latestCheck = 0;

	const take = async (file: File | undefined) => {
		if (!file || props.uploading) return;
		const ticket = ++latestCheck;
		const rejection = await validateImageFile(
			file,
			ROLE_BADGE_IMAGE_ACCEPT,
			props.maxBytes,
		);
		if (ticket !== latestCheck) return;
		if (rejection) {
			props.onError(rejection.message);
			return;
		}
		props.onError(undefined);
		props.onFile(file);
	};

	return (
		<div class="flex flex-col gap-2">
			<div
				data-badge-image-card=""
				data-dragging={dragging() ? "" : undefined}
				onDragEnter={(event) => {
					event.preventDefault();
					setDragging(true);
				}}
				onDragOver={(event) => {
					event.preventDefault();
					if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
				}}
				onDragLeave={(event) => {
					if (
						!(event.currentTarget as HTMLElement).contains(
							event.relatedTarget as Node | null,
						)
					)
						setDragging(false);
				}}
				onDrop={(event) => {
					event.preventDefault();
					setDragging(false);
					void take(event.dataTransfer?.files?.[0]);
				}}
				class={cx(
					"relative flex items-start gap-3 rounded-control border bg-secondary p-3",
					"has-[[data-badge-image-choose]:hover:enabled]:bg-secondary-highlight",
					dragging() ? "border-primary" : "border-border",
					props.error && "border-destructive",
				)}
			>
				<button
					type="button"
					data-badge-image-choose=""
					aria-labelledby={titleId}
					aria-describedby={props.error ? `${limitsId} ${errorId}` : limitsId}
					aria-invalid={props.error ? true : undefined}
					aria-busy={props.uploading ? true : undefined}
					disabled={props.uploading}
					onClick={() => input?.click()}
					class="focus-ring absolute inset-0 cursor-pointer rounded-[inherit] disabled:cursor-default"
				/>
				<div
					data-badge-image-preview=""
					class={cx(
						"pointer-events-none relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-control-sm",
						props.pendingSrc || props.value
							? "bg-background"
							: "border border-dashed border-control-border text-muted-foreground",
					)}
				>
					<Show
						when={props.pendingSrc ?? props.value?.url}
						keyed
						fallback={<GalleryAddIcon class="size-5" aria-hidden="true" />}
					>
						{(src) => (
							<AnimatedImage
								src={src}
								alt=""
								draggable={false}
								class="size-full object-contain"
							/>
						)}
					</Show>
				</div>
				<div class="pointer-events-none relative flex min-w-0 flex-1 flex-col items-start gap-0.5">
					<span class="flex items-center gap-1.5 text-sm font-semibold">
						<span id={titleId}>
							{props.value ? "Replace image" : "Choose image"}
						</span>
					</span>
					<span
						id={limitsId}
						aria-hidden="true"
						class="text-xs text-pretty text-muted-foreground"
					>
						<Show
							when={props.uploading}
							fallback={
								<>
									{describeImageLimits(ROLE_BADGE_IMAGE_ACCEPT, props.maxBytes)}
									. Square works best.
								</>
							}
						>
							Uploading...
						</Show>
					</span>
					<Show when={props.value}>
						<button
							type="button"
							data-badge-image-remove=""
							disabled={props.uploading}
							onClick={() => {
								props.onError(undefined);
								props.onRemove();
							}}
							class="focus-ring pointer-events-auto mt-1 cursor-pointer rounded-xs text-xs font-medium text-muted-foreground underline decoration-muted-foreground/40 underline-offset-2 hover:text-destructive hover:decoration-destructive disabled:cursor-default disabled:opacity-50"
						>
							Remove image
						</button>
					</Show>
				</div>
				<input
					ref={input}
					type="file"
					accept={ROLE_BADGE_IMAGE_ACCEPT}
					class="sr-only"
					tabIndex={-1}
					aria-hidden="true"
					onChange={(event) => {
						const file = event.currentTarget.files?.[0];
						event.currentTarget.value = "";
						void take(file);
					}}
				/>
			</div>
			<Show when={props.error}>
				{(message) => (
					<div
						id={errorId}
						role="alert"
						data-badge-image-error=""
						class="flex items-start gap-2 rounded-control bg-destructive/10 px-3 py-2 text-sm text-destructive"
					>
						<DangerCircleIcon
							class="mt-px size-4 shrink-0"
							aria-hidden="true"
						/>
						<span class="min-w-0 flex-1 text-pretty">{message()}</span>
					</div>
				)}
			</Show>
		</div>
	);
};

export const RoleBadgePickerPanel = (props: RoleBadgePickerPanelProps) => {
	const platform = () => props.platform ?? "desktop";
	const [tab, setTab] = createSignal<RoleBadgePickerTab>(tabFor(props.value));
	const [uploading, setUploading] = createSignal(false);
	const [uploadError, setUploadError] = createSignal<string>();
	const [pendingSrc, setPendingSrc] = createSignal<string>();
	const clearPending = () => {
		const current = pendingSrc();
		if (current) URL.revokeObjectURL(current);
		setPendingSrc(undefined);
	};
	onCleanup(clearPending);
	const iconValue = () =>
		props.value?.kind === "icon" ? props.value : undefined;
	const previewColor = () => nameColorStyle(themedColor(props.role.color));

	createEffect(
		on(
			() => props.value === undefined,
			(cleared) => {
				if (cleared) setUploadError(undefined);
			},
			{ defer: true },
		),
	);

	const pickIcon = (name: RoleBadgeIconName) =>
		props.onChange({ kind: "icon", name, color: iconValue()?.color });

	const pickColor = (color: string | undefined) =>
		props.onChange({
			kind: "icon",
			name: iconValue()?.name ?? "shield-check",
			color,
		});

	let latestUpload = 0;
	const upload = async (file: File) => {
		const upload = props.onUploadImage;
		if (!upload) return;
		const ticket = ++latestUpload;
		setUploadError(undefined);
		clearPending();
		setPendingSrc(URL.createObjectURL(file));
		setUploading(true);
		try {
			const url = await upload(file);
			if (ticket !== latestUpload) return;
			props.onChange({ kind: "image", url });
		} catch {
			if (ticket !== latestUpload) return;
			setUploadError("The image couldn't be uploaded. Try again.");
		} finally {
			if (ticket === latestUpload) {
				setUploading(false);
				clearPending();
			}
		}
	};

	const tabs = () => [
		{ value: "icons", label: "Icons" },
		...(props.onUploadImage ? [{ value: "image", label: "Image" }] : []),
	];

	return (
		<div
			data-role-badge-picker=""
			class={cx("flex min-w-0 flex-col gap-4", props.class)}
		>
			<div
				data-role-badge-preview=""
				class="flex h-10 items-center gap-2 rounded-control bg-secondary px-3"
			>
				<Show
					when={props.value}
					fallback={
						<span class="text-sm font-semibold text-muted-foreground">
							No badge
						</span>
					}
				>
					{(badge) => (
						<RoleBadgeGlyph badge={badge()} roleColor={props.role.color} />
					)}
				</Show>
				<span
					class={cx(
						"min-w-0 flex-1 truncate text-sm font-semibold",
						props.role.color ? nameColorClass : "text-foreground",
					)}
					style={previewColor()}
				>
					{props.role.name}
				</span>
			</div>
			<SegmentedControl
				aria-label="Badge type"
				options={tabs()}
				value={tab()}
				onChange={(next) => setTab(next as RoleBadgePickerTab)}
			/>
			<Switch>
				<Match when={tab() === "icons"}>
					<div class="flex flex-col gap-4">
						<IconGrid
							selected={iconValue()?.name}
							color={iconValue()?.color}
							roleColor={props.role.color}
							onSelect={pickIcon}
						/>
						<ColorChoice
							value={iconValue()?.color}
							roleColor={props.role.color}
							presets={
								props.colorPresets ?? [
									DEFAULT_ROLE_BADGE_COLOR,
									...DEFAULT_SWATCHES,
								]
							}
							platform={platform()}
							onChange={pickColor}
						/>
					</div>
				</Match>
				<Match when={tab() === "image"}>
					<BadgeImageUpload
						value={props.value?.kind === "image" ? props.value : undefined}
						roleColor={props.role.color}
						maxBytes={props.imageMaxBytes ?? ROLE_BADGE_IMAGE_MAX_BYTES}
						uploading={uploading()}
						pendingSrc={pendingSrc()}
						error={uploadError()}
						onError={setUploadError}
						onFile={upload}
						onRemove={() => props.onChange(undefined)}
					/>
				</Match>
			</Switch>
		</div>
	);
};

export type RoleBadgePickerProps = RoleBadgePickerPanelProps & {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export const RoleBadgePicker = (props: RoleBadgePickerProps) => {
	const close = () => props.onOpenChange(false);
	const footer = (): JSX.Element => (
		<>
			<Show when={props.value}>
				<Button
					variant="destructive-subtle"
					onClick={() => props.onChange(undefined)}
				>
					Remove badge
				</Button>
			</Show>
			<Button onClick={close}>Done</Button>
		</>
	);

	return (
		<Show
			when={props.platform === "mobile"}
			fallback={
				<Modal open={props.open} onOpenChange={props.onOpenChange}>
					<ModalContent
						title="Role badge"
						class="md:w-[400px]"
						footer={footer()}
					>
						<RoleBadgePickerPanel {...props} platform="desktop" />
					</ModalContent>
				</Modal>
			}
		>
			<Drawer
				open={props.open}
				onOpenChange={props.onOpenChange}
				initialFocus="content"
			>
				<DrawerContent
					title="Role badge"
					footer={
						<div class="flex flex-col gap-2 [&>*]:w-full">{footer()}</div>
					}
				>
					<RoleBadgePickerPanel {...props} platform="mobile" />
				</DrawerContent>
			</Drawer>
		</Show>
	);
};

export type RoleBadgeSettingProps = Omit<RoleBadgePickerPanelProps, "class"> & {
	label?: JSX.Element;
	disabled?: boolean;
	class?: string;
};

export const RoleBadgeSetting = (props: RoleBadgeSettingProps) => {
	const [open, setOpen] = createSignal(false);
	return (
		<>
			<RoleBadgeSettingRow
				label={props.label}
				badge={props.value}
				roleColor={props.role.color}
				disabled={props.disabled}
				aria-haspopup="dialog"
				aria-expanded={open()}
				onClick={() => setOpen(true)}
				class={props.class}
			/>
			<RoleBadgePicker {...props} open={open()} onOpenChange={setOpen} />
		</>
	);
};
