import type { ActorData } from "@colibri-social/lib";
import {
	createEffect,
	createSignal,
	For,
	onCleanup,
	type ParentComponent,
	Show,
} from "solid-js";
import { toast } from "somoto";
import CheckIcon from "~icons/ph/check";
import {
	useCommunityContext,
	usePermissions,
} from "../../../contexts/Community";
import { useUserContext } from "../../../contexts/User";
import { useUserPreferences } from "../../../contexts/UserPreferences";
import {
	ConnectionState,
	useVoiceChatContext,
} from "../../../contexts/VoiceChat";
import { createLongPress } from "../../../utils/create-long-press";
import { useIsMobile } from "../../../utils/mobile-pane";
import { createRoleSync } from "../../../utils/role-sync";
import { Button } from "../../ui/Button";
import {
	Checkbox,
	CheckboxControl,
	CheckboxInput,
	CheckboxLabel,
} from "../../ui/Checkbox";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuPortal,
	ContextMenuSeparator,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
	ContextMenuTrigger,
} from "../../ui/ContextMenu";
import { handoffDrawer, MenuDrawer, MenuDrawerItem } from "../../ui/MenuDrawer";
import { ResponsiveDialog } from "../../ui/ResponsiveDialog";
import {
	Slider,
	SliderFill,
	SliderGroup,
	SliderLabel,
	SliderThumb,
	SliderTrack,
	SliderValueLabel,
} from "../../ui/Slider";
import { DisplayableName, displayableNameFn } from "../user/DisplayableName";
import {
	type ActionDialogData,
	MemberActionDialog,
} from "./MemberActionDialog";

