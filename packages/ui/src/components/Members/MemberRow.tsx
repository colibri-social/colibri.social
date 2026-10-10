import { CrownIcon } from "@solar-icons/solid/bold/crown";
import { type JSX, Show, splitProps } from "solid-js";
import { Dynamic } from "solid-js/web";
import { cx } from "../../utils/cx";
import {
	nameColorClass,
	nameColorStyle,
	useNameColor,
} from "../../utils/name-color";
import { createRipple } from "../../utils/ripple";
import { createSlot } from "../../utils/slot";
import { isStatusVisible } from "../../utils/status-visibility";
import { Avatar, type AvatarSize, type Presence } from "../Avatar/Avatar";
import { BotBadge } from "../Badge/Badge";
import { RoleBadge, type RoleIdentity } from "../Roles/RoleBadge";

export type MemberRowVariant = "mobile" | "desktop";

export type MemberRowProps = {
	name: string;
	avatarSrc?: string;
	avatarColor?: string;
	presence?: Presence;
	status?: JSX.Element;
	statusShowWhileOffline?: boolean;
	role?: RoleIdentity;
	bot?: boolean;
	owner?: boolean;
	badge?: JSX.Element;
	offline?: boolean;
	variant?: MemberRowVariant;
	onOpen?: JSX.EventHandler<HTMLElement, MouseEvent>;
	onContextMenu?: JSX.EventHandler<HTMLElement, MouseEvent>;
	class?: string;
	"aria-label"?: string;
};

const ringColor: Record<MemberRowVariant, string> = {
	mobile: "var(--secondary)",
	desktop: "var(--card)",
};

export const memberRowBase =
	"flex w-full shrink-0 items-center gap-3 text-left";

export const memberRowShape: Record<MemberRowVariant, string> = {
	mobile: "h-14 p-2",
	desktop: "h-11 rounded-control-lg py-1.5 pr-2 pl-1.5",
};

export const memberAvatarSize = {
	mobile: "md",
	desktop: "base",
} as const satisfies Record<MemberRowVariant, AvatarSize>;

export const MemberRow = (props: MemberRowProps) => {
	const [local, rest] = splitProps(props, [
		"name",
		"avatarSrc",
		"avatarColor",
		"presence",
		"status",
		"statusShowWhileOffline",
		"role",
		"bot",
		"owner",
		"badge",
		"offline",
		"variant",
		"onOpen",
		"class",
	]);
	const variant = () => local.variant ?? "desktop";
	const status = createSlot(() => local.status);
	const badge = createSlot(() => local.badge);
	const ripple = createRipple();
	const interactive = () => !!local.onOpen;
	const nameColor = useNameColor(() => ({
		roleColor: local.role?.color,
		context: "member-list",
	}));
	const presence = (): Presence | undefined =>
		local.offline ? "offline" : local.presence;
	const statusVisible = () =>
		status.has() &&
		isStatusVisible({
			presence: presence(),
			showWhileOffline: local.statusShowWhileOffline,
		});

	return (
		<Dynamic
			{...rest}
			component={interactive() ? "button" : "div"}
			type={interactive() ? "button" : undefined}
			ref={(element: HTMLElement) => {
				if (interactive()) ripple(element);
			}}
			onClick={local.onOpen}
			data-member-row=""
			data-offline={local.offline || undefined}
			class={cx(
				memberRowBase,
				memberRowShape[variant()],
				"text-foreground",
				interactive() &&
					cx(
						"ripple cursor-pointer outline-none focus-ring-inset",
						variant() === "mobile"
							? "hover:bg-secondary-highlight"
							: "hover:bg-popover",
					),
				local.class,
			)}
			style={{ "--avatar-ring": ringColor[variant()] }}
		>
			<Avatar
				size={memberAvatarSize[variant()]}
				name={local.name}
				src={local.avatarSrc}
				color={local.avatarColor}
				presence={presence()}
				class={cx(local.offline && "opacity-50")}
			/>
			<span class="flex min-w-0 flex-1 flex-col">
				<span class="flex min-w-0 items-center gap-1">
					<span
						data-member-name=""
						class={cx(
							"truncate text-base leading-5 font-semibold",
							local.offline
								? "text-muted-foreground"
								: nameColor() && nameColorClass,
						)}
						style={local.offline ? undefined : nameColorStyle(nameColor())}
					>
						{local.name}
					</span>
					<Show when={local.role?.badge && local.role}>
						{(role) => (
							<RoleBadge
								role={role()}
								interactive={!interactive()}
								class={cx(local.offline && "opacity-50")}
							/>
						)}
					</Show>
					<Show when={local.owner}>
						<span
							role="img"
							aria-label="Owner"
							class="flex size-4 shrink-0 items-center justify-center text-warning [&>svg]:size-4"
						>
							<CrownIcon />
						</span>
					</Show>
					<Show when={local.bot}>
						<BotBadge describe={false} />
					</Show>
					<Show when={badge.has()}>{badge()}</Show>
				</span>
				<Show when={statusVisible()}>
					<span class="truncate text-xs leading-4 text-muted-foreground">
						{status()}
					</span>
				</Show>
			</span>
		</Dynamic>
	);
};
