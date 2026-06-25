import type { ActorData } from "@colibri-social/lib";
import { createSignal, For, Show, type ParentComponent } from "solid-js";
import {
	useCommunityContext,
	usePermissions,
} from "../../../contexts/Community";
import { useUserContext } from "../../../contexts/User";
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
import { DisplayableName, displayableNameFn } from "../user/DisplayableName";
import { toast } from "somoto";
import { ActionDialogData, MemberActionDialog } from "./MemberActionDialog";

export const MemberContextMenu: ParentComponent<{ member: ActorData }> = (
	props,
) => {
	const user = useUserContext();
	const community = useCommunityContext();
	const { canManageRole, outranks, canBanMember, canKickMember } =
		usePermissions();

	// Read the member's *raw* role set straight from the shared context — not
	// `getRolesForUser`, which filters out protected roles for display and would
	// therefore strip them from the payload we send back.
	const memberRoles = () =>
		community().members.find((m) => m.did === props.member.did)?.roles ?? [];
	const hasRole = (uri: string) => memberRoles().includes(uri);

	// Serialise role updates so spamming the checkbox can't interleave requests:
	// `setMemberRoles` replaces the whole array, so two in-flight calls would
	// clobber one another. Each toggle optimistically updates the shared context
	// (instant feedback everywhere) and bumps `pending`; the running drainer
	// re-reads the latest desired set and keeps sending until `pending` settles,
	// coalescing rapid clicks into the fewest calls.
	let syncing = false;
	let pending = 0;

	const flush = async () => {
		if (syncing) return;
		syncing = true;
		let lastSent = -1;
		try {
			while (pending !== lastSent) {
				const gen = pending;
				const res = await user.xrpc.social.colibri.community.setMemberRoles(
					community().community.uri,
					props.member.did,
					memberRoles(),
				);
				lastSent = gen;
				// The xrpc wrapper swallows errors and returns undefined; on failure
				// resync the authoritative state and stop.
				if (res === undefined) {
					community().utils.refetch();
					return;
				}
			}
		} finally {
			syncing = false;
			// A toggle may have slipped in during the final await/teardown.
			if (pending !== lastSent) void flush();
		}
	};

	const toggleRole = (uri: string) => {
		const current = memberRoles();
		community().utils.setRolesForUser(
			props.member.did,
			current.includes(uri)
				? current.filter((r) => r !== uri)
				: [...current, uri],
		);
		pending++;
		void flush();
	};

	const isMe = () => props.member.did === user.did;
	const showModActions = () => outranks(user.did, props.member.did) && !isMe();

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
		</>
	);
};