export const MemberContextMenu: ParentComponent<{
	member: ActorData;
	class?: string;
}> = (props) => {
	const user = useUserContext();
	const community = useCommunityContext();
	const preferences = useUserPreferences();
	const [voiceData, { toggleMic, toggleDeafen, toggleCamera }] =
		useVoiceChatContext();
	const {
		canManageRole,
		outranks,
		canBanMember,
		canKickMember,
		canModerateVoice,
	} = usePermissions();

	const { hasRole, toggleRole } = createRoleSync({
		did: () => props.member.did,
	});

	const isMe = () => props.member.did === user.did;
	const showModActions = () => outranks(user.did, props.member.did) && !isMe();
	const hasModActions = () =>
		showModActions() &&
		((canKickMember(user.did) &&
			community().community.requiresApprovalToJoin) ||
			canBanMember(user.did));
	const isMobile = useIsMobile();
	const [menuOpen, setMenuOpen] = createSignal(false);

	const inVc = () => voiceData.connection.state === ConnectionState.Connected;

	const targetVoiceChannel = () => {
		for (const [uri, dids] of Object.entries(voiceData.presence)) {
			if (dids.includes(props.member.did)) return uri;
		}
		return null;
	};
	const canVoiceModerate = () =>
		!isMe() &&
		!!targetVoiceChannel() &&
		canModerateVoice(user.did, props.member.did);
	const targetServerMuted = () =>
		!!voiceData.memberStates[props.member.did]?.serverMuted;
	const targetServerDeafened = () =>
		!!voiceData.memberStates[props.member.did]?.serverDeafened;

	const moderateVoice = async (
		action: "mute" | "unmute" | "deafen" | "undeafen" | "disconnect",
	): Promise<void> => {
		const channel = targetVoiceChannel();
		if (!channel) return;
		const res = await user.xrpc.social.colibri.voice.moderate(
			community().community.uri,
			channel,
			props.member.did,
			action,
		);
		if (!res) toast.error("Failed to moderate voice participant.");
	};

	const participantVolume = () =>
		Math.round(
			(preferences.preferences().voice.participantVolumeOverrides[
				props.member.did
			]?.voice.volume ?? 1) * 100,
		);

	const [cameraPreviewOpen, setCameraPreviewOpen] = createSignal(false);
	const [previewStream, setPreviewStream] = createSignal<MediaStream | null>(
		null,
	);
	let previewVideo: HTMLVideoElement | undefined;

	const stopPreview = () => {
		for (const t of previewStream()?.getTracks() ?? []) t.stop();
		setPreviewStream(null);
	};

	createEffect(() => {
		if (!cameraPreviewOpen()) {
			stopPreview();
			return;
		}
		const deviceId = preferences.preferences().voice.camera.preferredDeviceId;
		navigator.mediaDevices
			.getUserMedia({
				video: deviceId ? { deviceId: { ideal: deviceId } } : true,
			})
			.then((stream) => {
				if (cameraPreviewOpen()) setPreviewStream(stream);
				else for (const t of stream.getTracks()) t.stop();
			})
			.catch(() => {});
	});

	createEffect(() => {
		const el = previewVideo;
		const stream = previewStream();
		if (!el || !stream) return;
		el.srcObject = stream;
		el.muted = true;
		el.play().catch(() => {});
	});

	onCleanup(stopPreview);

	const sortedRoles = () =>
		community().assignableRoles.sort((a, b) => b.position - a.position);

	const canManageAnyRole = () =>
		sortedRoles().some((role) => canManageRole(user.did, role));

	/** A desktop context-menu toggle styled like the role checkboxes. */
	const VoiceCheckItem: ParentComponent<{
		checked: boolean;
		onToggle: () => void;
	}> = (p) => (
		<Checkbox class="w-full" checked={p.checked}>
			<CheckboxInput />
			<ContextMenuItem
				closeOnSelect={false}
				class="flex flex-row items-center gap-4 justify-between cursor-pointer"
				onClick={() => p.onToggle()}
			>
				<CheckboxLabel>{p.children}</CheckboxLabel>
				<CheckboxControl />
			</ContextMenuItem>
		</Checkbox>
	);

	const copyDid = () => {
		navigator.clipboard.writeText(props.member.did);
		toast.success(
			`DID for ${displayableNameFn(props.member)} copied to clipboard!`,
		);
	};

	const [dialog, setDialog] = createSignal<ActionDialogData>({
		open: false,
		type: "kick",
	});

	return (
		<>
			<MemberActionDialog
				refetch={() => {}}
				member={props.member}
				dialog={dialog}
				setDialog={setDialog}
			/>
			<ResponsiveDialog
				open={cameraPreviewOpen()}
				onOpenChange={setCameraPreviewOpen}
				title="Camera Preview"
			>
				<div class="flex flex-col gap-3">
					<video
						ref={previewVideo}
						class="w-full aspect-video rounded-md object-cover bg-muted -scale-x-100"
					/>
					<Button
						class="w-full"
						disabled={voiceData.states.camEnabled}
						onClick={() => {
							if (!voiceData.states.camEnabled) toggleCamera();
							setCameraPreviewOpen(false);
						}}
					>
						{voiceData.states.camEnabled ? "Camera On" : "Turn On Camera"}
					</Button>
				</div>
			</ResponsiveDialog>
			<Show when={isMobile()}>
				<div
					style={{ display: "contents" }}
					ref={(el) =>
						createLongPress(el, {
							enabled: () => isMobile(),
							onLongPress: () => setMenuOpen(true),
						})
					}
				>
					{props.children}
				</div>
				<MenuDrawer
					open={menuOpen()}
					onOpenChange={setMenuOpen}
					title={<DisplayableName color={false} user={props.member} />}
				>
					<Show when={inVc()}>
						<Show
							when={isMe()}
							fallback={
								<div class="px-3 py-2">
									<Slider
										value={[participantVolume()]}
										minValue={0}
										maxValue={200}
										step={1}
										getValueLabel={(p) => `${p.values[0]}%`}
										onChange={(e) =>
											preferences.setParticipantVolume(
												props.member.did,
												e[0] / 100,
											)
										}
									>
										<SliderGroup>
											<SliderLabel>Volume</SliderLabel>
											<SliderValueLabel />
										</SliderGroup>
										<SliderTrack>
											<SliderFill />
											<SliderThumb />
										</SliderTrack>
									</Slider>
								</div>
							}
						>
							<MenuDrawerItem onClick={() => toggleMic()}>
								<span>Mute</span>
								<Show when={!voiceData.states.micEnabled}>
									<CheckIcon class="ml-auto" />
								</Show>
							</MenuDrawerItem>
							<MenuDrawerItem onClick={() => toggleDeafen()}>
								<span>Deafen</span>
								<Show when={voiceData.states.deafened}>
									<CheckIcon class="ml-auto" />
								</Show>
							</MenuDrawerItem>
							<MenuDrawerItem
								onClick={() =>
									handoffDrawer(
										() => setMenuOpen(false),
										() => setCameraPreviewOpen(true),
									)
								}
							>
								Preview Camera
							</MenuDrawerItem>
							<MenuDrawerItem
								onClick={() =>
									preferences.setVoiceView({
										showNonVideoParticipants:
											!preferences.preferences().voice.showNonVideoParticipants,
									})
								}
							>
								<span>Show non-video participants</span>
								<Show
									when={
										preferences.preferences().voice.showNonVideoParticipants
									}
								>
									<CheckIcon class="ml-auto" />
								</Show>
							</MenuDrawerItem>
							<MenuDrawerItem
								onClick={() =>
									preferences.setVoiceView({
										showOwnCamera:
											!preferences.preferences().voice.showOwnCamera,
									})
								}
							>
								<span>Show own camera feed</span>
								<Show when={preferences.preferences().voice.showOwnCamera}>
									<CheckIcon class="ml-auto" />
								</Show>
							</MenuDrawerItem>
						</Show>
					</Show>
					<Show when={canManageAnyRole()}>
						<span class="px-3 pt-1 pb-0.5 text-xs uppercase tracking-wide text-muted-foreground">
							Roles
						</span>
						<For each={sortedRoles()}>
							{(role) => {
								const manageable = () => canManageRole(user.did, role);
								return (
									<MenuDrawerItem
										disabled={!manageable()}
										class="disabled:opacity-50"
										onClick={() => manageable() && toggleRole(role.uri)}
									>
										<div
											class="w-2.5 h-2.5 rounded-full shrink-0"
											style={{ background: role.color ?? "#fff" }}
										/>
										<span>{role.name}</span>
										<Show when={hasRole(role.uri)}>
											<CheckIcon class="ml-auto" />
										</Show>
									</MenuDrawerItem>
								);
							}}
						</For>
					</Show>
					<Show when={showModActions()}>
						<Show
							when={
								canKickMember(user.did) &&
								community().community.requiresApprovalToJoin
							}
						>
							<MenuDrawerItem
								destructive
								onClick={() =>
									handoffDrawer(
										() => setMenuOpen(false),
										() => setDialog({ open: true, type: "kick" }),
									)
								}
							>
								<span>
									Kick <DisplayableName color={false} user={props.member} />
								</span>
							</MenuDrawerItem>
						</Show>
						<Show when={canBanMember(user.did)}>
							<MenuDrawerItem
								destructive
								onClick={() =>
									handoffDrawer(
										() => setMenuOpen(false),
										() => setDialog({ open: true, type: "ban" }),
									)
								}
							>
								<span>
									Ban <DisplayableName color={false} user={props.member} />
								</span>
							</MenuDrawerItem>
						</Show>
					</Show>
					<Show when={canVoiceModerate()}>
						<MenuDrawerItem
							onClick={() =>
								handoffDrawer(
									() => setMenuOpen(false),
									() =>
										void moderateVoice(targetServerMuted() ? "unmute" : "mute"),
								)
							}
						>
							<span>
								{targetServerMuted() ? "Server unmute" : "Server mute"}{" "}
								<DisplayableName color={false} user={props.member} />
							</span>
						</MenuDrawerItem>
						<MenuDrawerItem
							onClick={() =>
								handoffDrawer(
									() => setMenuOpen(false),
									() =>
										void moderateVoice(
											targetServerDeafened() ? "undeafen" : "deafen",
										),
								)
							}
						>
							<span>
								{targetServerDeafened() ? "Server undeafen" : "Server deafen"}{" "}
								<DisplayableName color={false} user={props.member} />
							</span>
						</MenuDrawerItem>
						<MenuDrawerItem
							destructive
							onClick={() =>
								handoffDrawer(
									() => setMenuOpen(false),
									() => void moderateVoice("disconnect"),
								)
							}
						>
							<span>
								Disconnect <DisplayableName color={false} user={props.member} />{" "}
								from voice
							</span>
						</MenuDrawerItem>
					</Show>
					<MenuDrawerItem
						onClick={() => {
							setMenuOpen(false);
							copyDid();
						}}
					>
						Copy DID
					</MenuDrawerItem>
				</MenuDrawer>
			</Show>
			<Show when={!isMobile()}>
				<ContextMenu>
					<ContextMenuTrigger class={props.class}>
						{props.children}
					</ContextMenuTrigger>
					<ContextMenuPortal>
						<ContextMenuContent>
							<Show when={inVc()}>
								<Show
									when={isMe()}
									fallback={
										<div class="px-2 py-1.5 w-56">
											<Slider
												value={[participantVolume()]}
												minValue={0}
												maxValue={200}
												step={1}
												getValueLabel={(p) => `${p.values[0]}%`}
												onChange={(e) =>
													preferences.setParticipantVolume(
														props.member.did,
														e[0] / 100,
													)
												}
											>
												<SliderGroup>
													<SliderLabel>Volume</SliderLabel>
													<SliderValueLabel />
												</SliderGroup>
												<SliderTrack>
													<SliderFill />
													<SliderThumb />
												</SliderTrack>
											</Slider>
										</div>
									}
								>
									<VoiceCheckItem
										checked={!voiceData.states.micEnabled}
										onToggle={() => toggleMic()}
									>
										Mute
									</VoiceCheckItem>
									<VoiceCheckItem
										checked={voiceData.states.deafened}
										onToggle={() => toggleDeafen()}
									>
										Deafen
									</VoiceCheckItem>
									<ContextMenuItem onSelect={() => setCameraPreviewOpen(true)}>
										Preview Camera
									</ContextMenuItem>
									<VoiceCheckItem
										checked={
											preferences.preferences().voice
												.showNonVideoParticipants !== false
										}
										onToggle={() =>
											preferences.setVoiceView({
												showNonVideoParticipants:
													preferences.preferences().voice
														.showNonVideoParticipants === false,
											})
										}
									>
										Show non-video participants
									</VoiceCheckItem>
									<VoiceCheckItem
										checked={
											preferences.preferences().voice.showOwnCamera !== false
										}
										onToggle={() =>
											preferences.setVoiceView({
												showOwnCamera:
													preferences.preferences().voice.showOwnCamera ===
													false,
											})
										}
									>
										Show own camera feed
									</VoiceCheckItem>
								</Show>
							</Show>
							<Show when={canManageAnyRole()}>
								<Show when={inVc()}>
									<ContextMenuSeparator />
								</Show>
								<ContextMenuSub>
									<ContextMenuSubTrigger>Roles</ContextMenuSubTrigger>
									<ContextMenuPortal>
										<ContextMenuSubContent>
											<For
												each={community().assignableRoles.sort(
													(a, b) => b.position - a.position,
												)}
											>
												{(role) => {
													const manageable = () =>
														canManageRole(user.did, role);

													return (
														<Checkbox
															class="w-full"
															checked={hasRole(role.uri)}
															disabled={!manageable()}
														>
															<CheckboxInput />
															<ContextMenuItem
																closeOnSelect={false}
																disabled={!manageable()}
																class="flex flex-row items-center gap-4 justify-between cursor-pointer"
																onClick={() => {
																	if (!manageable()) return;
																	toggleRole(role.uri);
																}}
															>
																<CheckboxLabel class="flex flex-row items-center gap-2">
																	<div
																		class="w-2 h-2 rounded-full"
																		style={{
																			background: `${role.color ?? "#fff"}`,
																		}}
																	/>
																	{role.name}
																</CheckboxLabel>
																<CheckboxControl />
															</ContextMenuItem>
														</Checkbox>
													);
												}}
											</For>
										</ContextMenuSubContent>
									</ContextMenuPortal>
								</ContextMenuSub>
							</Show>
							<Show when={hasModActions()}>
								<Show when={inVc() || canManageAnyRole()}>
									<ContextMenuSeparator />
								</Show>
								<Show
									when={
										canKickMember(user.did) &&
										community().community.requiresApprovalToJoin
									}
								>
									<ContextMenuItem
										class="text-destructive!"
										onClick={() => setDialog({ open: true, type: "kick" })}
									>
										<span>
											Kick <DisplayableName color={false} user={props.member} />
										</span>
									</ContextMenuItem>
								</Show>
								<Show when={canBanMember(user.did)}>
									<ContextMenuItem
										class="text-destructive!"
										onClick={() => setDialog({ open: true, type: "ban" })}
									>
										<span>
											Ban <DisplayableName color={false} user={props.member} />
										</span>
									</ContextMenuItem>
								</Show>
							</Show>
							<Show when={canVoiceModerate()}>
								<ContextMenuSeparator />
								<ContextMenuItem
									onClick={() =>
										moderateVoice(targetServerMuted() ? "unmute" : "mute")
									}
								>
									<span>
										{targetServerMuted() ? "Server unmute" : "Server mute"}{" "}
										<DisplayableName color={false} user={props.member} />
									</span>
								</ContextMenuItem>
								<ContextMenuItem
									onClick={() =>
										moderateVoice(
											targetServerDeafened() ? "undeafen" : "deafen",
										)
									}
								>
									<span>
										{targetServerDeafened()
											? "Server undeafen"
											: "Server deafen"}{" "}
										<DisplayableName color={false} user={props.member} />
									</span>
								</ContextMenuItem>
								<ContextMenuItem
									class="text-destructive!"
									onClick={() => moderateVoice("disconnect")}
								>
									<span>
										Disconnect{" "}
										<DisplayableName color={false} user={props.member} /> from
										voice
									</span>
								</ContextMenuItem>
							</Show>
							<Show
								when={
									inVc() ||
									canManageAnyRole() ||
									hasModActions() ||
									canVoiceModerate()
								}
							>
								<ContextMenuSeparator />
							</Show>
							<ContextMenuItem
								onClick={() => {
									navigator.clipboard.writeText(props.member.did);
									toast.success(
										`DID for ${displayableNameFn(props.member)} copied to clipboard!`,
									);
								}}
							>
								Copy DID
							</ContextMenuItem>
						</ContextMenuContent>
					</ContextMenuPortal>
				</ContextMenu>
			</Show>
		</>
	);
};
