import { AddIcon } from "@solar-icons/solid/bold/add";
import { SettingsIcon } from "@solar-icons/solid/bold/settings";
import { createSignal, createUniqueId, type JSX, Show } from "solid-js";
import { AnimatedCaretIcon } from "../../icons/animated/navigation";
import { cx } from "../../utils/cx";
import { createSlot } from "../../utils/slot";

export type CategoryHeaderProps = {
	name: string;
	collapsed?: boolean;
	onToggle?: () => void;
	onCreateChannel?: () => void;
	onOpenSettings?: () => void;
	controls?: string;
	trailing?: JSX.Element;
	class?: string;
};

const headerAction =
	"flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-control-xs border-0 bg-transparent p-0 text-muted-foreground opacity-0 outline-none group-hover/category:opacity-100 hover:bg-secondary-highlight hover:text-foreground focus-visible:opacity-100 focus-ring [&>svg]:size-4";

export const CategoryHeader = (props: CategoryHeaderProps) => (
	<div
		data-category-header=""
		class={cx("group/category flex w-full items-center gap-1", props.class)}
	>
		<button
			type="button"
			aria-expanded={!props.collapsed}
			aria-controls={props.controls}
			onClick={() => props.onToggle?.()}
			class="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-control-xs border-0 bg-transparent px-2 py-1 text-left text-xs leading-4 text-muted-foreground outline-none hover:text-foreground focus-ring"
		>
			<AnimatedCaretIcon open={!props.collapsed} size={16} class="shrink-0" />
			<span class="min-w-0 truncate">{props.name}</span>
		</button>
		<Show when={props.onCreateChannel}>
			<button
				type="button"
				aria-label={`Create channel in ${props.name}`}
				onClick={() => props.onCreateChannel?.()}
				class={headerAction}
			>
				<AddIcon />
			</button>
		</Show>
		<Show when={props.onOpenSettings}>
			<button
				type="button"
				aria-label={`Settings for ${props.name}`}
				onClick={() => props.onOpenSettings?.()}
				class={headerAction}
			>
				<SettingsIcon />
			</button>
		</Show>
		{props.trailing}
	</div>
);

export type ChannelCategoryProps = Omit<
	CategoryHeaderProps,
	"collapsed" | "onToggle" | "controls"
> & {
	collapsed?: boolean;
	defaultCollapsed?: boolean;
	onCollapsedChange?: (collapsed: boolean) => void;
	headerTrailing?: JSX.Element;
	instant?: boolean;
	children?: JSX.Element;
};

export const ChannelCategory = (props: ChannelCategoryProps) => {
	const listId = `category-${createUniqueId()}`;
	const [inner, setInner] = createSignal(props.defaultCollapsed ?? false);
	const collapsed = () => props.collapsed ?? inner();
	const rows = createSlot(() => props.children);

	const toggle = () => {
		const next = !collapsed();
		setInner(next);
		props.onCollapsedChange?.(next);
	};

	return (
		<section
			data-category=""
			data-collapsed={collapsed() || undefined}
			aria-label={props.name}
			class={cx("flex w-full flex-col p-2", props.class)}
		>
			<CategoryHeader
				name={props.name}
				collapsed={collapsed()}
				onToggle={toggle}
				onCreateChannel={props.onCreateChannel}
				onOpenSettings={props.onOpenSettings}
				controls={listId}
				trailing={props.headerTrailing}
			/>
			<div
				class={cx(
					"grid",
					props.instant
						? "transition-none"
						: "transition-[grid-template-rows] duration-[calc(var(--duration-overlay-in,360ms)*var(--motion-scale))] ease-(--ease-overlay-in) motion-reduce:transition-none reduced-motion:transition-none",
					collapsed() ? "grid-rows-[0fr]" : "grid-rows-[1fr]",
				)}
			>
				<div
					id={listId}
					inert={collapsed() || undefined}
					data-category-rows=""
					class={cx(
						"flex min-h-0 flex-col gap-2",
						props.instant && !collapsed()
							? "overflow-visible"
							: "overflow-hidden",
						collapsed()
							? cx(
									"invisible",
									!props.instant &&
										"transition-[visibility] delay-[calc(var(--duration-overlay-in,360ms)*var(--motion-scale))] duration-0 motion-reduce:delay-0 reduced-motion:delay-0",
								)
							: "visible",
					)}
				>
					<span aria-hidden="true" class="h-0 shrink-0" />
					{rows()}
				</div>
			</div>
		</section>
	);
};
