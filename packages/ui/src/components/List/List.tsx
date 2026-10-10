import { AltArrowRightIcon } from "@solar-icons/solid/linear/alt-arrow-right";
import { ArrowRightUpIcon } from "@solar-icons/solid/linear/arrow-right-up";
import { type JSX, Show, splitProps } from "solid-js";
import { Dynamic } from "solid-js/web";
import { cx } from "../../utils/cx";
import { createRipple } from "../../utils/ripple";
import { createSlot } from "../../utils/slot";
import { Checkbox } from "../Checkbox/Checkbox";
import { Radio, RadioGroup } from "../Radio/Radio";
import { Switch } from "../Switch/Switch";
import { createSearchable, createSearchGroup } from "./settings-search";

const rowHighlight = "ripple hover:bg-secondary-highlight";

const rowFocus = "outline-none focus-ring-inset";

const groupDividers =
	"[&>*]:border-border [&>:not([hidden])~:not([hidden])]:border-t";

const forwardRowClick = (
	event: MouseEvent & { currentTarget: HTMLElement },
) => {
	const target = event.target as Element | null;
	const input = event.currentTarget.querySelector<HTMLInputElement>("input");
	if (!input || !target) return;
	if (target.closest("label, input, button, a, [data-switch-control]")) return;
	if (input.nextElementSibling?.contains(target)) return;
	input.click();
};

export type SectionLabelProps = {
	label: JSX.Element;
	count?: number;
	action?: {
		label: string;
		icon?: JSX.Element;
		onClick?: () => void;
	};
	class?: string;
	id?: string;
};

export const SectionLabel = (props: SectionLabelProps) => {
	const label = createSlot(() => props.label);
	const actionIcon = createSlot(() => props.action?.icon);

	return (
		<div
			class={cx("flex min-h-5 items-center justify-between gap-3", props.class)}
		>
			<span
				id={props.id}
				class="min-w-0 truncate text-sm font-medium text-muted-foreground"
			>
				{label()}
				<Show when={props.count !== undefined}>
					<span class="tabular-nums"> · {props.count}</span>
				</Show>
			</span>
			<Show when={props.action}>
				{(action) => (
					<button
						type="button"
						onClick={() => action().onClick?.()}
						class={cx(
							"flex shrink-0 cursor-pointer items-center gap-1 rounded-control-xs text-sm font-semibold text-primary-highlight",
							"transition-opacity duration-[calc(var(--duration-color)*var(--motion-scale))] hover:opacity-80 active:opacity-70",
							"focus-ring",
						)}
					>
						<Show when={actionIcon.has()}>
							<span class="flex size-4 items-center justify-center [&>svg]:size-4">
								{actionIcon()}
							</span>
						</Show>
						{action().label}
					</button>
				)}
			</Show>
		</div>
	);
};

export type ListGroupProps = {
	label?: JSX.Element;
	count?: number;
	action?: SectionLabelProps["action"];
	class?: string;
	children: JSX.Element;
};

export const ListGroup = (props: ListGroupProps) => {
	const label = createSlot(() => props.label);
	const search = createSearchGroup();

	return (
		<section
			ref={search.ref}
			hidden={search.hidden()}
			class={cx("flex w-full flex-col gap-2", props.class)}
		>
			<Show when={label.has()}>
				<SectionLabel
					label={label()}
					count={props.count}
					action={props.action}
				/>
			</Show>
			<div
				class={cx(
					"flex flex-col overflow-hidden rounded-control bg-secondary",
					groupDividers,
				)}
			>
				{props.children}
			</div>
		</section>
	);
};

export type NavRowProps = {
	label: JSX.Element;
	keywords?: readonly string[];
	icon?: JSX.Element;
	value?: string;
	external?: boolean;
	href?: string;
	onClick?: (event: MouseEvent) => void;
	disabled?: boolean;
	class?: string;
};

export const NavRow = (props: NavRowProps) => {
	const [local, rest] = splitProps(props, [
		"label",
		"icon",
		"value",
		"external",
		"href",
		"class",
		"keywords",
	]);
	const icon = createSlot(() => local.icon);
	const label = createSlot(() => local.label);
	const ripple = createRipple();
	const search = createSearchable(() => local.keywords);

	return (
		<Dynamic
			ref={(element: HTMLElement) => {
				ripple(element);
				search.ref(element);
			}}
			hidden={search.hidden()}
			component={local.href ? "a" : "button"}
			type={local.href ? undefined : "button"}
			href={local.href}
			target={local.href && local.external ? "_blank" : undefined}
			rel={local.href && local.external ? "noreferrer" : undefined}
			onClick={rest.onClick}
			disabled={local.href ? undefined : rest.disabled}
			class={cx(
				"flex h-10 w-full shrink-0 cursor-pointer items-center gap-2 px-3 text-left text-foreground",
				"disabled:cursor-not-allowed disabled:opacity-50",
				rowHighlight,
				rowFocus,
				local.class,
			)}
		>
			<Show when={icon.has()}>
				<span class="flex size-6 shrink-0 items-center justify-center [&>svg]:size-6">
					{icon()}
				</span>
			</Show>
			<span
				data-search-label=""
				class="min-w-0 flex-1 truncate text-sm font-semibold"
			>
				{label()}
			</span>
			<Show when={local.value}>
				{(value) => (
					<span
						class="max-w-[45%] truncate text-right text-xs font-semibold text-muted-foreground"
						title={value()}
					>
						{value()}
					</span>
				)}
			</Show>
			<span class="flex size-4 shrink-0 items-center justify-center text-muted-foreground [&>svg]:size-4">
				<Show when={local.external} fallback={<AltArrowRightIcon />}>
					<ArrowRightUpIcon />
				</Show>
			</span>
		</Dynamic>
	);
};

