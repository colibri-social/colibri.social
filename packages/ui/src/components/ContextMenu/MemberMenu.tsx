import { CameraIcon } from "@solar-icons/solid/bold/camera";
import { CopyIcon } from "@solar-icons/solid/bold/copy";
import { EndCallRoundedIcon } from "@solar-icons/solid/bold/end-call-rounded";
import { MonitorCameraIcon } from "@solar-icons/solid/bold/monitor-camera";
import { ShieldUserIcon } from "@solar-icons/solid/bold/shield-user";
import { UserBlockRoundedIcon } from "@solar-icons/solid/bold/user-block-rounded";
import { UserCircleIcon } from "@solar-icons/solid/bold/user-circle";
import { UserMinusRoundedIcon } from "@solar-icons/solid/bold/user-minus-rounded";
import { UsersGroupRoundedIcon } from "@solar-icons/solid/bold/users-group-rounded";
import { createMemo, type JSX, untrack } from "solid-js";
import { HeadphonesSlashIcon, MicrophoneSlashIcon } from "../../icons/custom";
import {
	DropdownMenu,
	type DropdownMenuCheckboxEntry,
	type DropdownMenuEntry,
	type DropdownMenuPlacement,
} from "../DropdownMenu/DropdownMenu";
import { RoleColorDot } from "../Roles/RoleBadge";
import {
	type DeveloperMenuActions,
	developerEntry,
	EntryContextMenu,
	type MenuSection,
	sectionEntries,
	type TargetContextMenuProps,
} from "./menu-entries";

export type MemberMenuRole = {
	id: string;
	name: string;
	color?: string;
	assigned: boolean;
	manageable: boolean;
};

export const MEMBER_VOICE_MAX_VOLUME = 200;

export const MEMBER_VOICE_DEFAULT_VOLUME = 100;

export type MemberMenuVoice = {
	volume?: number;
	onVolumeChange?: (volume: number) => void;
	streamVolume?: number;
	onStreamVolumeChange?: (volume: number) => void;
	selfMuted?: boolean;
	onSelfMutedChange?: (muted: boolean) => void;
	selfDeafened?: boolean;
	onSelfDeafenedChange?: (deafened: boolean) => void;
	onPreviewCamera?: () => void;
	showNonVideoParticipants?: boolean;
	onShowNonVideoParticipantsChange?: (show: boolean) => void;
	showOwnCamera?: boolean;
	onShowOwnCameraChange?: (show: boolean) => void;
	serverMuted?: boolean;
	onServerMutedChange?: (muted: boolean) => void;
	serverDeafened?: boolean;
	onServerDeafenedChange?: (deafened: boolean) => void;
	onDisconnect?: () => void;
};

export type MemberMenuActions = DeveloperMenuActions & {
	voice?: MemberMenuVoice;
	onViewProfile?: () => void;
	roles?: MemberMenuRole[];
	onRoleChange?: (id: string, assigned: boolean) => void;
	onKick?: () => void;
	onBan?: () => void;
	onCopyDid?: () => void;
};

export const canEditMemberRoles = (actions: MemberMenuActions) =>
	!!actions.onRoleChange &&
	(actions.roles ?? []).some((role) => role.manageable);

export const assignedRoleCount = (actions: MemberMenuActions) =>
	(actions.roles ?? []).filter((role) => role.assigned).length;

const roleEntry = (
	id: string,
	actions: MemberMenuActions,
): DropdownMenuCheckboxEntry => {
	const role = () => actions.roles?.find((entry) => entry.id === id);
	return {
		kind: "checkbox",
		get label() {
			return role()?.name ?? "";
		},
		get icon() {
			return <RoleColorDot color={role()?.color} />;
		},
		get checked() {
			return !!role()?.assigned;
		},
		get disabled() {
			return !role()?.manageable;
		},
		onChange: (checked) => actions.onRoleChange?.(id, checked),
	};
};

export const formatMemberVolume = (value: number) => `${Math.round(value)}%`;

const voiceSlider = (
	label: string,
	value: () => number | undefined,
	onChange: (value: number) => void,
): DropdownMenuEntry => ({
	kind: "slider",
	label,
	get value() {
		return value() ?? MEMBER_VOICE_DEFAULT_VOLUME;
	},
	min: 0,
	max: MEMBER_VOICE_MAX_VOLUME,
	defaultValue: MEMBER_VOICE_DEFAULT_VOLUME,
	formatValue: formatMemberVolume,
	onChange,
});

const voiceToggle = (
	label: string,
	icon: () => JSX.Element,
	checked: () => boolean | undefined,
	onChange: (checked: boolean) => void,
): DropdownMenuCheckboxEntry => ({
	kind: "checkbox",
	label,
	get icon() {
		return icon();
	},
	get checked() {
		return !!checked();
	},
	onChange,
});

export const memberVoiceShape = (voice: MemberMenuVoice | undefined) =>
	voice
		? [
				!!voice.onVolumeChange,
				!!voice.onStreamVolumeChange,
				!!voice.onSelfMutedChange,
				!!voice.onSelfDeafenedChange,
				!!voice.onPreviewCamera,
				!!voice.onShowNonVideoParticipantsChange,
				!!voice.onShowOwnCameraChange,
				!!voice.onServerMutedChange,
				!!voice.onServerDeafenedChange,
				!!voice.onDisconnect,
			]
				.map(Number)
				.join("")
		: "";

