import {
	type Accessor,
	createContext,
	createSignal,
	For,
	type JSX,
	Show,
	splitProps,
	useContext,
} from "solid-js";
import { cx } from "../../utils/cx";
import { useHaptics } from "../../utils/haptics";
import { createRipple } from "../../utils/ripple";
import { createSlot } from "../../utils/slot";

export type TabBarBadge = "dot";

export type TabBarItemData = {
	value: string;
	label: string;
	icon: JSX.Element;
	badge?: TabBarBadge;
	badgeLabel?: string;
};

type TabBarContextValue = {
	value: Accessor<string | undefined>;
	select: (value: string) => void;
};

const TabBarContext = createContext<TabBarContextValue>();

const useTabBar = () => {
	const context = useContext(TabBarContext);
	if (!context) throw new Error("TabBarItem must be used inside a TabBar");
	return context;
};

export type TabBarProps = Omit<
	JSX.HTMLAttributes<HTMLElement>,
	"onChange" | "children"
> & {
	label?: string;
	value?: string;
	defaultValue?: string;
	onChange?: (value: string) => void;
	items?: TabBarItemData[];
	children?: JSX.Element;
};

export const TabBar = (props: TabBarProps) => {
	const [local, rest] = splitProps(props, [
		"label",
		"value",
		"defaultValue",
		"onChange",
		"items",
		"children",
		"class",
	]);
	const haptics = useHaptics();
	const [uncontrolled, setUncontrolled] = createSignal(local.defaultValue);
	const value = () =>
		local.value !== undefined ? local.value : uncontrolled();

	const select = (next: string) => {
		if (next === value()) return;
		haptics.selection();
		setUncontrolled(next);
		local.onChange?.(next);
	};

	return (
		<TabBarContext.Provider value={{ value, select }}>
			<div
				data-tab-bar-container=""
				class={cx(
					"pointer-events-none fixed inset-x-0 bottom-0 z-40 bg-linear-to-b from-transparent to-background px-safe-offset-2 pt-4 pb-safe-offset-2",
					local.class,
				)}
			>
				<nav
					{...rest}
					aria-label={local.label ?? "Main"}
					class="pointer-events-auto flex h-12 gap-1 rounded-[calc(var(--radius-control)+3px)] border border-border bg-popover p-[3px] shadow-[0_4px_4px_rgb(0_0_0/0.25)]"
				>
					<Show when={local.items} fallback={local.children}>
						{(items) => (
							<For each={items()}>
								{(item) => (
									<TabBarItem
										value={item.value}
										label={item.label}
										icon={item.icon}
										badge={item.badge}
										badgeLabel={item.badgeLabel}
									/>
								)}
							</For>
						)}
					</Show>
				</nav>
			</div>
		</TabBarContext.Provider>
	);
};

export type TabBarItemProps = Omit<
	JSX.ButtonHTMLAttributes<HTMLButtonElement>,
	"value" | "children"
> &
	TabBarItemData;

export const TabBarItem = (props: TabBarItemProps) => {
	const [local, rest] = splitProps(props, [
		"value",
		"label",
		"icon",
		"badge",
		"badgeLabel",
		"class",
		"onClick",
		"ref",
	]);
	const tabBar = useTabBar();
	const icon = createSlot(() => local.icon);
	const active = () => tabBar.value() === local.value;
	const ripple = createRipple({ disabled: () => rest.disabled });
	const ref = (element: HTMLButtonElement) => {
		ripple(element);
		const forwarded = local.ref;
		if (typeof forwarded === "function") forwarded(element);
	};

	const onClick: JSX.EventHandler<HTMLButtonElement, MouseEvent> = (event) => {
		const handler = local.onClick;
		if (typeof handler === "function") handler(event);
		else if (handler) handler[0](handler[1], event);
		if (!event.defaultPrevented) tabBar.select(local.value);
	};

	return (
		<button
			type="button"
			{...rest}
			ref={ref}
			onClick={onClick}
			aria-current={active() ? "page" : undefined}
			data-active={active() || undefined}
			data-icon-host=""
			class={cx(
				"focus-ring ripple flex min-w-0 flex-1 cursor-pointer flex-col items-center justify-center rounded-control p-1 text-muted-foreground",
				"touch-manipulation select-none data-active:text-foreground",
				"[transition:color_calc(var(--duration-color)*var(--motion-scale))_var(--ease-out-quick)]",
				"disabled:cursor-not-allowed disabled:opacity-50",
				local.class,
			)}
		>
			<span
				aria-hidden="true"
				data-tab-bar-pill=""
				class={cx(
					"absolute inset-0 z-[-1] rounded-[inherit] bg-muted",
					"[transition:opacity_calc(var(--duration-color)*var(--motion-scale))_var(--ease-out-quick)]",
					active() ? "opacity-100" : "opacity-0",
				)}
			/>
			<span data-ripple-layer="" aria-hidden="true" />
			<span class="relative flex size-5 items-center justify-center [&_svg]:size-5">
				{icon()}
				<Show when={local.badge === "dot"}>
					<span
						aria-hidden="true"
						data-tab-bar-badge="dot"
						class="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-destructive ring-2 ring-popover"
					/>
				</Show>
			</span>
			<span class="relative truncate text-xs leading-none font-semibold">
				{local.label}
			</span>
			<Show when={local.badge === "dot"}>
				<span class="sr-only">{`, ${local.badgeLabel ?? "new activity"}`}</span>
			</Show>
		</button>
	);
};
