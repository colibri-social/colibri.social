import { CameraIcon } from "@solar-icons/solid/bold/camera";
import { CopyIcon } from "@solar-icons/solid/bold/copy";
import { EndCallRoundedIcon } from "@solar-icons/solid/bold/end-call-rounded";
import { MonitorCameraIcon } from "@solar-icons/solid/bold/monitor-camera";
import { ShieldUserIcon } from "@solar-icons/solid/bold/shield-user";
import { TransferHorizontalIcon } from "@solar-icons/solid/bold/transfer-horizontal";
import { UserBlockRoundedIcon } from "@solar-icons/solid/bold/user-block-rounded";
import { UserCircleIcon } from "@solar-icons/solid/bold/user-circle";
import { UserMinusRoundedIcon } from "@solar-icons/solid/bold/user-minus-rounded";
import { UsersGroupRoundedIcon } from "@solar-icons/solid/bold/users-group-rounded";
import { VolumeIcon } from "@solar-icons/solid/bold/volume";
import { VolumeCrossIcon } from "@solar-icons/solid/bold/volume-cross";
import { ArrowLeftIcon } from "@solar-icons/solid/linear/arrow-left";
import {
	createEffect,
	createMemo,
	createSignal,
	Index,
	type JSX,
	on,
	Show,
} from "solid-js";
import { HeadphonesSlashIcon, MicrophoneSlashIcon } from "../../icons/custom";
import { createSlot } from "../../utils/slot";
import { Avatar } from "../Avatar/Avatar";
import {
	assignedRoleCount,
	canEditMemberRoles,
	formatMemberVolume,
	MEMBER_VOICE_DEFAULT_VOLUME,
	MEMBER_VOICE_MAX_VOLUME,
	type MemberMenuActions,
	type MemberMenuVoice,
} from "../ContextMenu/MemberMenu";
import {
	DeveloperModeCard,
	type DeveloperModeCardProps,
} from "../DeveloperMode/DeveloperModeCard";
import { Drawer, DrawerContent } from "../Drawer/Drawer";
import { IconButton } from "../IconButton/IconButton";
import {
	CheckboxRow,
	DestructiveRow,
	ListGroup,
	NavRow,
	ToggleRow,
} from "../List/List";
import { RoleColorDot } from "../Roles/RoleBadge";
import { Slider } from "../Slider/Slider";
import { memberHandleLabel } from "./MemberIdentity";

export type MemberDrawerView = "actions" | "roles" | "move";

const VolumeRow = (props: {
	label: string;
	value?: number;
	onChange: (value: number) => void;
}) => (
	<div data-member-volume="" class="px-3 py-3">
		<Slider
			label={props.label}
			showValue
			formatValue={formatMemberVolume}
			minValue={0}
			maxValue={MEMBER_VOICE_MAX_VOLUME}
			step={1}
			defaultValue={[MEMBER_VOICE_DEFAULT_VOLUME]}
			value={[props.value ?? MEMBER_VOICE_DEFAULT_VOLUME]}
			onChange={(values) => props.onChange(values[0] ?? 0)}
		/>
	</div>
);

const hasVoiceSettings = (voice: MemberMenuVoice) =>
	!!(
		voice.onVolumeChange ||
		voice.onStreamVolumeChange ||
		voice.onStreamMutedChange ||
		voice.onSelfMutedChange ||
		voice.onSelfDeafenedChange ||
		voice.onPreviewCamera ||
		voice.onShowNonVideoParticipantsChange ||
		voice.onShowOwnCameraChange
	);

const hasVoiceModeration = (voice: MemberMenuVoice) =>
	!!(
		voice.onServerMutedChange ||
		voice.onServerDeafenedChange ||
		canMoveMember(voice) ||
		voice.onDisconnect
	);

const canMoveMember = (voice: MemberMenuVoice) =>
	!!voice.onMove && (voice.moveTargets?.length ?? 0) > 0;

export type MemberDrawerProps = MemberMenuActions & {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	name: string;
	handle?: string;
	avatarSrc?: string;
	avatarSeed?: string;
	badge?: JSX.Element;
	developer?: DeveloperModeCardProps;
};