export const memberVoiceEntries = (
	name: string,
	actions: MemberMenuActions,
): MenuSection[] => {
	const voice = actions.voice;
	if (!voice) return [];
	const current = () => actions.voice ?? voice;
	return [
		{
			label: "Voice",
			items: [
				voice.onVolumeChange &&
					voiceSlider(
						"Volume",
						() => current().volume,
						(value) => current().onVolumeChange?.(value),
					),
				voice.onStreamVolumeChange &&
					voiceSlider(
						"Stream volume",
						() => current().streamVolume,
						(value) => current().onStreamVolumeChange?.(value),
					),
				voice.onSelfMutedChange &&
					voiceToggle(
						"Mute",
						() => <MicrophoneSlashIcon />,
						() => current().selfMuted,
						(checked) => current().onSelfMutedChange?.(checked),
					),
				voice.onSelfDeafenedChange &&
					voiceToggle(
						"Deafen",
						() => <HeadphonesSlashIcon />,
						() => current().selfDeafened,
						(checked) => current().onSelfDeafenedChange?.(checked),
					),
				voice.onPreviewCamera && {
					label: "Preview camera",
					get icon() {
						return <CameraIcon />;
					},
					onSelect: () => current().onPreviewCamera?.(),
				},
				voice.onShowNonVideoParticipantsChange &&
					voiceToggle(
						"Show non-video participants",
						() => <UsersGroupRoundedIcon />,
						() => current().showNonVideoParticipants,
						(checked) => current().onShowNonVideoParticipantsChange?.(checked),
					),
				voice.onShowOwnCameraChange &&
					voiceToggle(
						"Show own camera",
						() => <MonitorCameraIcon />,
						() => current().showOwnCamera,
						(checked) => current().onShowOwnCameraChange?.(checked),
					),
			],
		},
		{
			items: [
				voice.onServerMutedChange &&
					voiceToggle(
						"Server mute",
						() => <MicrophoneSlashIcon />,
						() => current().serverMuted,
						(checked) => current().onServerMutedChange?.(checked),
					),
				voice.onServerDeafenedChange &&
					voiceToggle(
						"Server deafen",
						() => <HeadphonesSlashIcon />,
						() => current().serverDeafened,
						(checked) => current().onServerDeafenedChange?.(checked),
					),
				voice.onDisconnect && {
					label: `Disconnect ${name} from voice`,
					get icon() {
						return <EndCallRoundedIcon />;
					},
					tone: "destructive",
					onSelect: () => current().onDisconnect?.(),
				},
			],
		},
	];
};

export const memberMenuEntries = (
	name: string,
	actions: MemberMenuActions,
): DropdownMenuEntry[] =>
	sectionEntries([
		...memberVoiceEntries(name, actions),
		{
			items: [
				actions.onViewProfile && {
					label: "View profile",
					get icon() {
						return <UserCircleIcon />;
					},
					onSelect: actions.onViewProfile,
				},
				canEditMemberRoles(actions) && {
					kind: "submenu",
					label: "Roles",
					get icon() {
						return <ShieldUserIcon />;
					},
					items: (actions.roles ?? []).map((role) =>
						roleEntry(role.id, actions),
					),
				},
			],
		},
		{
			items: [
				actions.onKick && {
					label: `Kick ${name}`,
					get icon() {
						return <UserMinusRoundedIcon />;
					},
					tone: "destructive",
					onSelect: actions.onKick,
				},
				actions.onBan && {
					label: `Ban ${name}`,
					get icon() {
						return <UserBlockRoundedIcon />;
					},
					tone: "destructive",
					onSelect: actions.onBan,
				},
			],
		},
		{
			items: [
				actions.onCopyDid && {
					label: "Copy DID",
					get icon() {
						return <CopyIcon />;
					},
					onSelect: actions.onCopyDid,
				},
				developerEntry(actions),
			],
		},
	]);

export type MemberContextMenuProps = MemberMenuActions &
	TargetContextMenuProps & { name: string };

const menuShape = (props: MemberMenuActions & { name: string }) =>
	[
		props.name,
		!!props.onViewProfile,
		canEditMemberRoles(props),
		(props.roles ?? []).map((role) => role.id).join("\n"),
		!!props.onKick,
		!!props.onBan,
		!!props.onCopyDid,
		!!props.developerMode,
		!!props.onCopyAtUri,
		!!props.onShowOnPdsls,
		memberVoiceShape(props.voice),
	].join("|");

export const MemberContextMenu = (props: MemberContextMenuProps) => {
	const shape = createMemo(() => menuShape(props));
	return (
		<EntryContextMenu
			label={`${props.name} options`}
			entries={() => {
				shape();
				return untrack(() => memberMenuEntries(props.name, props));
			}}
			disabled={props.disabled}
			onOpenChange={props.onOpenChange}
			class={props.class}
		>
			{props.children}
		</EntryContextMenu>
	);
};

export type MemberDropdownMenuProps = MemberMenuActions & {
	name: string;
	trigger: JSX.Element;
	triggerClass?: string;
	triggerProps?: Record<string, unknown>;
	placement?: DropdownMenuPlacement;
	onOpenChange?: (open: boolean) => void;
};

export const MemberDropdownMenu = (props: MemberDropdownMenuProps) => {
	const shape = createMemo(() => menuShape(props));
	const entries = createMemo(() => {
		shape();
		return untrack(() => memberMenuEntries(props.name, props));
	});
	return (
		<DropdownMenu
			platform="desktop"
			label={`${props.name} options`}
			items={entries()}
			trigger={props.trigger}
			triggerClass={props.triggerClass}
			triggerProps={props.triggerProps}
			placement={props.placement ?? "bottom-end"}
			onOpenChange={props.onOpenChange}
		/>
	);
};
