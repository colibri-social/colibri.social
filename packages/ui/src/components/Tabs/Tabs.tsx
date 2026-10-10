import { Tabs as KobalteTabs } from "@kobalte/core/tabs";
import { type JSX, type ParentProps, splitProps } from "solid-js";
import { cx } from "../../utils/cx";

export type TabsOrientation = "horizontal" | "vertical";

export type TabsProps = ParentProps<{
	value?: string;
	defaultValue?: string;
	onChange?: (value: string) => void;
	orientation?: TabsOrientation;
	activationMode?: "automatic" | "manual";
	class?: string;
}>;

export const Tabs = (props: TabsProps) => {
	const [local, rest] = splitProps(props, ["class", "orientation"]);
	return (
		<KobalteTabs
			{...rest}
			orientation={local.orientation ?? "horizontal"}
			class={cx(
				"flex min-h-0 flex-col data-[orientation=vertical]:flex-row",
				local.class,
			)}
		/>
	);
};

export type TabsListProps = ParentProps<{
	class?: string;
	"aria-label"?: string;
}>;

const indicatorMotion =
	"transition-[transform,width,height] duration-[calc(220ms*var(--motion-scale))] ease-(--ease-out-quick)";

export const TabsList = (props: TabsListProps) => {
	const [local, rest] = splitProps(props, ["class", "children"]);
	return (
		<KobalteTabs.List
			{...rest}
			data-tabs-list=""
			class={cx(
				"group/tabs relative flex shrink-0",
				"data-[orientation=horizontal]:gap-1 data-[orientation=horizontal]:overflow-x-auto data-[orientation=horizontal]:overscroll-x-contain data-[orientation=horizontal]:border-b data-[orientation=horizontal]:border-border data-[orientation=horizontal]:[scrollbar-width:none]",
				"data-[orientation=vertical]:flex-col data-[orientation=vertical]:gap-0.5 data-[orientation=vertical]:overflow-y-auto",
				local.class,
			)}
		>
			{local.children}
			<KobalteTabs.Indicator
				data-tabs-indicator=""
				class={cx(
					"pointer-events-none absolute",
					indicatorMotion,
					"group-data-[orientation=horizontal]/tabs:bottom-0 group-data-[orientation=horizontal]/tabs:left-0 group-data-[orientation=horizontal]/tabs:h-0.5 group-data-[orientation=horizontal]/tabs:rounded-full group-data-[orientation=horizontal]/tabs:bg-primary",
					"group-data-[orientation=vertical]/tabs:hidden",
				)}
			/>
		</KobalteTabs.List>
	);
};

export type TabsTriggerProps = ParentProps<{
	value: string;
	disabled?: boolean;
	class?: string;
	"aria-label"?: string;
	onPointerDown?: JSX.EventHandler<HTMLButtonElement, PointerEvent>;
}>;

export const TabsTrigger = (props: TabsTriggerProps) => {
	const [local, rest] = splitProps(props, ["class"]);
	return (
		<KobalteTabs.Trigger
			{...rest}
			class={cx(
				"relative z-[1] inline-flex shrink-0 cursor-pointer items-center gap-1.5 text-sm font-semibold whitespace-nowrap text-muted-foreground outline-none select-none",
				"hover:text-foreground data-[selected]:text-foreground",
				"focus-ring-inset",
				"disabled:cursor-not-allowed disabled:opacity-50",
				"[&_svg]:size-4 [&_svg]:shrink-0",
				"group-data-[orientation=horizontal]/tabs:h-10 group-data-[orientation=horizontal]/tabs:rounded-t-control-xs group-data-[orientation=horizontal]/tabs:px-3",
				"group-data-[orientation=vertical]/tabs:h-9 group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:rounded-control-sm group-data-[orientation=vertical]/tabs:px-2.5",
				"group-data-[orientation=vertical]/tabs:transition-[background-color] group-data-[orientation=vertical]/tabs:duration-[calc(160ms*var(--motion-scale))] group-data-[orientation=vertical]/tabs:ease-(--ease-out-quick)",
				"group-data-[orientation=vertical]/tabs:data-[selected]:bg-secondary",
				local.class,
			)}
		/>
	);
};

export type TabsContentProps = ParentProps<{
	value: string;
	class?: string;
	forceMount?: boolean;
}>;

export const TabsContent = (props: TabsContentProps) => {
	const [local, rest] = splitProps(props, ["class"]);
	return (
		<KobalteTabs.Content
			{...rest}
			class={cx(
				"flex min-h-0 min-w-0 flex-1 flex-col outline-none focus-ring-inset",
				local.class,
			)}
		/>
	);
};
