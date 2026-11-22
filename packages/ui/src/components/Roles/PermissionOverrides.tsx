import { CheckCircleIcon } from "@solar-icons/solid/bold/check-circle";
import { CloseCircleIcon } from "@solar-icons/solid/bold/close-circle";
import { SlashCircleIcon } from "@solar-icons/solid/bold/slash-circle";
import { UserPlusIcon } from "@solar-icons/solid/bold/user-plus";
import { AltArrowRightIcon } from "@solar-icons/solid/linear/alt-arrow-right";
import { For, type JSX, Match, Show, Switch } from "solid-js";
import { cx } from "../../utils/cx";
import { createRipple } from "../../utils/ripple";
import { Avatar } from "../Avatar/Avatar";
import { ListGroup } from "../List/List";
import { SegmentedControl } from "../SegmentedControl/SegmentedControl";
import {
	RoleBadgeGlyph,
	RoleColorDot,
	type RoleIdentity,
	shownRoleBadge,
} from "./RoleBadge";
import {
	type ChannelPermissionScope,
	channelPermissionGroups,
	type RolePermission,
	type RolePermissionGroup,
} from "./RolePermissions";

export type PermissionOverrideState = "deny" | "inherit" | "allow";

export type PermissionOverrideValue = {
	allow: readonly string[];
	deny: readonly string[];
};

export type PermissionOverrideTarget =
	| { kind: "role"; id: string; role: RoleIdentity; isDefault?: boolean }
	| {
			kind: "member";
			id: string;
			name: string;
			handle?: string;
			avatarSrc?: string;
	  };

export type PermissionOverrideEntry = {
	target: PermissionOverrideTarget;
	value: PermissionOverrideValue;
};

export const EMPTY_PERMISSION_OVERRIDE: PermissionOverrideValue = {
	allow: [],
	deny: [],
};

export const permissionOverrideState = (
	value: PermissionOverrideValue,
	key: string,
): PermissionOverrideState => {
	if (value.deny.includes(key)) return "deny";
	if (value.allow.includes(key)) return "allow";
	return "inherit";
};

export const setPermissionOverrideState = (
	value: PermissionOverrideValue,
	key: string,
	state: PermissionOverrideState,
): PermissionOverrideValue => {
	const allow = value.allow.filter((entry) => entry !== key);
	const deny = value.deny.filter((entry) => entry !== key);

	if (state === "allow") allow.push(key);
	if (state === "deny") deny.push(key);

	return { allow, deny };
};

export const isEmptyPermissionOverride = (value: PermissionOverrideValue) => {
	return value.allow.length === 0 && value.deny.length === 0;
};

export const permissionOverrideSummary = (value: PermissionOverrideValue) => {
	if (isEmptyPermissionOverride(value)) return "No changes";

	const parts = [];

	if (value.allow.length > 0) parts.push(`${value.allow.length} allowed`);
	if (value.deny.length > 0) parts.push(`${value.deny.length} denied`);

	return parts.join(", ");
};

const STATE_OPTIONS: readonly {
	value: PermissionOverrideState;
	label: string;
	icon: () => JSX.Element;
	tone: string;
}[] = [
	{
		value: "deny",
		label: "Deny",
		icon: () => <CloseCircleIcon />,
		tone: "in-data-checked:text-destructive",
	},
	{
		value: "inherit",
		label: "Inherit",
		icon: () => <SlashCircleIcon />,
		tone: "in-data-checked:text-foreground",
	},
	{
		value: "allow",
		label: "Allow",
		icon: () => <CheckCircleIcon />,
		tone: "in-data-checked:text-success",
	},
];

export type PermissionOverrideControlProps = {
	permission: string;
	label: string;
	value: PermissionOverrideState;
	onChange: (state: PermissionOverrideState) => void;
	disabled?: boolean;
	class?: string;
};

export const PermissionOverrideControl = (
	props: PermissionOverrideControlProps,
) => {
	return (
		<SegmentedControl
			size="sm"
			iconOnly
			name={`override-${props.permission}`}
			aria-label={props.label}
			value={props.value}
			onChange={(state) => props.onChange(state as PermissionOverrideState)}
			disabled={props.disabled}
			class={cx("w-27", props.class)}
			options={STATE_OPTIONS.map((option) => ({
				value: option.value,
				label: (
					<span
						title={option.label}
						data-override-state={option.value}
						class={cx("flex items-center justify-center", option.tone)}
					>
						{option.icon()}
						<span class="sr-only">{option.label}</span>
					</span>
				),
			}))}
		/>
	);
};

const PermissionOverrideRow = (props: {
	permission: RolePermission;
	value: PermissionOverrideState;
	onChange: (state: PermissionOverrideState) => void;
	locked: boolean;
	disabled?: boolean;
}) => {
	return (
		<div
			data-permission-override-row={props.permission.key}
			data-override-state={props.value}
			class="flex w-full shrink-0 items-center gap-4 px-3 py-2"
		>
			<div class="flex min-w-0 flex-1 flex-col gap-0.5">
				<span
					data-permission={props.permission.key}
					class="truncate text-sm font-semibold text-foreground"
				>
					{props.permission.name}
				</span>
				<span class="text-xs text-pretty text-muted-foreground">
					{props.permission.description}
					<Show when={props.locked}>
						{" "}
						You can't change a permission you don't have.
					</Show>
				</span>
			</div>
			<PermissionOverrideControl
				permission={props.permission.key}
				label={props.permission.name}
				value={props.value}
				onChange={props.onChange}
				disabled={props.disabled || props.locked}
			/>
		</div>
	);
};

