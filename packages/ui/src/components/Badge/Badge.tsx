import { type JSX, Show, splitProps } from "solid-js";
import { cva, cx, type VariantProps } from "../../utils/cx";
import { createPress } from "../../utils/press";
import { createSlot } from "../../utils/slot";
import { Popover, PopoverContent, PopoverTrigger } from "../Popover/Popover";

const userBadgeBase =
	"inline-flex shrink-0 items-center rounded-badge px-1.5 font-sans font-bold whitespace-nowrap";

export const badgeVariants = cva({
	base: "inline-flex shrink-0 items-center justify-center font-sans font-bold whitespace-nowrap",
	variants: {
		variant: {
			label: cx(
				userBadgeBase,
				"bg-primary-fill text-xs leading-4 text-primary-foreground uppercase",
			),
			count:
				"h-4 min-w-4 rounded-full bg-destructive-fill px-1 text-[11px] leading-none tabular-nums text-destructive-foreground",
		},
	},
	defaultVariants: {
		variant: "label",
	},
});

export type BadgeProps = JSX.HTMLAttributes<HTMLSpanElement> &
	VariantProps<typeof badgeVariants>;

export const Badge = (props: BadgeProps) => {
	const [local, rest] = splitProps(props, ["variant", "class"]);
	return (
		<span
			{...rest}
			class={cx(badgeVariants({ variant: local.variant }), local.class)}
		/>
	);
};

export type BadgeAppearance = {
	variant: "solid" | "gradientBorder";
	colors: string[];
	foreground: string;
};

export type BadgeDefinition = {
	identifier: string;
	name: string;
	description: string;
	precedence?: number;
	appearance?: BadgeAppearance;
};

export const BOT_BADGE_DEFINITION: BadgeDefinition = {
	identifier: "bot",
	name: "BOT",
	description: "Self-declared to be automated",
	appearance: {
		variant: "solid",
		colors: ["#fafafa"],
		foreground: "#0a0a0a",
	},
};

export const TEAM_BADGE_DEFINITION: BadgeDefinition = {
	identifier: "team",
	name: "TEAM",
	description: "Official Colibri Maintainer",
	precedence: 0,
	appearance: {
		variant: "solid",
		colors: ["var(--primary-fill)"],
		foreground: "var(--primary-foreground)",
	},
};

export const FALLBACK_BADGE_DEFINITIONS: readonly BadgeDefinition[] = [
	TEAM_BADGE_DEFINITION,
	{
		identifier: "play-store-tester",
		name: "PLAY STORE TESTER",
		description: "Helped test the Colibri App for the Play Store release",
		precedence: 1,
		appearance: {
			variant: "gradientBorder",
			colors: ["#ff4d4d", "#ffcc00", "#22c55e", "#3b82f6"],
			foreground: "#ffffff",
		},
	},
	{
		identifier: "sponsor-twenty-five",
		name: "$25 SPONSOR",
		description: "Sponsors Colibri with a $25 monthly donation",
		precedence: 2,
		appearance: {
			variant: "solid",
			colors: ["#60a5fa"],
			foreground: "#000000",
		},
	},
	{
		identifier: "supporter-ten",
		name: "$10 SUPPORTER",
		description: "Supports Colibri with a $10 monthly donation",
		precedence: 3,
		appearance: {
			variant: "solid",
			colors: ["#e870df"],
			foreground: "#000000",
		},
	},
	{
		identifier: "supporter-five",
		name: "$5 SUPPORTER",
		description: "Supports Colibri with a $5 monthly donation",
		precedence: 4,
		appearance: {
			variant: "solid",
			colors: ["#22d3ee"],
			foreground: "#000000",
		},
	},
	{
		identifier: "donator",
		name: "DONATOR",
		description: "Made a donation to support Colibri",
		precedence: 5,
		appearance: {
			variant: "solid",
			colors: ["#2dd4bf"],
			foreground: "#000000",
		},
	},
];

const GRADIENT_FILL_MIX = 18;

