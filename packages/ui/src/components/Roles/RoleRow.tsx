import { LockKeyholeMinimalisticIcon } from "@solar-icons/solid/bold/lock-keyhole-minimalistic";
import { AltArrowRightIcon } from "@solar-icons/solid/linear/alt-arrow-right";
import { type JSX, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { createRipple } from "../../utils/ripple";
import { createSlot } from "../../utils/slot";
import {
	RoleBadgeGlyph,
	type RoleBadgeValue,
	RoleColorDot,
	type RoleIdentity,
	RoleMark,
} from "./RoleBadge";

const roleRowClass = cx(
	"ripple flex h-10 w-full shrink-0 cursor-pointer items-center gap-2 px-3 text-left text-foreground hover:bg-secondary-highlight",
	"outline-none focus-ring-inset disabled:cursor-not-allowed disabled:opacity-50",
);

const Chevron = () => (
	<span
		aria-hidden="true"
		class="flex size-4 shrink-0 items-center justify-center text-muted-foreground [&>svg]:size-4"
	>
		<AltArrowRightIcon />
	</span>
);

export const roleMemberCountLabel = (count: number) =>
	count === 1 ? "1 member" : `${count} members`;

const MemberCount = (props: { count?: number }) => (
	<Show when={props.count !== undefined}>
		<span
			data-role-member-count=""
			class="shrink-0 text-xs font-semibold text-muted-foreground tabular-nums"
		>
			{roleMemberCountLabel(props.count ?? 0)}
		</span>
	</Show>
);

export type RoleRowProps = {
	role: RoleIdentity;
	memberCount?: number;
	onClick?: (event: MouseEvent) => void;
	disabled?: boolean;
	class?: string;
};

export const RoleRow = (props: RoleRowProps) => {
	const ripple = createRipple();
	return (
		<button
			ref={ripple}
			type="button"
			data-role-row=""
			disabled={props.disabled}
			onClick={(event) => props.onClick?.(event)}
			class={cx(roleRowClass, props.class)}
		>
			<Show
				when={props.role.badge}
				fallback={<RoleColorDot color={props.role.color} />}
			>
				{(badge) => (
					<RoleBadgeGlyph badge={badge()} roleColor={props.role.color} />
				)}
			</Show>
			<span class="min-w-0 flex-1 truncate text-sm font-semibold">
				{props.role.name}
			</span>
			<MemberCount count={props.memberCount} />
			<Chevron />
		</button>
	);
};

export type LockedRoleRowProps = {
	role: RoleIdentity;
	memberCount?: number;
	lockLabel: string;
	class?: string;
};

export const LockedRoleRow = (props: LockedRoleRowProps) => (
	<div
		data-role-row=""
		data-locked=""
		class={cx(
			"flex h-10 w-full items-center gap-2 px-3 text-muted-foreground",
			props.class,
		)}
	>
		<RoleMark role={props.role} interactive={false} />
		<span class="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
			{props.role.name}
		</span>
		<MemberCount count={props.memberCount} />
		<span
			role="img"
			aria-label={props.lockLabel}
			title={props.lockLabel}
			class="flex size-4 shrink-0 items-center justify-center [&>svg]:size-4"
		>
			<LockKeyholeMinimalisticIcon />
		</span>
	</div>
);

export type RoleBadgeSettingRowProps = {
	label?: JSX.Element;
	badge?: RoleBadgeValue;
	roleColor?: string;
	onClick?: (event: MouseEvent) => void;
	disabled?: boolean;
	class?: string;
	"aria-haspopup"?: "dialog";
	"aria-expanded"?: boolean;
};

export const RoleBadgeSettingRow = (props: RoleBadgeSettingRowProps) => {
	const ripple = createRipple();
	const label = createSlot(() => props.label ?? "Badge");
	return (
		<button
			ref={ripple}
			type="button"
			data-role-badge-setting=""
			disabled={props.disabled}
			aria-haspopup={props["aria-haspopup"]}
			aria-expanded={props["aria-expanded"]}
			onClick={(event) => props.onClick?.(event)}
			class={cx(roleRowClass, props.class)}
		>
			<span class="min-w-0 flex-1 truncate text-sm font-semibold">
				{label()}
			</span>
			<Show
				when={props.badge}
				fallback={
					<span class="shrink-0 text-xs font-semibold text-muted-foreground">
						None
					</span>
				}
			>
				{(badge) => (
					<RoleBadgeGlyph badge={badge()} roleColor={props.roleColor} />
				)}
			</Show>
			<Chevron />
		</button>
	);
};
