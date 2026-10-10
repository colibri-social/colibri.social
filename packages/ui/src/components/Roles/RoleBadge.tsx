import { BoltIcon } from "@solar-icons/solid/bold/bolt";
import { BookIcon } from "@solar-icons/solid/bold/book";
import { BugIcon } from "@solar-icons/solid/bold/bug";
import { CameraIcon } from "@solar-icons/solid/bold/camera";
import { CodeIcon } from "@solar-icons/solid/bold/code";
import { CrownIcon } from "@solar-icons/solid/bold/crown";
import { CrownStarIcon } from "@solar-icons/solid/bold/crown-star";
import { CupStarIcon } from "@solar-icons/solid/bold/cup-star";
import { FireIcon } from "@solar-icons/solid/bold/fire";
import { FlagIcon } from "@solar-icons/solid/bold/flag";
import { GamepadIcon } from "@solar-icons/solid/bold/gamepad";
import { GlobeIcon } from "@solar-icons/solid/bold/globe";
import { HeartIcon } from "@solar-icons/solid/bold/heart";
import { LeafIcon } from "@solar-icons/solid/bold/leaf";
import { MagicWandIcon } from "@solar-icons/solid/bold/magic-wand";
import { MedalRibbonIcon } from "@solar-icons/solid/bold/medal-ribbon";
import { MusicNoteIcon } from "@solar-icons/solid/bold/music-note";
import { PaletteIcon } from "@solar-icons/solid/bold/palette";
import { PawIcon } from "@solar-icons/solid/bold/paw";
import { RocketIcon } from "@solar-icons/solid/bold/rocket";
import { ShieldCheckIcon } from "@solar-icons/solid/bold/shield-check";
import { ShieldStarIcon } from "@solar-icons/solid/bold/shield-star";
import { StarIcon } from "@solar-icons/solid/bold/star";
import { StarsIcon } from "@solar-icons/solid/bold/stars";
import { type JSX, Match, Show, Switch } from "solid-js";
import { Dynamic } from "solid-js/web";
import { cx } from "../../utils/cx";
import { themedColor, themedColorStyle } from "../../utils/name-color";
import { AnimatedImage } from "../AnimatedImage/AnimatedImage";
import { BadgeInfo } from "../Badge/BadgeInfo";

export const ROLE_BADGE_ICONS = [
	{ name: "shield-check", label: "Shield with check", icon: ShieldCheckIcon },
	{ name: "shield-star", label: "Shield with star", icon: ShieldStarIcon },
	{ name: "star", label: "Star", icon: StarIcon },
	{ name: "stars", label: "Sparkles", icon: StarsIcon },
	{ name: "crown", label: "Crown", icon: CrownIcon },
	{ name: "crown-star", label: "Crown with star", icon: CrownStarIcon },
	{ name: "medal-ribbon", label: "Medal", icon: MedalRibbonIcon },
	{ name: "cup-star", label: "Trophy", icon: CupStarIcon },
	{ name: "heart", label: "Heart", icon: HeartIcon },
	{ name: "bolt", label: "Bolt", icon: BoltIcon },
	{ name: "fire", label: "Fire", icon: FireIcon },
	{ name: "flag", label: "Flag", icon: FlagIcon },
	{ name: "leaf", label: "Leaf", icon: LeafIcon },
	{ name: "paw", label: "Paw", icon: PawIcon },
	{ name: "code", label: "Code", icon: CodeIcon },
	{ name: "bug", label: "Bug", icon: BugIcon },
	{ name: "palette", label: "Palette", icon: PaletteIcon },
	{ name: "music-note", label: "Music note", icon: MusicNoteIcon },
	{ name: "gamepad", label: "Gamepad", icon: GamepadIcon },
	{ name: "book", label: "Book", icon: BookIcon },
	{ name: "camera", label: "Camera", icon: CameraIcon },
	{ name: "globe", label: "Globe", icon: GlobeIcon },
	{ name: "rocket", label: "Rocket", icon: RocketIcon },
	{ name: "magic-wand", label: "Magic wand", icon: MagicWandIcon },
] as const;

export type RoleBadgeIconName = (typeof ROLE_BADGE_ICONS)[number]["name"];

export const DEFAULT_ROLE_BADGE_COLOR = "#76c4e5";

