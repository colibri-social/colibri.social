import { ChatSquareDotsIcon } from "@solar-icons/solid/bold/chat-square-dots";
import { AltArrowRightIcon } from "@solar-icons/solid/linear/alt-arrow-right";
import {
	createContext,
	createUniqueId,
	For,
	type JSX,
	Show,
	useContext,
} from "solid-js";
import { ThreadIcon } from "../../icons/custom";
import { cx } from "../../utils/cx";
import { useHaptics } from "../../utils/haptics";
import { createRipple } from "../../utils/ripple";
import { createSlot } from "../../utils/slot";
import { SkeletonText } from "../Skeleton/Skeleton";
import { SpaceIcon } from "../Space/SpaceIcon";

export type DestinationPlatform = "desktop" | "mobile";

export type DestinationMode = "single" | "multi";

type ListContext = { platform: DestinationPlatform; mode: DestinationMode };

const DestinationListContext = createContext<ListContext>({
	platform: "mobile",
	mode: "single",
});

const ThreadsContext = createContext(false);

const useList = () => useContext(DestinationListContext);

const rowHeight = (platform: DestinationPlatform) =>
	platform === "desktop" ? "h-10" : "h-11";

const toggleWidth = (platform: DestinationPlatform) =>
	platform === "desktop" ? "w-10" : "w-11";

const rowSurface =
	"ripple rounded-control-sm text-left text-foreground select-none [-webkit-touch-callout:none]";

const hoverable = "hover:bg-secondary";

const CHECK_PATH = "M6.4 12.8L9.6 16L17.6 8";
const CHECK_LENGTH = 16;

const CheckMark = (props: { checked: boolean; disabled?: boolean }) => (
	<span
		aria-hidden="true"
		data-destination-check=""
		class={cx(
			"flex size-6 shrink-0 items-center justify-center rounded-checkbox border text-primary-foreground",
			"transition-[background-color,border-color,box-shadow] duration-[calc(var(--duration-color)*var(--motion-scale))]",
			props.disabled && "opacity-50",
			props.checked
				? "border-transparent bg-primary shadow-[inset_0_0_0_1px_var(--border)]"
				: "border-control-border bg-secondary",
		)}
	>
		<svg
			aria-hidden="true"
			viewBox="0 0 24 24"
			class="size-6 drop-shadow-[0_0_2px_rgb(0_0_0/0.25)]"
			fill="none"
		>
			<path
				d={CHECK_PATH}
				stroke="currentColor"
				stroke-width="1.75"
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-dasharray={`${CHECK_LENGTH}px`}
				class="transition-[stroke-dashoffset] ease-(--ease-out-quick) reduced-motion:transition-none motion-reduce:transition-none"
				style={{
					"stroke-dashoffset": props.checked ? "0px" : `${CHECK_LENGTH}px`,
					"transition-duration": props.checked
						? "calc(150ms * var(--motion-scale))"
						: "calc(90ms * var(--motion-scale))",
				}}
			/>
		</svg>
	</span>
);

export type DestinationListProps = {
	platform?: DestinationPlatform;
	mode?: DestinationMode;
	class?: string;
	children?: JSX.Element;
};

export const DestinationList = (props: DestinationListProps) => {
	const context: ListContext = {
		get platform() {
			return props.platform ?? "mobile";
		},
		get mode() {
			return props.mode ?? "single";
		},
	};
	return (
		<DestinationListContext.Provider value={context}>
			<div
				data-destination-list=""
				data-mode={context.mode}
				class={cx("flex min-w-0 flex-col gap-5", props.class)}
			>
				{props.children}
			</div>
		</DestinationListContext.Provider>
	);
};

export type DestinationSpaceProps = {
	name: string;
	iconSrc?: string;
	class?: string;
	children?: JSX.Element;
};

export const DestinationSpace = (props: DestinationSpaceProps) => {
	const heading = createUniqueId();
	return (
		<section
			data-destination-space=""
			aria-labelledby={heading}
			class={cx("flex min-w-0 flex-col gap-1", props.class)}
		>
			<div class="flex h-7 min-w-0 items-center gap-2 px-2">
				<SpaceIcon name={props.name} src={props.iconSrc} size={20} />
				<h3
					id={heading}
					data-destination-space-name=""
					class="m-0 min-w-0 truncate text-sm leading-5 font-semibold text-muted-foreground"
				>
					{props.name}
				</h3>
			</div>
			<div class="flex min-w-0 flex-col gap-0.5">{props.children}</div>
		</section>
	);
};

type SelectableProps = {
	onSelect?: () => void;
	checked?: boolean;
	onCheckedChange?: (checked: boolean) => void;
	value?: string;
	disabled?: boolean;
};

type RowBodyProps = {
	kind: "channel" | "thread";
	icon: JSX.Element;
	name: JSX.Element;
	hint?: JSX.Element;
	meta?: JSX.Element;
	checked?: boolean;
	disabled?: boolean;
	showCheck: boolean;
};