const gradientStops = (colors: readonly string[]) =>
	colors.length === 1 ? `${colors[0]}, ${colors[0]}` : colors.join(", ");

export const badgeAppearanceStyle = (
	appearance: BadgeAppearance | undefined,
): JSX.CSSProperties | undefined => {
	if (!appearance) return undefined;
	if (appearance.variant === "gradientBorder") {
		const fill = appearance.colors.map(
			(entry) => `color-mix(in srgb, ${entry} ${GRADIENT_FILL_MIX}%, black)`,
		);
		return {
			background: `linear-gradient(90deg, ${gradientStops(fill)}) padding-box, linear-gradient(90deg, ${gradientStops(appearance.colors)}) border-box`,
			color: appearance.foreground,
		};
	}
	return {
		"background-color": appearance.colors[0],
		color: appearance.foreground,
	};
};

export type UserBadgeSize = "xs" | "sm" | "base" | "lg";

const userBadgeSizes: Record<UserBadgeSize, string> = {
	xs: "text-xs leading-4",
	sm: "text-sm leading-5",
	base: "text-base leading-6",
	lg: "text-lg leading-7",
};

export type UserBadgeProps = {
	definition: BadgeDefinition;
	size?: UserBadgeSize;
	describe?: boolean;
	class?: string;
};

export const UserBadge = (props: UserBadgeProps) => {
	const appearance = () => props.definition.appearance;
	const face = (extra?: string) => (
		<span
			data-user-badge={props.definition.identifier}
			class={cx(
				userBadgeBase,
				userBadgeSizes[props.size ?? "xs"],
				!appearance() && "bg-muted text-foreground",
				appearance()?.variant === "gradientBorder" &&
					"rounded-full border border-transparent",
				extra,
			)}
			style={badgeAppearanceStyle(appearance())}
		>
			{props.definition.name}
		</span>
	);

	return (
		<Show
			when={(props.describe ?? true) && props.definition.description}
			fallback={face(props.class)}
		>
			{(description) => (
				<Popover placement="top" gutter={4}>
					<PopoverTrigger
						as="span"
						class={cx(
							"inline-flex shrink-0 cursor-pointer rounded-badge outline-none focus-visible:shadow-[0_0_0_2px_var(--primary)]",
							props.class,
						)}
						onClick={(event: MouseEvent) => event.stopPropagation()}
					>
						{face()}
					</PopoverTrigger>
					<PopoverContent class="w-fit max-w-64 px-3 py-1.5 text-xs">
						{description()}
					</PopoverContent>
				</Popover>
			)}
		</Show>
	);
};

export type BotBadgeProps = Omit<UserBadgeProps, "definition">;

export const BotBadge = (props: BotBadgeProps) => (
	<UserBadge {...props} definition={BOT_BADGE_DEFINITION} />
);

export type TeamBadgeProps = Omit<UserBadgeProps, "definition">;

export const TeamBadge = (props: TeamBadgeProps) => (
	<UserBadge {...props} definition={TEAM_BADGE_DEFINITION} />
);

export type CountBadgeProps = Omit<BadgeProps, "variant" | "children"> & {
	count: number;
	max?: number;
};

export const CountBadge = (props: CountBadgeProps) => {
	const [local, rest] = splitProps(props, ["count", "max"]);
	const max = () => local.max ?? 99;
	return (
		<Show when={local.count > 0}>
			<Badge {...rest} variant="count">
				{local.count > max() ? `${max()}+` : local.count}
			</Badge>
		</Show>
	);
};

export type ChipProps = JSX.HTMLAttributes<HTMLSpanElement> & {
	icon?: JSX.Element;
};

export const Chip = (props: ChipProps) => {
	const [local, rest] = splitProps(props, ["icon", "class", "children"]);
	const icon = createSlot(() => local.icon);
	return (
		<span
			{...rest}
			class={cx(
				"inline-flex h-6 max-w-full shrink-0 items-center gap-1 rounded-control-xs bg-muted px-1",
				"font-sans text-sm leading-6 font-semibold text-foreground",
				local.class,
			)}
		>
			<Show when={icon.has()}>
				<span class="flex size-4 shrink-0 items-center justify-center [&>svg]:size-4">
					{icon()}
				</span>
			</Show>
			<span
				class="truncate pr-0.5"
				title={typeof local.children === "string" ? local.children : undefined}
			>
				{local.children}
			</span>
		</span>
	);
};