export type RoleBadgeValue =
	| { kind: "icon"; name: RoleBadgeIconName; color?: string }
	| { kind: "image"; url: string };

export type RoleIdentity = {
	id?: string;
	name: string;
	color?: string;
	badge?: RoleBadgeValue;
};

export const roleBadgeIcon = (name: string) =>
	ROLE_BADGE_ICONS.find((entry) => entry.name === name);

export const isRoleBadgeIconName = (name: string): name is RoleBadgeIconName =>
	!!roleBadgeIcon(name);

export type RoleBadgeSize = "sm" | "md" | "lg";

const sizeClass: Record<RoleBadgeSize, string> = {
	sm: "size-4",
	md: "size-5",
	lg: "size-6",
};

export const roleBadgeTint = (badge: RoleBadgeValue, roleColor?: string) =>
	badge.kind === "icon"
		? (badge.color ?? roleColor ?? DEFAULT_ROLE_BADGE_COLOR)
		: undefined;

export type RoleBadgeGlyphProps = {
	badge: RoleBadgeValue;
	roleColor?: string;
	size?: RoleBadgeSize;
	class?: string;
};

export const RoleBadgeGlyph = (props: RoleBadgeGlyphProps) => {
	const size = () => props.size ?? "sm";
	const tint = () => themedColor(roleBadgeTint(props.badge, props.roleColor));

	return (
		<span
			aria-hidden="true"
			data-role-badge-glyph={props.badge.kind}
			class={cx(
				"inline-flex shrink-0 items-center justify-center overflow-hidden",
				sizeClass[size()],
				props.badge.kind === "icon" &&
					"text-(--role-badge-dark) light:text-(--role-badge-light) [&>svg]:size-full",
				props.badge.kind === "image" && "rounded-[4px]",
				props.class,
			)}
			style={themedColorStyle("role-badge", tint())}
		>
			<Switch>
				<Match
					when={props.badge.kind === "icon" && roleBadgeIcon(props.badge.name)}
				>
					{(entry) => <Dynamic component={entry().icon} />}
				</Match>
				<Match when={props.badge.kind === "image" && props.badge.url} keyed>
					{(url) => (
						<AnimatedImage
							src={url}
							alt=""
							draggable={false}
							decoding="async"
							class="size-full object-contain"
						/>
					)}
				</Match>
			</Switch>
		</span>
	);
};

export type RoleBadgeProps = {
	role: RoleIdentity;
	size?: RoleBadgeSize;
	interactive?: boolean;
	class?: string;
};

export const RoleBadge = (props: RoleBadgeProps) => {
	const label = () => `${props.role.name} role`;
	const glyph = (badge: RoleBadgeValue) => (
		<RoleBadgeGlyph
			badge={badge}
			roleColor={props.role.color}
			size={props.size}
		/>
	);

	return (
		<Show when={props.role.badge}>
			{(badge) => (
				<Show
					when={props.interactive ?? true}
					fallback={
						<span
							role="img"
							aria-label={label()}
							title={props.role.name}
							data-role-badge=""
							class={cx("inline-flex shrink-0", props.class)}
						>
							{glyph(badge())}
						</span>
					}
				>
					<BadgeInfo
						name={props.role.name}
						description="Role"
						label={label()}
						class={cx("rounded-[4px]", props.class)}
					>
						<span data-role-badge="" class="inline-flex shrink-0">
							{glyph(badge())}
						</span>
					</BadgeInfo>
				</Show>
			)}
		</Show>
	);
};

export const RoleColorDot = (props: { color?: string; class?: string }) => (
	<span
		aria-hidden="true"
		data-role-color-dot=""
		class={cx("flex size-4 shrink-0 items-center justify-center", props.class)}
	>
		<span
			class="size-3 rounded-full bg-(--role-dot-dark) light:bg-(--role-dot-light)"
			style={themedColorStyle(
				"role-dot",
				themedColor(props.color ?? "#a1a1a1"),
			)}
		/>
	</span>
);

export type RoleMarkProps = {
	role: RoleIdentity;
	interactive?: boolean;
	class?: string;
};

export const RoleMark = (props: RoleMarkProps): JSX.Element => (
	<Show
		when={props.role.badge}
		fallback={<RoleColorDot color={props.role.color} class={props.class} />}
	>
		<RoleBadge
			role={props.role}
			interactive={props.interactive}
			class={props.class}
		/>
	</Show>
);