const RowBody = (props: RowBodyProps) => {
	const hint = createSlot(() => props.hint);
	const meta = createSlot(() => props.meta);
	return (
		<>
			<span
				aria-hidden="true"
				class={cx(
					"flex size-4 shrink-0 items-center justify-center [&>svg]:size-4",
					props.checked ? "text-foreground" : "text-muted-foreground",
				)}
			>
				{props.icon}
			</span>
			<span
				data-destination-name=""
				class={cx(
					"min-w-0 shrink truncate leading-5 font-medium",
					props.kind === "channel" ? "text-base" : "text-sm",
				)}
			>
				{props.name}
			</span>
			<Show when={hint.has()}>
				<span
					data-destination-hint=""
					class="min-w-0 shrink-[2] truncate text-xs leading-4 font-medium text-muted-foreground"
				>
					{hint()}
				</span>
			</Show>
			<span class="min-w-0 flex-1" />
			<Show when={meta.has()}>
				<span
					data-destination-meta=""
					class="shrink-0 text-xs leading-4 font-medium whitespace-nowrap text-muted-foreground tabular-nums"
				>
					{meta()}
				</span>
			</Show>
			<Show when={props.showCheck}>
				<CheckMark checked={!!props.checked} disabled={props.disabled} />
			</Show>
		</>
	);
};

type RowMainProps = SelectableProps & {
	body: RowBodyProps;
	expanded?: boolean;
	controls?: string;
	onToggle?: () => void;
	class?: string;
};

const RowMain = (props: RowMainProps) => {
	const list = useList();
	const haptics = useHaptics();
	const ripple = createRipple({ disabled: () => !!props.disabled });
	const layout = () =>
		cx(
			"flex min-w-0 flex-1 items-center gap-2 px-2",
			rowSurface,
			rowHeight(list.platform),
			props.class,
		);

	return (
		<Show
			when={list.mode === "multi"}
			fallback={
				<button
					ref={ripple}
					type="button"
					data-destination-main=""
					aria-expanded={props.onSelect ? undefined : props.expanded}
					aria-controls={props.onSelect ? undefined : props.controls}
					disabled={props.disabled}
					onClick={() =>
						props.onSelect ? props.onSelect() : props.onToggle?.()
					}
					class={cx(
						layout(),
						"cursor-pointer outline-none focus-ring-inset",
						"disabled:cursor-not-allowed disabled:opacity-50",
						hoverable,
					)}
				>
					<RowBody {...props.body} />
				</button>
			}
		>
			<label
				ref={ripple}
				data-destination-main=""
				class={cx(
					layout(),
					"has-[:focus-visible]:[outline:var(--focus-ring-width)_solid_var(--primary)] has-[:focus-visible]:[outline-offset:calc(var(--focus-ring-width)*-1)]",
					props.disabled
						? "cursor-not-allowed"
						: cx("cursor-pointer", hoverable),
				)}
			>
				<input
					type="checkbox"
					class="sr-only"
					value={props.value ?? ""}
					checked={!!props.checked}
					disabled={props.disabled}
					onChange={(event) => {
						haptics.selection();
						props.onCheckedChange?.(event.currentTarget.checked);
					}}
				/>
				<RowBody {...props.body} />
			</label>
		</Show>
	);
};

export type DestinationChannelProps = SelectableProps & {
	name: JSX.Element;
	hint?: JSX.Element;
	meta?: JSX.Element;
	expanded: boolean;
	onExpandedChange: (expanded: boolean) => void;
	toggleLabel: string;
	class?: string;
	children?: JSX.Element;
};

export const DestinationChannel = (props: DestinationChannelProps) => {
	const list = useList();
	const panel = createUniqueId();
	const toggle = () => props.onExpandedChange(!props.expanded);

	return (
		<div
			data-destination-channel=""
			data-expanded={props.expanded ? "" : undefined}
			class={cx("flex min-w-0 flex-col", props.class)}
		>
			<div class="flex min-w-0 items-stretch gap-0.5">
				<RowMain
					onSelect={props.onSelect}
					checked={props.checked}
					onCheckedChange={props.onCheckedChange}
					value={props.value}
					disabled={props.disabled}
					expanded={props.expanded}
					controls={panel}
					onToggle={toggle}
					body={{
						kind: "channel",
						icon: <ChatSquareDotsIcon />,
						name: props.name,
						hint: props.hint,
						meta: props.meta,
						checked: props.checked,
						disabled: props.disabled,
						showCheck: list.mode === "multi",
					}}
				/>
				<button
					type="button"
					data-destination-toggle=""
					aria-label={props.toggleLabel}
					aria-expanded={props.expanded}
					aria-controls={panel}
					onClick={toggle}
					class={cx(
						"flex shrink-0 cursor-pointer items-center justify-center rounded-control-sm text-muted-foreground outline-none focus-ring-inset",
						"hover:bg-secondary hover:text-foreground",
						rowHeight(list.platform),
						toggleWidth(list.platform),
					)}
				>
					<span
						class={cx(
							"flex size-4 items-center justify-center transition-transform duration-[calc(var(--duration-color)*var(--motion-scale))] motion-reduce:transition-none [&>svg]:size-4",
							props.expanded && "rotate-90",
						)}
					>
						<AltArrowRightIcon />
					</span>
				</button>
			</div>
			<ThreadsContext.Provider value={true}>
				<div
					id={panel}
					data-destination-threads=""
					hidden={!props.expanded}
					class="ml-4 flex min-w-0 flex-col gap-0.5 border-0 border-l border-solid border-border pt-0.5 pl-2"
				>
					<Show when={props.expanded}>{props.children}</Show>
				</div>
			</ThreadsContext.Provider>
		</div>
	);
};

