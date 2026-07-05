import type { ActorData } from "@colibri-social/lib";
import { createSignal, For, type ParentComponent, Show } from "solid-js";
import { toast } from "somoto";
import CheckIcon from "~icons/ph/check";
import {
	useCommunityContext,
	usePermissions,
} from "../../../contexts/Community";
import { useUserContext } from "../../../contexts/User";
import { createLongPress } from "../../../utils/create-long-press";
import { useIsMobile } from "../../../utils/mobile-pane";
import { createRoleSync } from "../../../utils/role-sync";
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
import { DisplayableName, displayableNameFn } from "../user/DisplayableName";
import {
	type ActionDialogData,
	MemberActionDialog,
} from "./MemberActionDialog";

export const MemberContextMenu: ParentComponent<{ member: ActorData }> = (
	props,
) => {
	const user = useUserContext();
	const community = useCommunityContext();
	const { canManageRole, outranks, canBanMember, canKickMember } =
		usePermissions();

	const { hasRole, toggleRole } = createRoleSync({
		did: () => props.member.did,
	});

	const isMe = () => props.member.did === user.did;
	const showModActions = () => outranks(user.did, props.member.did) && !isMe();
	const isMobile = useIsMobile();
	const [menuOpen, setMenuOpen] = createSignal(false);

	const sortedRoles = () =>
		community().assignableRoles.sort((a, b) => b.position - a.position);

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
					<ContextMenuTrigger>{props.children}</ContextMenuTrigger>
					<ContextMenuPortal>
						<ContextMenuContent>
							{/* NOTE: Future implementation of MemberProfileModal.tsx required
							<ContextMenuItem
							onClick={() => {
								memberProfile.setData(props.member);
								memberProfile.setOpen(true);
							}}
						>
							Profile
						</ContextMenuItem>
						<ContextMenuSeparator />*/}
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
												const manageable = () => canManageRole(user.did, role);

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
							<Show when={showModActions()}>
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
							<ContextMenuSeparator />
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