export type DestructiveRowProps = {
	label: JSX.Element;
	keywords?: readonly string[];
	icon?: JSX.Element;
	onClick?: (event: MouseEvent) => void;
	disabled?: boolean;
	class?: string;
};

export const DestructiveRow = (props: DestructiveRowProps) => {
	const icon = createSlot(() => props.icon);
	const label = createSlot(() => props.label);
	const ripple = createRipple();
	const search = createSearchable(() => props.keywords);

	return (
		<button
			ref={(element) => {
				ripple(element);
				search.ref(element);
			}}
			hidden={search.hidden()}
			type="button"
			onClick={(event) => props.onClick?.(event)}
			disabled={props.disabled}
			class={cx(
				"flex h-10 w-full shrink-0 cursor-pointer items-center gap-2 px-3 text-left text-destructive",
				"disabled:cursor-not-allowed disabled:opacity-50",
				rowHighlight,
				rowFocus,
				props.class,
			)}
		>
			<Show when={icon.has()}>
				<span class="flex size-6 shrink-0 items-center justify-center [&>svg]:size-6">
					{icon()}
				</span>
			</Show>
			<span
				data-search-label=""
				class="min-w-0 flex-1 truncate text-sm font-semibold"
			>
				{label()}
			</span>
		</button>
	);
};

export type ToggleRowProps = {
	title: JSX.Element;
	keywords?: readonly string[];
	description?: JSX.Element;
	icon?: JSX.Element;
	checked?: boolean;
	defaultChecked?: boolean;
	onChange?: (checked: boolean) => void;
	disabled?: boolean;
	name?: string;
	class?: string;
};

export const ToggleRow = (props: ToggleRowProps) => {
	const icon = createSlot(() => props.icon);
	const ripple = createRipple({ disabled: () => props.disabled });
	const search = createSearchable(() => props.keywords);

	return (
		<div
			ref={(element) => {
				ripple(element);
				search.ref(element);
			}}
			hidden={search.hidden()}
			onClick={forwardRowClick}
			data-list-toggle-row=""
			class={cx(
				"flex w-full shrink-0 cursor-pointer items-center gap-2 px-3 py-2",
				rowHighlight,
				props.disabled && "cursor-not-allowed hover:bg-transparent",
				props.class,
			)}
		>
			<Show when={icon.has()}>
				<span
					aria-hidden="true"
					data-toggle-row-icon=""
					class="flex size-6 shrink-0 items-center justify-center text-foreground [&>svg]:size-6"
				>
					{icon()}
				</span>
			</Show>
			<Switch
				checked={props.checked}
				defaultChecked={props.defaultChecked}
				onChange={props.onChange}
				disabled={props.disabled}
				name={props.name}
				label={<span data-search-label="">{props.title}</span>}
				description={props.description}
				class="flex min-w-0 flex-1 flex-row-reverse items-center justify-between gap-4"
			/>
		</div>
	);
};

export type RadioRowGroupProps = {
	value?: string;
	defaultValue?: string;
	onChange?: (value: string) => void;
	disabled?: boolean;
	name?: string;
	label?: JSX.Element;
	"aria-label"?: string;
	class?: string;
	children: JSX.Element;
};

export const RadioRowGroup = (props: RadioRowGroupProps) => {
	const label = createSlot(() => props.label);
	const search = createSearchGroup();

	return (
		<section
			ref={search.ref}
			hidden={search.hidden()}
			class={cx("flex w-full flex-col gap-2", props.class)}
		>
			<Show when={label.has()}>
				<SectionLabel label={label()} />
			</Show>
			<RadioGroup
				value={props.value}
				defaultValue={props.defaultValue}
				onChange={props.onChange}
				disabled={props.disabled}
				name={props.name}
				aria-label={props["aria-label"]}
				class={cx(
					"flex flex-col gap-0 overflow-hidden rounded-control bg-secondary",
					groupDividers,
				)}
			>
				{props.children}
			</RadioGroup>
		</section>
	);
};

export type RadioRowProps = {
	value: string;
	keywords?: readonly string[];
	title: JSX.Element;
	description?: JSX.Element;
	icon?: JSX.Element;
	disabled?: boolean;
	class?: string;
};

