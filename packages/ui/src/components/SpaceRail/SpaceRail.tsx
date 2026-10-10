import { AddIcon } from "@solar-icons/solid/bold/add";
import { CompassIcon } from "@solar-icons/solid/bold/compass";
import {
	type Accessor,
	createContext,
	createEffect,
	createSignal,
	createUniqueId,
	type JSX,
	onCleanup,
	onMount,
	Show,
	splitProps,
	useContext,
} from "solid-js";
import { cx } from "../../utils/cx";
import { createRipple } from "../../utils/ripple";
import { createSlot } from "../../utils/slot";
import { CountBadge } from "../Badge/Badge";
import { SpaceIcon } from "../Space/SpaceIcon";
import { Tooltip, TooltipContent, TooltipTrigger } from "../Tooltip/Tooltip";

const FOCUSABLE = "[data-rail-focusable]";

export type SpaceRailPlatform = "mobile" | "desktop";

export const SPACE_RAIL_METRICS = {
	mobile: {
		width: 64,
		icon: 48,
		gap: 8,
		paddingTop: 2,
		tabLeft: 6,
		tabRing: 2,
	},
	desktop: {
		width: 56,
		icon: 40,
		gap: 8,
		paddingTop: 0,
		tabLeft: 8,
		tabRing: 0,
	},
} as const;

export const SPACE_RAIL_FILLET = 11;
export const SPACE_RAIL_TAB_RADIUS = 12;

export const spaceRailPanelClass =
	"rail-join relative rounded-tl-sheet border-t border-l border-muted bg-card";

const RAIL_TAB_VARS = [
	"--rail-tab-offset",
	"--rail-tab-height",
	"--rail-tab-visible",
	"--rail-tab-duration",
] as const;

type RailContextValue = {
	platform: Accessor<SpaceRailPlatform>;
	setActive: (element: HTMLElement | undefined) => void;
};

const RailContext = createContext<RailContextValue>();

const useRail = () => useContext(RailContext);

export type SpaceRailProps = {
	"aria-label"?: string;
	platform?: SpaceRailPlatform;
	leading?: JSX.Element;
	onCreate?: () => void;
	onDiscover?: () => void;
	createLabel?: string;
	discoverLabel?: string;
	class?: string;
	children?: JSX.Element;
};

const moveFocus = (rail: HTMLElement, event: KeyboardEvent) => {
	const items = Array.from(rail.querySelectorAll<HTMLElement>(FOCUSABLE));
	const current = items.indexOf(document.activeElement as HTMLElement);
	if (current === -1) return;
	let next = current;
	if (event.key === "ArrowDown") next = Math.min(items.length - 1, current + 1);
	else if (event.key === "ArrowUp") next = Math.max(0, current - 1);
	else if (event.key === "Home") next = 0;
	else if (event.key === "End") next = items.length - 1;
	else return;
	event.preventDefault();
	for (const item of items) item.tabIndex = -1;
	const target = items[next];
	if (!target) return;
	target.tabIndex = 0;
	target.focus();
};

const filletMask = (at: string) =>
	`radial-gradient(circle ${SPACE_RAIL_FILLET}px at ${at}, transparent ${SPACE_RAIL_FILLET - 0.5}px, #000 ${SPACE_RAIL_FILLET}px)`;

