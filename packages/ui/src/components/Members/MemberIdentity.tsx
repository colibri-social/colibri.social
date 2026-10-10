import { CrownIcon } from "@solar-icons/solid/bold/crown";
import { type JSX, Show } from "solid-js";
import { cx } from "../../utils/cx";
import {
	nameColorClass,
	nameColorStyle,
	useNameColor,
} from "../../utils/name-color";
import { createSlot } from "../../utils/slot";
import { Avatar, type AvatarSize, type Presence } from "../Avatar/Avatar";
import { BotBadge } from "../Badge/Badge";
import { RoleBadge, type RoleIdentity } from "../Roles/RoleBadge";

export type MemberIdentityData = {
	id: string;
	name: string;
	handle?: string;
	avatarSrc?: string;
	avatarColor?: string;
	presence?: Presence;
	role?: RoleIdentity;
	bot?: boolean;
	owner?: boolean;
	badge?: JSX.Element;
};

export type MemberIdentityProps = {
	member: MemberIdentityData;
	avatarSize?: AvatarSize;
	showHandle?: boolean;
	class?: string;
};

export const memberHandleLabel = (handle: string) =>
	handle.startsWith("@") ? handle : `@${handle}`;

export const MemberNameLine = (props: {
	member: MemberIdentityData;
	class?: string;
}) => {
	const badge = createSlot(() => props.member.badge);
	const nameColor = useNameColor(() => ({
		roleColor: props.member.role?.color,
		context: "member-list",
	}));

	return (
		<span class={cx("flex min-w-0 items-center gap-1", props.class)}>
			<span
				data-member-name=""
				class={cx(
					"truncate text-base leading-5 font-semibold",
					nameColor() && nameColorClass,
				)}
				style={nameColorStyle(nameColor())}
			>
				{props.member.name}
			</span>
			<Show when={props.member.role?.badge && props.member.role}>
				{(role) => <RoleBadge role={role()} interactive={false} />}
			</Show>
			<Show when={props.member.owner}>
				<span
					role="img"
					aria-label="Owner"
					class="flex size-4 shrink-0 items-center justify-center text-warning [&>svg]:size-4"
				>
					<CrownIcon />
				</span>
			</Show>
			<Show when={props.member.bot}>
				<BotBadge describe={false} />
			</Show>
			<Show when={badge.has()}>{badge()}</Show>
		</span>
	);
};

export const MemberIdentity = (props: MemberIdentityProps) => (
	<span
		data-member-identity=""
		class={cx("flex min-w-0 items-center gap-3", props.class)}
	>
		<Avatar
			size={props.avatarSize ?? "md"}
			name={props.member.name}
			seed={props.member.id}
			src={props.member.avatarSrc}
			color={props.member.avatarColor}
			presence={props.member.presence}
		/>
		<span class="flex min-w-0 flex-1 flex-col">
			<MemberNameLine member={props.member} />
			<Show when={(props.showHandle ?? true) && props.member.handle}>
				{(handle) => (
					<span class="truncate text-xs leading-4 text-muted-foreground select-text">
						{memberHandleLabel(handle())}
					</span>
				)}
			</Show>
		</span>
	</span>
);