export const RadioRow = (props: RadioRowProps) => {
	const icon = createSlot(() => props.icon);
	const title = createSlot(() => props.title);
	const ripple = createRipple({ disabled: () => props.disabled });
	const search = createSearchable(() => props.keywords);

	return (
		<div
			ref={(element) => {
				ripple(element);
				search.ref(element);
			}}
			hidden={search.hidden()}
			onClick={forwardRowClick}
			class={cx(
				"flex w-full shrink-0 cursor-pointer items-center gap-2 px-3 py-2",
				rowHighlight,
				props.disabled && "cursor-not-allowed hover:bg-transparent",
				props.class,
			)}
		>
			<Show when={icon.has()}>
				<span class="flex size-6 shrink-0 items-center justify-center text-foreground [&>svg]:size-6">
					{icon()}
				</span>
			</Show>
			<Radio
				value={props.value}
				disabled={props.disabled}
				labelPosition="start"
				label={
					<span data-search-label="" class="font-semibold">
						{title()}
					</span>
				}
				description={props.description}
				class="min-w-0 flex-1 items-center justify-between gap-4"
			/>
		</div>
	);
};

export type CheckboxRowProps = {
	label: JSX.Element;
	leading?: JSX.Element;
	checked?: boolean;
	defaultChecked?: boolean;
	onChange?: (checked: boolean) => void;
	disabled?: boolean;
	name?: string;
	value?: string;
	class?: string;
};

export const CheckboxRow = (props: CheckboxRowProps) => {
	const leading = createSlot(() => props.leading);
	const label = createSlot(() => props.label);
	const ripple = createRipple({ disabled: () => props.disabled });

	return (
		<div
			ref={ripple}
			onClick={forwardRowClick}
			class={cx(
				"flex min-h-14 w-full shrink-0 cursor-pointer items-center gap-3 px-3 py-2",
				rowHighlight,
				props.disabled && "cursor-not-allowed hover:bg-transparent",
				props.class,
			)}
		>
			<Show when={leading.has()}>
				<span class="flex shrink-0 items-center justify-center">
					{leading()}
				</span>
			</Show>
			<Checkbox
				checked={props.checked}
				defaultChecked={props.defaultChecked}
				onChange={props.onChange}
				disabled={props.disabled}
				name={props.name}
				value={props.value}
				labelPosition="start"
				label={<span class="font-semibold">{label()}</span>}
				class="min-w-0 flex-1 items-center justify-between gap-4"
			/>
		</div>
	);
};

export type SidebarNavProps = {
	class?: string;
	"aria-label"?: string;
	children: JSX.Element;
};

export const SidebarNav = (props: SidebarNavProps) => (
	<nav
		aria-label={props["aria-label"]}
		class={cx("flex w-full flex-col gap-6", props.class)}
	>
		{props.children}
	</nav>
);

export type SidebarNavSectionProps = {
	label?: JSX.Element;
	class?: string;
	children: JSX.Element;
};

export const SidebarNavSection = (props: SidebarNavSectionProps) => {
	const label = createSlot(() => props.label);
	const search = createSearchGroup();

	return (
		<div
			ref={search.ref}
			hidden={search.hidden()}
			class={cx("flex flex-col gap-2", props.class)}
		>
			<Show when={label.has()}>
				<SectionLabel label={label()} />
			</Show>
			<div class="flex flex-col gap-2">{props.children}</div>
		</div>
	);
};

export type SidebarNavItemTone = "default" | "destructive";

export type SidebarNavItemProps = {
	label: JSX.Element;
	keywords?: readonly string[];
	icon?: JSX.Element;
	tone?: SidebarNavItemTone;
	active?: boolean;
	external?: boolean;
	href?: string;
	onClick?: (event: MouseEvent) => void;
	class?: string;
};

export const SidebarNavItem = (props: SidebarNavItemProps) => {
	const icon = createSlot(() => props.icon);
	const label = createSlot(() => props.label);
	const ripple = createRipple();
	const search = createSearchable(() => props.keywords);

	return (
		<Dynamic
			ref={(element: HTMLElement) => {
				ripple(element);
				search.ref(element);
			}}
			hidden={search.hidden()}
			component={props.href ? "a" : "button"}
			type={props.href ? undefined : "button"}
			href={props.href}
			target={props.href && props.external ? "_blank" : undefined}
			rel={props.href && props.external ? "noreferrer" : undefined}
			onClick={props.onClick}
			aria-current={props.active ? "page" : undefined}
			class={cx(
				"ripple flex h-8 w-full shrink-0 cursor-pointer items-center gap-1.5 rounded-control-sm pr-3 pl-1.5 text-left",
				props.tone === "destructive"
					? "text-destructive hover:bg-secondary/60"
					: "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
				"aria-[current=page]:bg-secondary aria-[current=page]:text-foreground",
				"focus-ring",
				props.class,
			)}
		>
			<Show when={icon.has()}>
				<span class="flex size-6 shrink-0 items-center justify-center [&>svg]:size-6">
					{icon()}
				</span>
			</Show>
			<span
				data-search-label=""
				class="min-w-0 flex-1 truncate text-sm font-semibold"
			>
				{label()}
			</span>
			<Show when={props.external}>
				<span class="flex size-4 shrink-0 items-center justify-center [&>svg]:size-4">
					<ArrowRightUpIcon />
				</span>
			</Show>
		</Dynamic>
	);
};