const ActiveTab = (props: {
	platform: SpaceRailPlatform;
	active: HTMLElement | undefined;
	top: number | undefined;
	animate: boolean;
}) => {
	const metrics = () => SPACE_RAIL_METRICS[props.platform];
	const height = () => metrics().icon + metrics().tabRing * 2;
	const width = () => metrics().width - metrics().tabLeft;
	return (
		<span
			aria-hidden="true"
			data-rail-tab=""
			class={cx(
				"pointer-events-none absolute top-0 z-0 block",
				props.animate &&
					"transition-transform duration-[calc(240ms*var(--motion-scale))] ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none reduced-motion:transition-none",
			)}
			style={{
				left: `${metrics().tabLeft}px`,
				width: `${width()}px`,
				height: `${height()}px`,
				transform: `translate3d(0, ${(props.top ?? 0) - metrics().tabRing}px, 0)`,
				visibility:
					props.active && props.top !== undefined ? "visible" : "hidden",
			}}
		>
			<span
				data-rail-tab-body=""
				class="absolute inset-0 bg-primary"
				style={{
					"border-radius": `${SPACE_RAIL_TAB_RADIUS}px 0 0 ${SPACE_RAIL_TAB_RADIUS}px`,
				}}
			/>
			<span
				data-rail-tab-fillet="top"
				class="absolute"
				style={{
					right: "0",
					top: `-${SPACE_RAIL_FILLET}px`,
					width: `${SPACE_RAIL_FILLET}px`,
					height: `${SPACE_RAIL_FILLET}px`,
					background:
						"linear-gradient(to bottom, var(--muted), var(--primary))",
					"mask-image": filletMask("0 0"),
					"-webkit-mask-image": filletMask("0 0"),
				}}
			/>
			<span
				data-rail-tab-fillet="bottom"
				class="absolute"
				style={{
					right: "0",
					top: `${height()}px`,
					width: `${SPACE_RAIL_FILLET}px`,
					height: `${SPACE_RAIL_FILLET}px`,
					background:
						"linear-gradient(to bottom, var(--primary), var(--muted))",
					"mask-image": filletMask("0 100%"),
					"-webkit-mask-image": filletMask("0 100%"),
				}}
			/>
		</span>
	);
};

export const SpaceRail = (props: SpaceRailProps) => {
	const platform = () => props.platform ?? "mobile";
	const [active, setActive] = createSignal<HTMLElement>();
	return (
		<RailContext.Provider value={{ platform, setActive }}>
			<RailFrame {...props} platform={platform()} active={active()} />
		</RailContext.Provider>
	);
};

const RailFrame = (
	props: SpaceRailProps & {
		platform: SpaceRailPlatform;
		active: HTMLElement | undefined;
	},
) => {
	const items = createSlot(() => props.children);
	const leading = createSlot(() => props.leading);
	const platform = () => props.platform;
	const metrics = () => SPACE_RAIL_METRICS[platform()];
	const active = () => props.active;
	const [top, setTop] = createSignal<number>();
	const [animate, setAnimate] = createSignal(false);
	let rail: HTMLElement | undefined;
	let content: HTMLDivElement | undefined;
	let scroller: HTMLDivElement | undefined;
	let host: HTMLElement | undefined;

	const writeJoin = (instant: boolean) => {
		if (!host) return;
		const value = top();
		const tabHeight = metrics().icon + metrics().tabRing * 2;
		const offset =
			(value ?? 0) - metrics().tabRing - (scroller?.scrollTop ?? 0);
		const shown = !!active() && value !== undefined && offset > -0.5;
		host.style.setProperty("--rail-tab-offset", `${offset}px`);
		host.style.setProperty("--rail-tab-height", `${tabHeight}px`);
		host.style.setProperty("--rail-tab-visible", shown ? "1" : "0");
		host.style.setProperty(
			"--rail-tab-duration",
			instant || !animate() ? "0ms" : "calc(240ms * var(--motion-scale))",
		);
	};

	const measure = () => {
		const element = active();
		if (!element || !content) {
			setTop(undefined);
			return;
		}
		setTop(element.offsetTop);
	};

	createEffect(() => {
		active();
		platform();
		measure();
	});

	createEffect(() => {
		top();
		animate();
		writeJoin(false);
	});

	onMount(() => {
		if (!rail) return;
		const all = Array.from(rail.querySelectorAll<HTMLElement>(FOCUSABLE));
		if (!all.some((item) => item.tabIndex === 0)) {
			const first = all[0];
			if (first) first.tabIndex = 0;
		}
		host =
			rail.closest<HTMLElement>("[data-space-rail-host]") ??
			rail.parentElement ??
			undefined;
		writeJoin(true);
		const target = host;
		onCleanup(() => {
			for (const name of RAIL_TAB_VARS) target?.style.removeProperty(name);
		});
		const observer = new ResizeObserver(() => measure());
		if (content) observer.observe(content);
		onCleanup(() => observer.disconnect());
		const frame = requestAnimationFrame(() => setAnimate(true));
		onCleanup(() => cancelAnimationFrame(frame));
	});

	return (
		<nav
			ref={rail}
			aria-label={props["aria-label"] ?? "Spaces"}
			data-space-rail=""
			data-platform={platform()}
			onKeyDown={(event) => rail && moveFocus(rail, event)}
			class={cx("relative h-full shrink-0", props.class)}
			style={{ width: `${metrics().width}px` }}
		>
			<div
				ref={scroller}
				onScroll={() => writeJoin(true)}
				data-rail-scroll=""
				class="absolute inset-y-0 left-0 overflow-x-hidden overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
				style={{
					width: `${metrics().width}px`,
					background:
						"linear-gradient(to bottom, var(--background) 91.784%, var(--card))",
				}}
			>
				<div
					ref={content}
					data-rail-content=""
					class="relative flex flex-col pb-2"
					style={{
						width: `${metrics().width}px`,
						gap: `${metrics().gap}px`,
						"padding-top": `${metrics().paddingTop}px`,
					}}
				>
					<ActiveTab
						platform={platform()}
						active={active()}
						top={top()}
						animate={animate()}
					/>
					<Show when={leading.has()}>
						<div class="relative flex flex-col items-center gap-2">
							{leading()}
							<span
								aria-hidden="true"
								data-rail-separator=""
								class="block h-px bg-popover"
								style={{ width: `${metrics().icon}px` }}
							/>
						</div>
					</Show>
					{items()}
					<Show when={props.onCreate}>
						<SpaceRailAction
							label={props.createLabel ?? "Create a Space"}
							icon={<AddIcon />}
							onClick={() => props.onCreate?.()}
						/>
					</Show>
					<Show when={props.onDiscover}>
						<SpaceRailAction
							label={props.discoverLabel ?? "Discover Spaces"}
							icon={<CompassIcon />}
							onClick={() => props.onDiscover?.()}
						/>
					</Show>
				</div>
			</div>
		</nav>
	);
};