export type MentionKind = "user" | "unknown" | "bridged" | "role";

export type MentionChipProps = JSX.HTMLAttributes<HTMLSpanElement> & {
	kind?: MentionKind;
	roleColor?: string;
	platform?: string;
};

const mentionVariants = cva({
	base: [
		"rounded-[2px] px-0.5 [box-decoration-break:clone] [-webkit-box-decoration-break:clone]",
		"underline decoration-transparent decoration-1 [text-underline-position:from-font] [text-decoration-skip-ink:auto]",
	],
	variants: {
		kind: {
			user: "bg-[color-mix(in_srgb,var(--primary)_25%,transparent)] text-[color-mix(in_srgb,var(--primary)_35%,var(--foreground))]",
			unknown:
				"bg-[color-mix(in_srgb,var(--primary)_15%,transparent)] text-[color-mix(in_srgb,var(--primary)_35%,var(--foreground))]",
			bridged:
				"bg-[color-mix(in_srgb,var(--primary)_25%,transparent)] text-[color-mix(in_srgb,var(--primary)_35%,var(--foreground))]",
			role: "bg-[color-mix(in_srgb,var(--mention-color)_15%,transparent)] text-(--mention-color)",
		},
		interactive: {
			true: "cursor-pointer hover:decoration-current data-pressed:decoration-current",
			false: "",
		},
	},
	compoundVariants: [
		{
			kind: "user",
			interactive: true,
			class:
				"hover:bg-[color-mix(in_srgb,var(--primary)_35%,transparent)] data-pressed:bg-[color-mix(in_srgb,var(--primary)_35%,transparent)]",
		},
		{
			kind: "unknown",
			interactive: true,
			class:
				"hover:bg-[color-mix(in_srgb,var(--primary)_25%,transparent)] data-pressed:bg-[color-mix(in_srgb,var(--primary)_25%,transparent)]",
		},
		{
			kind: "role",
			interactive: true,
			class:
				"hover:bg-[color-mix(in_srgb,var(--mention-color)_25%,transparent)] data-pressed:bg-[color-mix(in_srgb,var(--mention-color)_25%,transparent)]",
		},
	],
});

export const MentionChip = (props: MentionChipProps) => {
	const [local, rest] = splitProps(props, [
		"class",
		"kind",
		"roleColor",
		"platform",
		"style",
		"onPointerDown",
		"onPointerUp",
		"onPointerLeave",
		"onPointerCancel",
	]);
	const kind = () => local.kind ?? "user";
	const interactive = () =>
		kind() === "role" ? !!local.roleColor : kind() !== "bridged";
	const { pressed, pressProps } = createPress({
		disabled: () => !interactive(),
		handlers: {
			onPointerDown: local.onPointerDown,
			onPointerUp: local.onPointerUp,
			onPointerLeave: local.onPointerLeave,
			onPointerCancel: local.onPointerCancel,
		},
	});

	return (
		<span
			{...rest}
			onPointerDown={pressProps.onPointerDown}
			onPointerUp={pressProps.onPointerUp}
			onPointerLeave={pressProps.onPointerLeave}
			onPointerCancel={pressProps.onPointerCancel}
			data-pressed={pressed() || undefined}
			data-mention-kind={kind()}
			title={
				kind() === "bridged" && local.platform
					? `On ${local.platform}`
					: rest.title
			}
			style={{
				"--mention-color": local.roleColor ?? "currentColor",
				...(typeof local.style === "object" ? local.style : {}),
			}}
			class={cx(
				mentionVariants({ kind: kind(), interactive: interactive() }),
				local.class,
			)}
		/>
	);
};