export type DestinationThreadProps = SelectableProps & {
	name: JSX.Element;
	hint?: JSX.Element;
	meta?: JSX.Element;
	class?: string;
};

export const DestinationThread = (props: DestinationThreadProps) => {
	const list = useList();
	const nested = useContext(ThreadsContext);
	return (
		<div
			data-destination-thread=""
			class={cx("flex min-w-0 items-stretch gap-0.5", props.class)}
		>
			<RowMain
				onSelect={props.onSelect}
				checked={props.checked}
				onCheckedChange={props.onCheckedChange}
				value={props.value}
				disabled={props.disabled}
				body={{
					kind: "thread",
					icon: <ThreadIcon />,
					name: props.name,
					hint: props.hint,
					meta: props.meta,
					checked: props.checked,
					disabled: props.disabled,
					showCheck: list.mode === "multi",
				}}
			/>
			<Show when={nested}>
				<span
					aria-hidden="true"
					data-destination-toggle-space=""
					class={cx("shrink-0", toggleWidth(list.platform))}
				/>
			</Show>
		</div>
	);
};

export type DestinationActionTone = "primary" | "muted";

export type DestinationActionProps = {
	icon: JSX.Element;
	label: JSX.Element;
	onClick: () => void;
	tone?: DestinationActionTone;
	disabled?: boolean;
	class?: string;
};

export const DestinationAction = (props: DestinationActionProps) => {
	const list = useList();
	const ripple = createRipple({ disabled: () => !!props.disabled });
	return (
		<button
			ref={ripple}
			type="button"
			data-destination-action=""
			disabled={props.disabled}
			onClick={() => props.onClick()}
			class={cx(
				"flex w-full min-w-0 shrink-0 cursor-pointer items-center gap-2 px-2 outline-none focus-ring-inset",
				"disabled:cursor-not-allowed disabled:opacity-50",
				rowSurface,
				hoverable,
				rowHeight(list.platform),
				props.tone === "muted"
					? "text-muted-foreground"
					: "text-primary-highlight",
				props.class,
			)}
		>
			<span
				aria-hidden="true"
				class="flex size-4 shrink-0 items-center justify-center [&>svg]:size-4"
			>
				{props.icon}
			</span>
			<span class="min-w-0 flex-1 truncate text-sm leading-5 font-semibold">
				{props.label}
			</span>
		</button>
	);
};

export type DestinationNoteProps = {
	children: JSX.Element;
	class?: string;
};

export const DestinationNote = (props: DestinationNoteProps) => {
	const list = useList();
	return (
		<p
			data-destination-note=""
			class={cx(
				"m-0 flex min-w-0 items-center px-2 text-sm leading-5 text-muted-foreground",
				rowHeight(list.platform),
				props.class,
			)}
		>
			<span class="min-w-0 truncate">{props.children}</span>
		</p>
	);
};

export type DestinationThreadSkeletonProps = {
	rows?: number;
};

const SKELETON_WIDTHS = ["58%", "42%", "50%"];

export const DestinationThreadSkeleton = (
	props: DestinationThreadSkeletonProps,
) => {
	const list = useList();
	return (
		<div data-destination-skeleton="" class="flex min-w-0 flex-col gap-0.5">
			<span class="sr-only">Loading threads</span>
			<For each={Array.from({ length: props.rows ?? 2 }, (_, i) => i)}>
				{(index) => (
					<span
						aria-hidden="true"
						class={cx(
							"flex min-w-0 items-center gap-2 px-2",
							rowHeight(list.platform),
						)}
					>
						<span class="flex size-4 shrink-0 items-center justify-center text-muted [&>svg]:size-4">
							<ThreadIcon />
						</span>
						<SkeletonText
							size="sm"
							width={SKELETON_WIDTHS[index % SKELETON_WIDTHS.length]}
							class="flex-1"
						/>
					</span>
				)}
			</For>
		</div>
	);
};

export type DestinationEmptyProps = {
	children: JSX.Element;
	class?: string;
};

export const DestinationEmpty = (props: DestinationEmptyProps) => (
	<p
		data-destination-empty=""
		class={cx(
			"m-0 px-4 py-8 text-center text-sm leading-prose text-pretty text-muted-foreground",
			props.class,
		)}
	>
		{props.children}
	</p>
);