const RailTooltip = (props: {
	label: string;
	trigger: JSX.Element;
	suppressed?: boolean;
}) => (
	<Tooltip
		placement="right"
		disabled={props.suppressed}
		open={props.suppressed ? false : undefined}
	>
		{props.trigger}
		<TooltipContent>{props.label}</TooltipContent>
	</Tooltip>
);

export type SpaceRailActionPopup = "dialog" | "menu" | "listbox";

export type SpaceRailActionProps = {
	label: string;
	icon: JSX.Element;
	onClick: () => void;
	ref?: HTMLButtonElement | ((element: HTMLButtonElement) => void);
	"aria-expanded"?: boolean;
	"aria-haspopup"?: SpaceRailActionPopup;
	"aria-controls"?: string;
	badge?: JSX.Element;
	badgeLabel?: string;
};

export const SpaceRailAction = (props: SpaceRailActionProps) => {
	const rail = useRail();
	const ripple = createRipple();
	const badge = createSlot(() => props.badge);
	const badgeLabelId = createUniqueId();
	const size = () => SPACE_RAIL_METRICS[rail?.platform() ?? "mobile"].icon;
	return (
		<div class="relative flex shrink-0 justify-center" data-rail-action="">
			<span
				class="relative flex shrink-0"
				style={{ width: `${size()}px`, height: `${size()}px` }}
			>
				<RailTooltip
					label={props.label}
					suppressed={props["aria-expanded"] === true}
					trigger={
						<TooltipTrigger
							ref={(element: HTMLButtonElement) => {
								ripple(element);
								if (typeof props.ref === "function") props.ref(element);
							}}
							type="button"
							tabIndex={-1}
							data-rail-focusable=""
							aria-label={props.label}
							aria-expanded={props["aria-expanded"]}
							aria-haspopup={props["aria-haspopup"]}
							aria-controls={props["aria-controls"]}
							aria-describedby={props.badgeLabel ? badgeLabelId : undefined}
							onClick={props.onClick}
							class="ripple relative flex size-full shrink-0 cursor-pointer items-center justify-center rounded-control border-0 bg-muted p-0 text-foreground outline-none hover:bg-accent focus-ring-inset [&>svg]:size-6"
						>
							{props.icon}
						</TooltipTrigger>
					}
				/>
				<Show when={badge.has()}>
					<span
						aria-hidden="true"
						data-rail-action-badge=""
						class="pointer-events-none absolute -right-1 -bottom-1 flex"
					>
						{badge()}
					</span>
				</Show>
			</span>
			<Show when={props.badgeLabel}>
				<span id={badgeLabelId} class="sr-only">
					{props.badgeLabel}
				</span>
			</Show>
		</div>
	);
};