export type PermissionOverrideListProps = {
	value: PermissionOverrideValue;
	onChange: (value: PermissionOverrideValue) => void;
	scope: ChannelPermissionScope;
	groups?: readonly RolePermissionGroup[];
	canChange?: (key: string) => boolean;
	disabled?: boolean;
	class?: string;
};

export const PermissionOverrideList = (props: PermissionOverrideListProps) => {
	const groups = () => {
		return props.groups ?? channelPermissionGroups(props.scope);
	};

	return (
		<div
			data-permission-overrides={props.scope}
			class={cx("flex w-full flex-col gap-6", props.class)}
		>
			<For each={groups()}>
				{(group) => (
					<ListGroup label={group.label}>
						<For each={group.permissions}>
							{(permission) => (
								<PermissionOverrideRow
									permission={permission}
									value={permissionOverrideState(props.value, permission.key)}
									locked={!(props.canChange?.(permission.key) ?? true)}
									disabled={props.disabled}
									onChange={(state) =>
										props.onChange(
											setPermissionOverrideState(
												props.value,
												permission.key,
												state,
											),
										)
									}
								/>
							)}
						</For>
					</ListGroup>
				)}
			</For>
		</div>
	);
};

export const permissionOverrideTargetName = (
	target: PermissionOverrideTarget,
) => {
	return target.kind === "role" ? target.role.name : target.name;
};

const TargetGlyph = (props: { target: PermissionOverrideTarget }) => {
	return (
		<Switch>
			<Match when={props.target.kind === "role" && props.target}>
				{(target) => (
					<Show
						when={shownRoleBadge(target().role.badge)}
						fallback={<RoleColorDot color={target().role.color} />}
					>
						{(badge) => (
							<RoleBadgeGlyph badge={badge()} roleColor={target().role.color} />
						)}
					</Show>
				)}
			</Match>
			<Match when={props.target.kind === "member" && props.target}>
				{(target) => (
					<Avatar
						size="xs"
						name={target().name}
						seed={target().id}
						src={target().avatarSrc}
					/>
				)}
			</Match>
		</Switch>
	);
};

const PermissionOverrideTargetRow = (props: {
	entry: PermissionOverrideEntry;
	onOpen: () => void;
	disabled?: boolean;
}) => {
	const ripple = createRipple();

	return (
		<button
			ref={ripple}
			type="button"
			data-override-target={props.entry.target.id}
			data-override-kind={props.entry.target.kind}
			disabled={props.disabled}
			onClick={() => props.onOpen()}
			class={cx(
				"ripple flex h-10 w-full shrink-0 cursor-pointer items-center gap-2 px-3 text-left text-foreground hover:bg-secondary-highlight",
				"outline-none focus-ring-inset disabled:cursor-not-allowed disabled:opacity-50",
			)}
		>
			<TargetGlyph target={props.entry.target} />
			<span class="min-w-0 flex-1 truncate text-sm font-semibold">
				{permissionOverrideTargetName(props.entry.target)}
			</span>
			<span
				data-override-summary=""
				class="shrink-0 text-xs font-semibold text-muted-foreground tabular-nums"
			>
				{permissionOverrideSummary(props.entry.value)}
			</span>
			<span
				aria-hidden="true"
				class="flex size-4 shrink-0 items-center justify-center text-muted-foreground [&>svg]:size-4"
			>
				<AltArrowRightIcon />
			</span>
		</button>
	);
};

export type PermissionOverrideTargetListProps = {
	entries: readonly PermissionOverrideEntry[];
	onOpen: (target: PermissionOverrideTarget) => void;
	onAdd?: () => void;
	disabled?: boolean;
	class?: string;
};

const targetRank = (target: PermissionOverrideTarget) => {
	if (target.kind === "member") return 2;
	return target.isDefault ? 0 : 1;
};

export const sortPermissionOverrideEntries = (
	entries: readonly PermissionOverrideEntry[],
	position: (target: PermissionOverrideTarget) => number = () => 0,
) => {
	return [...entries].sort((a, b) => {
		const rank = targetRank(a.target) - targetRank(b.target);
		if (rank !== 0) return rank;

		return position(b.target) - position(a.target);
	});
};

export const PermissionOverrideTargetList = (
	props: PermissionOverrideTargetListProps,
) => {
	return (
		<ListGroup
			class={props.class}
			label="Roles and members"
			action={
				props.onAdd && !props.disabled
					? {
							label: "Add",
							icon: <UserPlusIcon />,
							onClick: () => props.onAdd?.(),
						}
					: undefined
			}
		>
			<For each={props.entries}>
				{(entry) => (
					<PermissionOverrideTargetRow
						entry={entry}
						disabled={props.disabled}
						onOpen={() => props.onOpen(entry.target)}
					/>
				)}
			</For>
		</ListGroup>
	);
};
