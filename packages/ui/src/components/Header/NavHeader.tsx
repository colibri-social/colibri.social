import { CloseIcon } from "@solar-icons/solid/bold/close";
import { ArrowLeftIcon } from "@solar-icons/solid/linear/arrow-left";
import { type JSX, Show, splitProps } from "solid-js";
import { cx } from "../../utils/cx";
import { createSlot } from "../../utils/slot";
import { Button } from "../Button/Button";
import { IconButton } from "../IconButton/IconButton";

export type NavHeaderKind = "back" | "close";

export type NavHeaderAction =
	| {
			type: "text";
			label: string;
			onClick?: () => void;
			disabled?: boolean;
			loading?: boolean;
	  }
	| {
			type: "icon";
			label: string;
			icon: JSX.Element;
			onClick?: () => void;
			disabled?: boolean;
	  };

export type NavHeaderProps = {
	title?: JSX.Element;
	kind?: NavHeaderKind;
	onNavigate?: () => void;
	navigateLabel?: string;
	action?: NavHeaderAction;
	class?: string;
	titleId?: string;
	safeTop?: boolean;
};

export const NavHeaderActionButton = (props: { action: NavHeaderAction }) => (
	<Show
		when={props.action.type === "text" ? props.action : undefined}
		fallback={
			<IconButton
				variant="ghost"
				size="md"
				label={props.action.label}
				icon={props.action.type === "icon" ? props.action.icon : undefined}
				disabled={props.action.disabled}
				onClick={() => props.action.onClick?.()}
			/>
		}
	>
		{(text) => (
			<Button
				variant="tertiary"
				class="px-3 text-primary-highlight enabled:hover:bg-primary-highlight/10 data-pressed:bg-primary-highlight/10"
				disabled={text().disabled}
				loading={text().loading}
				onClick={() => text().onClick?.()}
			>
				{text().label}
			</Button>
		)}
	</Show>
);

export const NavHeader = (props: NavHeaderProps) => {
	const [local, rest] = splitProps(props, [
		"title",
		"kind",
		"onNavigate",
		"navigateLabel",
		"action",
		"class",
		"titleId",
		"safeTop",
	]);
	const title = createSlot(() => local.title);
	const kind = () => local.kind ?? "back";

	return (
		<header
			{...rest}
			class={cx(
				"flex h-12 shrink-0 items-center gap-2 bg-background p-2 text-foreground",
				local.safeTop &&
					"h-[calc(48px+var(--safe-area-top,0px))] pt-safe-offset-2 pr-safe-offset-2 pl-safe-offset-2",
				local.class,
			)}
		>
			<Show when={local.onNavigate}>
				<IconButton
					variant="ghost"
					size="md"
					label={local.navigateLabel ?? (kind() === "close" ? "Close" : "Back")}
					icon={kind() === "close" ? <CloseIcon /> : <ArrowLeftIcon />}
					onClick={() => local.onNavigate?.()}
					class="[&_svg]:size-6"
				/>
			</Show>
			<Show when={title.has()} fallback={<span class="flex-1" />}>
				<h1
					id={local.titleId}
					class={cx(
						"m-0 min-w-0 flex-1 truncate text-xl leading-tight font-bold",
						!local.onNavigate && "pl-2",
					)}
				>
					{title()}
				</h1>
			</Show>
			<Show when={local.action}>
				{(action) => <NavHeaderActionButton action={action()} />}
			</Show>
		</header>
	);
};