export type SpaceRailItemProps = {
	name: string;
	iconSrc?: string;
	active?: boolean;
	unread?: boolean;
	mentions?: number;
	onSelect?: () => void;
	class?: string;
};

export const railPillHeight = (state: {
	active?: boolean;
	unread?: boolean;
}) => (state.active ? 0 : state.unread ? 8 : 0);

const itemLabel = (props: SpaceRailItemProps) => {
	const parts = [props.name];
	if (props.mentions && props.mentions > 0)
		parts.push(
			`${props.mentions} ${props.mentions === 1 ? "mention" : "mentions"}`,
		);
	else if (props.unread) parts.push("unread");
	return parts.join(", ");
};

export const SpaceRailItem = (props: SpaceRailItemProps) => {
	const [local] = splitProps(props, ["class"]);
	const rail = useRail();
	const ripple = createRipple();
	const platform = () => rail?.platform() ?? "mobile";
	const size = () => SPACE_RAIL_METRICS[platform()].icon;
	const inset = () => (platform() === "desktop" && props.active ? 2 : 0);
	let item: HTMLDivElement | undefined;

	createEffect(() => {
		if (props.active) rail?.setActive(item);
	});

	onCleanup(() => {
		if (props.active) rail?.setActive(undefined);
	});

	return (
		<div
			ref={item}
			data-rail-item=""
			data-state={props.active ? "active" : props.unread ? "unread" : "read"}
			class={cx("relative z-10 flex shrink-0 justify-center", local.class)}
			style={{ height: `${size()}px` }}
		>
			<span
				aria-hidden="true"
				data-rail-pill=""
				class={cx(
					"absolute top-1/2 left-0 w-1 -translate-y-1/2 rounded-r-full bg-foreground",
					"transition-[height] duration-[calc(240ms*var(--motion-scale))] ease-[cubic-bezier(0.4,0,0.2,1)]",
					"motion-reduce:transition-none reduced-motion:transition-none",
				)}
				style={{ height: `${railPillHeight(props)}px` }}
			/>
			<RailTooltip
				label={props.name}
				trigger={
					<TooltipTrigger
						ref={ripple}
						type="button"
						tabIndex={props.active ? 0 : -1}
						data-rail-focusable=""
						aria-current={props.active ? "page" : undefined}
						onClick={() => props.onSelect?.()}
						class={cx(
							"group ripple relative flex shrink-0 cursor-pointer items-center justify-center rounded-control border-0 bg-transparent outline-none",
							"transition-[padding] duration-[calc(240ms*var(--motion-scale))] ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none reduced-motion:transition-none",
							"focus-ring-inset",
						)}
						style={{
							width: `${size()}px`,
							height: `${size()}px`,
							padding: `${inset()}px`,
						}}
					>
						<span
							data-rail-icon=""
							class="relative block size-full overflow-hidden rounded-control"
						>
							<SpaceIcon
								name={props.name}
								src={props.iconSrc}
								size={48}
								class={cx(
									"size-full rounded-control",
									platform() === "desktop" && "text-sm",
								)}
							/>
							<span
								aria-hidden="true"
								class="absolute inset-0 bg-white/0 group-hover:bg-white/8 light:group-hover:bg-black/8"
							/>
						</span>
						<span class="sr-only">{itemLabel(props)}</span>
						<Show when={props.mentions && props.mentions > 0}>
							<CountBadge
								aria-hidden="true"
								data-rail-mentions=""
								count={props.mentions ?? 0}
								class="absolute -right-1 -bottom-1 shadow-[0_0_0_3px_var(--background)]"
							/>
						</Show>
					</TooltipTrigger>
				}
			/>
		</div>
	);
};