export const MemberDrawer = (props: MemberDrawerProps) => {
	const [view, setView] = createSignal<MemberDrawerView>("actions");
	const badge = createSlot(() => props.badge);

	const open = createMemo(() => props.open);
	createEffect(
		on(open, (isOpen) => {
			if (isOpen) setView("actions");
		}),
	);

	const run = (action?: () => void) => () => {
		props.onOpenChange(false);
		action?.();
	};
	const backToActions = (event: KeyboardEvent) => {
		if (view() === "actions") return;
		event.preventDefault();
		event.stopPropagation();
		setView("actions");
	};
	const hasPrimary = () => !!props.onViewProfile || canEditMemberRoles(props);
	const hasModeration = () => !!(props.onKick || props.onBan);
	const roleCount = () => assignedRoleCount(props);
	const showDeveloper = () => !!(props.developerMode && props.developer);

	return (
		<Drawer
			open={props.open}
			onOpenChange={props.onOpenChange}
			initialFocus="content"
		>
			<DrawerContent
				aria-label={`${props.name} options`}
				onEscapeKeyDown={backToActions}
				header={
					<Show
						when={view() !== "actions"}
						fallback={
							<div
								data-member-drawer-header=""
								class="flex min-w-0 items-center gap-3"
							>
								<Avatar
									src={props.avatarSrc}
									name={props.name}
									seed={props.avatarSeed}
									size="md"
								/>
								<span class="flex min-w-0 flex-1 flex-col gap-0.5">
									<span class="flex min-w-0 items-center gap-1.5">
										<span class="min-w-0 truncate text-lg leading-6 font-bold">
											{props.name}
										</span>
										<Show when={badge.has()}>
											<span
												data-member-drawer-badge=""
												class="flex shrink-0 items-center"
											>
												{badge()}
											</span>
										</Show>
									</span>
									<Show when={props.handle}>
										{(handle) => (
											<span class="min-w-0 truncate text-sm text-muted-foreground">
												{memberHandleLabel(handle())}
											</span>
										)}
									</Show>
								</span>
							</div>
						}
					>
						<div
							data-member-drawer-header=""
							class="flex min-w-0 items-center gap-2"
						>
							<IconButton
								variant="ghost"
								size="md"
								label="Back to member options"
								icon={<ArrowLeftIcon />}
								onClick={() => setView("actions")}
								class="-ml-1.5 [&_svg]:size-5"
							/>
							<span class="flex min-w-0 flex-1 flex-col">
								<span class="text-base leading-5 font-bold">
									{view() === "move" ? "Move to" : "Roles"}
								</span>
								<span class="min-w-0 truncate text-sm text-muted-foreground">
									{props.name}
								</span>
							</span>
						</div>
					</Show>
				}
			>
				<Show when={view() === "roles"}>
					<ListGroup>
						<Index each={props.roles ?? []}>
							{(role) => (
								<CheckboxRow
									leading={<RoleColorDot color={role().color} />}
									label={<span class="block truncate">{role().name}</span>}
									checked={role().assigned}
									disabled={!role().manageable}
									onChange={(checked) =>
										props.onRoleChange?.(role().id, checked)
									}
									class="min-h-12"
								/>
							)}
						</Index>
					</ListGroup>
				</Show>
				<Show when={view() === "move"}>
					<ListGroup>
						<Index each={props.voice?.moveTargets ?? []}>
							{(target) => (
								<NavRow
									icon={<VolumeIcon />}
									label={target().name}
									onClick={run(() => props.voice?.onMove?.(target().id))}
								/>
							)}
						</Index>
					</ListGroup>
				</Show>
				<Show when={view() === "actions"}>
					<Show when={props.voice}>
						{(voice) => (
							<>
								<Show when={hasVoiceSettings(voice())}>
									<ListGroup label="Voice">
										<Show when={voice().onVolumeChange}>
											{(change) => (
												<VolumeRow
													label="Volume"
													value={voice().volume}
													onChange={change()}
												/>
											)}
										</Show>
										<Show when={voice().onStreamVolumeChange}>
											{(change) => (
												<VolumeRow
													label="Stream volume"
													value={voice().streamVolume}
													onChange={change()}
												/>
											)}
										</Show>
										<Show when={voice().onStreamMutedChange}>
											{(change) => (
												<CheckboxRow
													leading={
														<span
															aria-hidden="true"
															class="flex size-6 items-center justify-center text-foreground [&>svg]:size-6"
														>
															<VolumeCrossIcon />
														</span>
													}
													label={<span class="text-sm">Mute stream</span>}
													checked={!!voice().streamMuted}
													onChange={change()}
													class="min-h-0 gap-2"
												/>
											)}
										</Show>
										<Show when={voice().onSelfMutedChange}>
											{(change) => (
												<ToggleRow
													icon={<MicrophoneSlashIcon />}
													title="Mute"
													checked={!!voice().selfMuted}
													onChange={change()}
												/>
											)}
										</Show>
										<Show when={voice().onSelfDeafenedChange}>
											{(change) => (
												<ToggleRow
													icon={<HeadphonesSlashIcon />}
													title="Deafen"
													checked={!!voice().selfDeafened}
													onChange={change()}
												/>
											)}
										</Show>
										<Show when={voice().onPreviewCamera}>
											{(preview) => (
												<NavRow
													icon={<CameraIcon />}
													label="Preview camera"
													onClick={run(preview())}
												/>
											)}
										</Show>
										<Show when={voice().onShowNonVideoParticipantsChange}>
											{(change) => (
												<ToggleRow
													icon={<UsersGroupRoundedIcon />}
													title="Show non-video participants"
													checked={!!voice().showNonVideoParticipants}
													onChange={change()}
												/>
											)}
										</Show>
										<Show when={voice().onShowOwnCameraChange}>
											{(change) => (
												<ToggleRow
													icon={<MonitorCameraIcon />}
													title="Show own camera"
													checked={!!voice().showOwnCamera}
													onChange={change()}
												/>
											)}
										</Show>
									</ListGroup>
								</Show>
								<Show when={hasVoiceModeration(voice())}>
									<ListGroup>
										<Show when={voice().onServerMutedChange}>
											{(change) => (
												<ToggleRow
													icon={<MicrophoneSlashIcon />}
													title="Server mute"
													checked={!!voice().serverMuted}
													onChange={change()}
												/>
											)}
										</Show>
										<Show when={voice().onServerDeafenedChange}>
											{(change) => (
												<ToggleRow
													icon={<HeadphonesSlashIcon />}
													title="Server deafen"
													checked={!!voice().serverDeafened}
													onChange={change()}
												/>
											)}
										</Show>
										<Show when={canMoveMember(voice())}>
											<NavRow
												icon={<TransferHorizontalIcon />}
												label="Move to"
												onClick={() => setView("move")}
											/>
										</Show>
										<Show when={voice().onDisconnect}>
											{(disconnect) => (
												<DestructiveRow
													icon={<EndCallRoundedIcon />}
													label={`Disconnect ${props.name} from voice`}
													onClick={run(disconnect())}
												/>
											)}
										</Show>
									</ListGroup>
								</Show>
							</>
						)}
					</Show>
					<Show when={hasPrimary()}>
						<ListGroup>
							<Show when={props.onViewProfile}>
								<NavRow
									icon={<UserCircleIcon />}
									label="View profile"
									onClick={run(props.onViewProfile)}
								/>
							</Show>
							<Show when={canEditMemberRoles(props)}>
								<NavRow
									icon={<ShieldUserIcon />}
									label="Roles"
									value={roleCount() > 0 ? String(roleCount()) : undefined}
									onClick={() => setView("roles")}
								/>
							</Show>
						</ListGroup>
					</Show>
					<Show when={hasModeration()}>
						<ListGroup>
							<Show when={props.onKick}>
								<DestructiveRow
									icon={<UserMinusRoundedIcon />}
									label={`Kick ${props.name}`}
									onClick={run(props.onKick)}
								/>
							</Show>
							<Show when={props.onBan}>
								<DestructiveRow
									icon={<UserBlockRoundedIcon />}
									label={`Ban ${props.name}`}
									onClick={run(props.onBan)}
								/>
							</Show>
						</ListGroup>
					</Show>
					<Show when={props.onCopyDid && !showDeveloper()}>
						<ListGroup>
							<NavRow
								icon={<CopyIcon />}
								label="Copy DID"
								onClick={run(props.onCopyDid)}
							/>
						</ListGroup>
					</Show>
					<Show when={showDeveloper() && props.developer}>
						{(developer) => <DeveloperModeCard {...developer()} />}
					</Show>
				</Show>
			</DrawerContent>
		</Drawer>
	);
};
