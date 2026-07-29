import type { Details } from "@kobalte/core/file-field";
import { useNavigate } from "@solidjs/router";
import type { Accessor, ParentComponent, Setter } from "solid-js";
import {
	type Component,
	createEffect,
	createResource,
	createSignal,
	For,
	Match,
	Show,
	Suspense,
	Switch,
} from "solid-js";
import { toast } from "somoto";
import ArrowCounterClockwiseIcon from "~icons/ph/arrow-counter-clockwise";
import BugIcon from "~icons/ph/bug";
import CheckIcon from "~icons/ph/check";
import DotsSixVerticalIcon from "~icons/ph/dots-six-vertical";
import DotsThreeOutlineVerticalIcon from "~icons/ph/dots-three-outline-vertical-fill";
import IdentificationBadgeIcon from "~icons/ph/identification-badge";
import IdentificationBadgeIconFilled from "~icons/ph/identification-badge-fill";
import ImageIcon from "~icons/ph/image";
import LinkIcon from "~icons/ph/link";
import PenIcon from "~icons/ph/pen";
import PlusIcon from "~icons/ph/plus";
import ProhibitIcon from "~icons/ph/prohibit";
import TicketIcon from "~icons/ph/ticket";
import TrashIcon from "~icons/ph/trash";
import UserMinusIcon from "~icons/ph/user-minus";
import UsersIcon from "~icons/ph/users";
import WarningDiamondIcon from "~icons/ph/warning-diamond";
import WrenchIcon from "~icons/ph/wrench";
import XCircleIcon from "~icons/ph/x-circle";
import { resolveBlob } from "../../../atproto/resolve-blob";
import type { Applicant } from "../../../atproto/xrpc/social/colibri/community/listApplications";
import type { Member } from "../../../atproto/xrpc/social/colibri/community/listMembers";
import type { Role } from "../../../atproto/xrpc/social/colibri/community/listRoles";
import {
	useCommunityContext,
	usePermissions,
} from "../../../contexts/Community";
import { useUserContext } from "../../../contexts/User";
import { Spinner } from "../../icons/Spinner";
import { Button } from "../../ui/Button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogPortal,
	DialogTrigger,
} from "../../ui/Dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuPortal,
	DropdownMenuTrigger,
} from "../../ui/DropdownMenu";
import {
	FileField,
	FileFieldDropzone,
	FileFieldHiddenInput,
	FileFieldItem,
	FileFieldItemList,
	FileFieldItemPreviewImage,
	FileFieldLabel,
	FileFieldTrigger,
} from "../../ui/FileField";
import {
	Switch as SwitchComp,
	SwitchControl,
	SwitchDescription,
	SwitchInput,
	SwitchLabel,
	SwitchThumb,
} from "../../ui/Switch";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "../../ui/Table";
import { TextField, TextFieldInput, TextFieldLabel } from "../../ui/TextField";
import { CopyButton } from "../common/CopyButton";
import { SettingsInfoPage } from "../common/SettingsInfoPage";
import { SettingsModal, SettingsPage } from "../common/SettingsModal";
import User from "../user";
import { DeleteLinkModal } from "./DeleteInvitationModal";
import { InviteLinkCreationModal } from "./InviteLinkCreationModal";
import {
	type ActionDialogData,
	MemberActionDialog,
} from "./MemberActionDialog";
import { RoleModal } from "./RoleModal";

const GeneralSettingsPage: Component = () => {
	const user = useUserContext();
	const community = useCommunityContext();

	const [loading, setLoading] = createSignal<boolean>(false);
	const [name, setName] = createSignal(community().community.name);
	const [description, setDescription] = createSignal(
		community().community.description,
	);
	const [picture, setPicture] = createSignal<Details>();
	const [banner, setBanner] = createSignal<Details>();
	const [pictureRemoved, setPictureRemoved] = createSignal(false);
	const [bannerRemoved, setBannerRemoved] = createSignal(false);
	const [requiresApprovalToJoin, setRequiresApprovalToJoin] = createSignal(
		community().community.requiresApprovalToJoin,
	);

	const existingPictureUrl = () =>
		!pictureRemoved() && picture() === undefined
			? (resolveBlob(community().did, community().community.picture) ?? null)
			: null;

	const existingBannerUrl = () =>
		!bannerRemoved() && banner() === undefined
			? (resolveBlob(community().did, community().community.banner) ?? null)
			: null;

	const hasEdited = (): boolean =>
		name() !== community().community.name ||
		description() !== community().community.description ||
		pictureRemoved() ||
		picture() !== undefined ||
		bannerRemoved() ||
		banner() !== undefined ||
		requiresApprovalToJoin() !== community().community.requiresApprovalToJoin;

	const clearNewPicture = (e?: MouseEvent) => {
		e?.preventDefault();
		e?.stopPropagation();
		setPicture(undefined);
	};

	const clearNewBanner = (e?: MouseEvent) => {
		e?.preventDefault();
		e?.stopPropagation();
		setBanner(undefined);
	};

	const removeExistingPicture = (e: MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setPictureRemoved(true);
	};

	const removeExistingBanner = (e: MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setBannerRemoved(true);
	};

	const editCommunityData = async () => {
		setLoading(true);
		try {
			const pictureBlob = picture()?.acceptedFiles[0];
			const bannerBlob = banner()?.acceptedFiles[0];

			const trimmedName = name().trim();
			const trimmedDescription = description().trim();

			const res = await user.xrpc.social.colibri.community.update(
				community().community.uri,
				trimmedName !== community().community.name ? trimmedName : undefined,
				trimmedDescription !== (community().community.description ?? "")
					? trimmedDescription
					: undefined,
				pictureBlob,
				bannerBlob,
				requiresApprovalToJoin(),
				pictureRemoved(),
				bannerRemoved(),
			);

			if (!res) {
				toast.error("Failed to save community settings.");
				return;
			}

			community().utils.patchCommunity({
				name: trimmedName,
				description: trimmedDescription,
				requiresApprovalToJoin: requiresApprovalToJoin(),
				...(pictureRemoved() && { picture: undefined }),
				...(bannerRemoved() && { banner: undefined }),
			});
			community().utils.refetch();
			setName(trimmedName);
			setDescription(trimmedDescription);
			clearNewPicture();
			clearNewBanner();
			setPictureRemoved(false);
			setBannerRemoved(false);

			toast.success("Community settings saved.");
		} catch {
			toast.error("Failed to save community settings.");
		} finally {
			setLoading(false);
		}
	};

	const resetCommunityData = () => {
		setName(community().community.name);
		setDescription(community().community.description);
		clearNewPicture();
		clearNewBanner();
		setPictureRemoved(false);
		setBannerRemoved(false);
		setRequiresApprovalToJoin(community().community.requiresApprovalToJoin);
	};

	return (
		<SettingsPage
			loading={loading}
			canReset={hasEdited()}
			title="Community Profile"
			onSave={editCommunityData}
			onReset={resetCommunityData}
		>
			<TextField
				value={name()}
				onChange={setName}
				validationState={
					name() !== undefined &&
					name()!.trim().length < 33 &&
					name()!.trim().length > 0
						? "valid"
						: "invalid"
				}
			>
				<TextFieldLabel>Community Name</TextFieldLabel>
				<TextFieldInput maxLength={32} minLength={1} type="text" required />
			</TextField>
			<TextField
				value={description()}
				onChange={setDescription}
				validationState={
					description() !== undefined && description()!.trim().length < 257
						? "valid"
						: "invalid"
				}
			>
				<TextFieldLabel>Community Description</TextFieldLabel>
				<TextFieldInput maxLength={256} minLength={1} type="text" required />
			</TextField>
			<div class="flex gap-6">
				<FileField
					class="items-start -size-full"
					onFileChange={setPicture}
					maxFiles={1}
				>
					<FileFieldLabel>Community Picture</FileFieldLabel>
					<FileFieldDropzone class="h-32 w-32 min-h-0">
						<FileFieldTrigger class="h-32 w-32 p-0 bg-muted/25 hover:bg-muted/50 rounded-sm overflow-hidden">
							<Switch>
								<Match when={picture() !== undefined}>
									<div class="relative w-32 h-32">
										<FileFieldItemList class="w-full h-full m-0 p-0">
											{() => (
												<FileFieldItem class="w-full h-full m-0 p-0 border-none [&>div]:w-32">
													<FileFieldItemPreviewImage class="w-full h-full object-cover" />
												</FileFieldItem>
											)}
										</FileFieldItemList>
										<button
											type="button"
											class="absolute top-1 right-1 text-white drop-shadow drop-shadow-black cursor-pointer"
											onClick={clearNewPicture}
											aria-label="Remove selected picture"
										>
											<XCircleIcon />
										</button>
									</div>
								</Match>
								<Match when={existingPictureUrl() !== null}>
									<div class="relative w-32 h-32">
										<img
											src={existingPictureUrl()!}
											alt={community().community.name}
											class="w-full h-full object-cover"
										/>
										<button
											type="button"
											class="absolute top-1 right-1 text-white drop-shadow drop-shadow-black cursor-pointer"
											onClick={removeExistingPicture}
											aria-label="Remove picture"
										>
											<XCircleIcon />
										</button>
									</div>
								</Match>
								<Match when={true}>
									<div class="flex flex-col items-center justify-center gap-1">
										<ImageIcon class="w-6! h-6!" />
										<span>Upload</span>
									</div>
								</Match>
							</Switch>
						</FileFieldTrigger>
					</FileFieldDropzone>
					<FileFieldHiddenInput />
				</FileField>
				<FileField class="items-start" onFileChange={setBanner} maxFiles={1}>
					<FileFieldLabel>Community Banner</FileFieldLabel>
					<FileFieldDropzone class="h-32 w-full min-h-0">
						<FileFieldTrigger class="h-full w-full p-0 bg-muted/25 hover:bg-muted/50 rounded-sm overflow-hidden">
							<Switch>
								<Match when={banner() !== undefined}>
									<div class="relative w-full h-full">
										<FileFieldItemList class="w-full h-full m-0 p-0">
											{() => (
												<FileFieldItem class="w-full h-full m-0 p-0 border-none -grid [&>div]:h-full">
													<FileFieldItemPreviewImage class="w-full h-full object-cover object-center" />
												</FileFieldItem>
											)}
										</FileFieldItemList>
										<button
											type="button"
											class="absolute top-1 right-1 text-white drop-shadow drop-shadow-black cursor-pointer"
											onClick={clearNewBanner}
											aria-label="Remove selected banner"
										>
											<XCircleIcon />
										</button>
									</div>
								</Match>
								<Match when={existingBannerUrl() !== null}>
									<div class="relative w-full h-full">
										<img
											src={existingBannerUrl()!}
											alt=""
											class="w-full h-full object-cover object-center"
										/>
										<button
											type="button"
											class="absolute top-1 right-1 text-white drop-shadow drop-shadow-black cursor-pointer"
											onClick={removeExistingBanner}
											aria-label="Remove banner"
										>
											<XCircleIcon />
										</button>
									</div>
								</Match>
								<Match when={true}>
									<div class="flex flex-col items-center justify-center gap-1">
										<ImageIcon class="w-6! h-6!" />
										<span>Upload</span>
									</div>
								</Match>
							</Switch>
						</FileFieldTrigger>
					</FileFieldDropzone>
					<FileFieldHiddenInput />
				</FileField>
			</div>
			<SwitchComp
				onChange={(e) => {
					setRequiresApprovalToJoin(e);
				}}
				checked={requiresApprovalToJoin()}
				class="flex justify-between items-center gap-x-2"
			>
				<div>
					<SwitchLabel>Require Join Approval</SwitchLabel>
					<SwitchDescription>
						Whether you want to explicitly need to allow users to chat in this
						community.
					</SwitchDescription>
				</div>
				<SwitchInput />
				<SwitchControl>
					<SwitchThumb />
				</SwitchControl>
			</SwitchComp>
		</SettingsPage>
	);
};

const InviteLinksPage: Component = () => {
	const user = useUserContext();
	const community = useCommunityContext();
	const { canDeleteInvitation } = usePermissions();
	const uri = () => community().community.uri;

	const [loading] = createSignal<boolean>(false);
	const [invitations, { refetch }] = createResource(uri, async (u) => {
		const res = await user.xrpc.social.colibri.community.listInvitations(u);
		return res?.codes ?? [];
	});

	return (
		<SettingsPage loading={loading} title="Invite Links">
			<Switch>
				<Match when={!invitations()}>
					<div class="my-2 flex w-full items-center justify-center">
						<Spinner />
					</div>
				</Match>
				<Match when={invitations()}>
					{(invitations) => (
						<>
							<Table class="h-full">
								<TableHeader>
									<TableRow>
										<TableHead class="w-[150px]">Invite ID</TableHead>
										<TableHead>Created by</TableHead>
										<TableHead>Active</TableHead>
										<Show when={canDeleteInvitation(user.did)}>
											<TableHead class="text-right">Actions</TableHead>
										</Show>
									</TableRow>
								</TableHeader>
								<TableBody class="relative">
									<For each={invitations().sort((x) => (x.active ? -1 : 1))}>
										{(invitation) => (
											<TableRow
												classList={{
													"opacity-50": !invitation.active,
												}}
											>
												<TableCell class="font-medium">
													{invitation.code}
												</TableCell>
												<TableCell>
													<Suspense fallback={<Spinner />}>
														<User.InlineProfile
															color={false}
															user={invitation.createdBy}
														/>
													</Suspense>
												</TableCell>
												<TableCell>
													{invitation.active ? "Yes" : "No"}
												</TableCell>
												<Show when={canDeleteInvitation(user.did)}>
													<TableCell class="flex flex-row items-center justify-end gap-1">
														<CopyButton
															value={`https://colibri.social/invite/${invitation.code}`}
														></CopyButton>
														<Show when={invitation.active}>
															<DeleteLinkModal
																invitation={invitation}
																refetch={refetch}
															>
																<Button
																	size="sm"
																	class="aspect-square h-6 p-0! text-destructive hover:text-destructive hover:bg-destructive/25 hover:dark:bg-destructive/25"
																	variant="ghost"
																>
																	<TrashIcon width={16} height={16} />
																</Button>
															</DeleteLinkModal>
														</Show>
													</TableCell>
												</Show>
											</TableRow>
										)}
									</For>
								</TableBody>
							</Table>
							<InviteLinkCreationModal generateNew refetch={refetch}>
								<Button variant="secondary" class="w-fit">
									<PlusIcon />
									Create new invite
								</Button>
							</InviteLinkCreationModal>
						</>
					)}
				</Match>
			</Switch>
		</SettingsPage>
	);
};

const JoinRequestApprovals: Component = () => {
	const user = useUserContext();
	const community = useCommunityContext();

	const [loading] = createSignal<boolean>(false);
	const pendingMembers = () => community().applications;
	const dismissedMembers = () => community().dismissedApplications;

	const [inflight, setInflight] = createSignal<Array<string>>([]);
	const isInflight = (did: string) => inflight().some((x) => x === did);

	const runAction = async (did: string, action: () => Promise<unknown>) => {
		setInflight((current) => [...current, did]);
		try {
			await action();
		} finally {
			setInflight((current) => current.filter((x) => x !== did));
			community().utils.refetchApplications();
		}
	};

	const acceptJoinRequest = (member: Applicant) =>
		runAction(member.did, () =>
			user.xrpc.social.colibri.community.approveMembership(member.membership),
		);

	const dismissJoinRequest = (member: Applicant) =>
		runAction(member.did, () =>
			user.xrpc.social.colibri.community.dismissApplication(
				community().community.uri,
				member.did,
			),
		);

	const restoreJoinRequest = (member: Applicant) =>
		runAction(member.did, () =>
			user.xrpc.social.colibri.community.undismissApplication(
				community().community.uri,
				member.did,
			),
		);

	const ApproveButton: Component<{ member: Applicant }> = (props) => (
		<Button
			size="sm"
			class="aspect-square h-6 p-0! text-green-400 hover:text-green-400 hover:bg-green-400/25 hover:dark:bg-green-400/25"
			disabled={isInflight(props.member.did)}
			onClick={() => {
				acceptJoinRequest(props.member);
			}}
			variant="ghost"
		>
			<Spinner
				classList={{
					hidden: !isInflight(props.member.did),
					block: isInflight(props.member.did),
				}}
			/>
			<CheckIcon
				classList={{
					hidden: isInflight(props.member.did),
				}}
			/>
		</Button>
	);

	return (
		<SettingsPage
			loading={loading}
			title={`Join Requests${pendingMembers().length > 0 ? ` — ${pendingMembers().length}` : ""}`}
		>
			<Switch>
				<Match when={pendingMembers().length === 0}>
					<p class="text-muted-foreground m-0">No pending join requests.</p>
				</Match>
				<Match when={pendingMembers().length > 0}>
					<Table class="h-full">
						<TableHeader>
							<TableRow>
								<TableHead class="w-[350px]">User</TableHead>
								<TableHead class="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody class="relative">
							<For each={pendingMembers()}>
								{(data) => (
									<TableRow>
										<TableCell>
											<Suspense fallback={<Spinner />}>
												<User.InlineProfile user={data} />
											</Suspense>
										</TableCell>
										<TableCell class="justify-end items-center flex flex-row gap-1">
											<ApproveButton member={data} />
											<Button
												size="sm"
												class="aspect-square h-6 p-0! text-destructive hover:text-destructive hover:bg-destructive/25 hover:dark:bg-destructive/25"
												disabled={isInflight(data.did)}
												onClick={() => {
													dismissJoinRequest(data);
												}}
												variant="ghost"
											>
												<Spinner
													classList={{
														hidden: !isInflight(data.did),
														block: isInflight(data.did),
													}}
												/>
												<XCircleIcon
													classList={{
														hidden: isInflight(data.did),
													}}
												/>
											</Button>
										</TableCell>
									</TableRow>
								)}
							</For>
						</TableBody>
					</Table>
				</Match>
			</Switch>
			<Show when={dismissedMembers().length > 0}>
				<h3 class="m-0 font-semibold">Dismissed</h3>
				<p class="m-0 text-muted-foreground text-sm">
					These applications are hidden from the active queue.
				</p>
				<Table class="h-full">
					<TableHeader>
						<TableRow>
							<TableHead class="w-[350px]">User</TableHead>
							<TableHead class="text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody class="relative">
						<For each={dismissedMembers()}>
							{(data) => (
								<TableRow>
									<TableCell>
										<Suspense fallback={<Spinner />}>
											<User.InlineProfile user={data} />
										</Suspense>
									</TableCell>
									<TableCell class="justify-end items-center flex flex-row gap-1">
										<ApproveButton member={data} />
										<Button
											size="sm"
											class="aspect-square h-6 p-0!"
											disabled={isInflight(data.did)}
											onClick={() => {
												restoreJoinRequest(data);
											}}
											variant="ghost"
											aria-label="Restore to queue"
										>
											<Spinner
												classList={{
													hidden: !isInflight(data.did),
													block: isInflight(data.did),
												}}
											/>
											<ArrowCounterClockwiseIcon
												classList={{
													hidden: isInflight(data.did),
												}}
											/>
										</Button>
									</TableCell>
								</TableRow>
							)}
						</For>
					</TableBody>
				</Table>
			</Show>
		</SettingsPage>
	);
};

const MemberActionsContextMenu: ParentComponent<{
	member: Member;
}> = (props) => {
	const user = useUserContext();
	const community = useCommunityContext()!;
	const { canBanMember, canKickMember } = usePermissions();

	const [dialog, setDialog] = createSignal<ActionDialogData>({
		open: false,
		type: "kick",
	});

	return (
		<>
			<MemberActionDialog
				member={props.member}
				dialog={dialog}
				setDialog={setDialog}
			/>
			<DropdownMenu placement="bottom-end">
				<DropdownMenuTrigger>{props.children}</DropdownMenuTrigger>
				<DropdownMenuPortal>
					<DropdownMenuContent>
						<Show
							when={
								community().community.requiresApprovalToJoin &&
								canKickMember(user.did)
							}
						>
							<DropdownMenuItem
								class="text-destructive!"
								onClick={() => setDialog({ open: true, type: "kick" })}
							>
								<UserMinusIcon />
								<span>Kick</span>
							</DropdownMenuItem>
						</Show>
						<Show when={canBanMember(user.did)}>
							<DropdownMenuItem
								class="text-destructive!"
								onClick={() => setDialog({ open: true, type: "ban" })}
							>
								<ProhibitIcon />
								<span>Ban</span>
							</DropdownMenuItem>
						</Show>
					</DropdownMenuContent>
				</DropdownMenuPortal>
			</DropdownMenu>
		</>
	);
};

const MembersPage: Component = () => {
	const user = useUserContext();
	const community = useCommunityContext();
	const members = () => community().members;
	const { canBanMember, canKickMember, outranks } = usePermissions();

	return (
		<SettingsPage
			loading={() => false}
			title={`Members${members().length > 0 ? ` — ${members().length}` : ""}`}
		>
			<Table class="h-full">
				<TableHeader>
					<TableRow>
						<TableHead class="w-[350px]">User</TableHead>
						<TableHead class="text-right">Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody class="relative">
					<For each={members()}>
						{(member) => {
							return (
								<TableRow>
									<TableCell>
										<Suspense fallback={<Spinner />}>
											<User.InlineProfile color={false} user={member} />
										</Suspense>
									</TableCell>
									<Show
										when={
											outranks(user.did, member.did) &&
											(canBanMember(user.did) || canKickMember(user.did))
										}
										fallback={<span />}
									>
										<TableCell class="text-right">
											<MemberActionsContextMenu member={member}>
												<Button
													size="sm"
													class="aspect-square h-6 p-0!"
													variant="ghost"
												>
													<DotsThreeOutlineVerticalIcon />
												</Button>
											</MemberActionsContextMenu>
										</TableCell>
									</Show>
								</TableRow>
							);
						}}
					</For>
				</TableBody>
			</Table>
		</SettingsPage>
	);
};

const DeleteRoleModal: ParentComponent<{ role: Role }> = (props) => {
	const user = useUserContext();
	const community = useCommunityContext();

	const [loading, setLoading] = createSignal(false);
	const [open, setOpen] = createSignal(false);

	const memberCount = () =>
		community().members.filter((m) => m.roles.includes(props.role.uri)).length;

	const deleteRole = async () => {
		setLoading(true);
		try {
			const res = await user.xrpc.social.colibri.role.delete(props.role.uri);

			if (!res) {
				toast.error("Failed to delete role.");
				return;
			}

			toast.success("Role deleted.");
			community().utils.refetch();
			setOpen(false);
		} catch {
			toast.error("Failed to delete role.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<Dialog open={open()} onOpenChange={setOpen}>
			<DialogTrigger>{props.children}</DialogTrigger>
			<DialogPortal>
				<DialogContent class="w-128">
					<DialogHeader>
						<h2 class="m-0 text-center">
							Delete the “{props.role.name}” role?
						</h2>
					</DialogHeader>
					<div class="flex flex-col gap-2 text-center">
						<p class="m-0">
							{memberCount() > 0
								? `This role will be removed from ${memberCount()} member${
										memberCount() === 1 ? "" : "s"
									}. `
								: ""}
							This action cannot be undone.
						</p>
					</div>
					<DialogFooter>
						<Button
							variant="secondary"
							disabled={loading()}
							onClick={() => setOpen(false)}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							disabled={loading()}
							onClick={deleteRole}
						>
							<Spinner
								classList={{
									hidden: !loading(),
									block: loading(),
								}}
							/>
							Delete Role
						</Button>
					</DialogFooter>
				</DialogContent>
			</DialogPortal>
		</Dialog>
	);
};

const RolesPage: Component = () => {
	const user = useUserContext();
	const community = useCommunityContext();
	const { canManageRole } = usePermissions();
	const roles = () => community().assignableRoles;
	const membersForRole = (role: string) =>
		community().members.filter((x) => x.roles.some((y) => y === role)).length;

	const [search, setSearch] = createSignal("");
	const [saving, setSaving] = createSignal(false);
	// Optimistic ordering applied locally while the reorder request is in flight.
	// `null` means "follow the server's position-based order".
	const [override, setOverride] = createSignal<Array<Role> | null>(null);
	const [dragIndex, setDragIndex] = createSignal<number | null>(null);

	// Highest position sits at the top, matching the role hierarchy.
	const sortedRoles = () =>
		override() ?? [...roles()].sort((a, b) => b.position - a.position);

	const filteredRoles = () =>
		sortedRoles().filter((x) =>
			x.name.toLowerCase().includes(search().toLowerCase()),
		);

	// Dragging while a search is active would reorder against a filtered view,
	// so only allow it when the full list is shown.
	const canReorder = () => search().trim().length === 0 && !saving();

	// Drop the optimistic override once the server order catches up, or if the
	// set of roles changed underneath us (e.g. one was created/deleted).
	createEffect(() => {
		const ov = override();
		if (!ov) return;

		const serverUris = [...roles()]
			.sort((a, b) => b.position - a.position)
			.map((r) => r.uri);
		const ovUris = ov.map((r) => r.uri);

		const membershipChanged =
			serverUris.length !== ovUris.length ||
			ovUris.some((uri) => !serverUris.includes(uri));

		if (membershipChanged || serverUris.join(",") === ovUris.join(",")) {
			setOverride(null);
		}
	});

	const persistOrder = async (ordered: Array<Role>) => {
		// Top row gets the highest position; only push roles that actually moved.
		const total = ordered.length;
		const updates = ordered
			.map((role, i) => ({ role, position: total - i }))
			.filter(({ role, position }) => role.position !== position);

		if (updates.length === 0) {
			setOverride(null);
			return;
		}

		setSaving(true);
		try {
			await Promise.all(
				updates.map(({ role, position }) =>
					user.xrpc.social.colibri.role.update(
						role.uri,
						role.name,
						role.color,
						role.permissions,
						position,
						role.hoisted,
						role.mentionable,
					),
				),
			);
			// The authoritative positions arrive via `role_event`s, which reconcile
			// the optimistic override. Refetching here would race the AppView's
			// indexing and briefly reintroduce the old order, so we don't.
		} catch {
			toast.error("Failed to reorder roles.");
			setOverride(null);
			community().utils.refetch();
		} finally {
			setSaving(false);
		}
	};

	// Live-reorder while dragging so the rows visibly shuffle under the cursor.
	const moveRole = (from: number, to: number) => {
		const reordered = [...sortedRoles()];
		const [moved] = reordered.splice(from, 1);
		reordered.splice(to, 0, moved);
		setOverride(reordered);
	};

	return (
		<SettingsPage loading={() => false} title={`Roles`}>
			<div class="flex flex-row items-center gap-4">
				<TextField value={search()} onChange={setSearch}>
					<TextFieldInput placeholder="Search Roles" />
				</TextField>
				<RoleModal>
					<Button>Create Role</Button>
				</RoleModal>
			</div>
			<Table class="h-full">
				<TableHeader>
					<TableRow>
						<TableHead class="w-8" />
						<TableHead>Name</TableHead>
						<TableHead>Members</TableHead>
						<TableHead class="text-right">Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody class="relative">
					<For each={filteredRoles()}>
						{(role, index) => {
							const isDragging = () => dragIndex() === index();
							const manageable = () => canManageRole(user.did, role);
							let rowRef: HTMLTableRowElement | undefined;

							return (
								<TableRow
									ref={rowRef}
									classList={{
										"opacity-50": isDragging() || !manageable(),
									}}
									onDragOver={(e) => {
										const from = dragIndex();
										if (from === null) return;
										e.preventDefault();
										if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
										const to = index();
										if (from !== to) {
											moveRole(from, to);
											// Keep tracking the dragged row at its new position.
											setDragIndex(to);
										}
									}}
									onDrop={(e) => {
										if (dragIndex() !== null) e.preventDefault();
									}}
								>
									<TableCell class="text-muted-foreground w-8">
										<Show
											when={canReorder() && manageable()}
											fallback={<span />}
										>
											{/* Only the handle starts a drag, not the whole row. */}
											<div
												class="cursor-grab"
												draggable={true}
												onDragStart={(e) => {
													if (!canReorder() || !manageable()) return;
													setDragIndex(index());
													if (e.dataTransfer) {
														e.dataTransfer.effectAllowed = "move";
														// Required for Firefox to initiate the drag.
														e.dataTransfer.setData("text/plain", role.uri);
														// Drag the whole row as the ghost, not just the grip.
														if (rowRef) {
															e.dataTransfer.setDragImage(rowRef, 16, 16);
														}
													}
												}}
												onDragEnd={() => {
													const from = dragIndex();
													setDragIndex(null);
													if (from !== null) persistOrder([...sortedRoles()]);
												}}
											>
												<DotsSixVerticalIcon />
											</div>
										</Show>
									</TableCell>
									<TableCell>
										<div class="flex flex-row items-center gap-2">
											<IdentificationBadgeIconFilled
												style={{
													color: role.color,
												}}
											/>
											{role.name}
										</div>
									</TableCell>
									<TableCell>{membersForRole(role.uri)}</TableCell>
									<TableCell class="text-right flex flex-row gap-1 items-center justify-end">
										<Show
											when={manageable()}
											fallback={
												<>
													<Button
														size="sm"
														class="aspect-square h-6 p-0!"
														variant="ghost"
														disabled
													>
														<PenIcon />
													</Button>
													<Button
														size="sm"
														class="aspect-square h-6 p-0! text-destructive hover:text-destructive hover:bg-destructive/25 hover:dark:bg-destructive/25"
														variant="ghost"
														disabled
													>
														<TrashIcon />
													</Button>
												</>
											}
										>
											<RoleModal role={role.uri}>
												<Button
													size="sm"
													class="aspect-square h-6 p-0!"
													variant="ghost"
												>
													<PenIcon />
												</Button>
											</RoleModal>
											<DeleteRoleModal role={role}>
												<Button
													size="sm"
													class="aspect-square h-6 p-0! text-destructive hover:text-destructive hover:bg-destructive/25 hover:dark:bg-destructive/25"
													variant="ghost"
												>
													<TrashIcon />
												</Button>
											</DeleteRoleModal>
										</Show>
									</TableCell>
								</TableRow>
							);
						}}
					</For>
				</TableBody>
			</Table>
		</SettingsPage>
	);
};

const BannedMembersPage: Component = () => {
	const community = useCommunityContext();
	const user = useUserContext();
	const uri = () => community().community.uri;
	const [loading, setLoading] = createSignal<boolean>(false);

	const [bannedMembers, { refetch }] = createResource(uri, async (u) => {
		const res = await user.xrpc.social.colibri.community.listBannedUsers(u);
		return res?.users ?? [];
	});

	const unbanMember = async (did: string) => {
		try {
			setLoading(true);
			const res = await user.xrpc.social.colibri.community.unbanUser(
				uri(),
				did,
			);

			if (!res) {
				toast.error("Failed to unban user.");
				return;
			}

			toast.success("User unbanned.");
			refetch();
		} finally {
			setLoading(false);
		}
	};

	return (
		<SettingsPage
			loading={loading}
			title={`Banned Members${(bannedMembers() ?? []).length > 0 ? ` — ${(bannedMembers() ?? []).length}` : ""}`}
		>
			<Switch>
				<Match when={!bannedMembers()}>
					<div class="my-2 flex w-full items-center justify-center">
						<Spinner />
					</div>
				</Match>
				<Match when={bannedMembers()}>
					{(members) => (
						<Table class="h-full">
							<TableHeader>
								<TableRow>
									<TableHead class="w-[350px]">User</TableHead>
									<TableHead class="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody class="relative">
								<For each={members()}>
									{(data) => {
										return (
											<TableRow>
												<TableCell>
													<User.InlineProfile user={data} />
												</TableCell>
												<TableCell class="text-right">
													<Button
														size="sm"
														disabled={loading()}
														onClick={() => {
															unbanMember(data.did);
														}}
														variant="secondary"
													>
														<Spinner
															classList={{
																hidden: !loading(),
																block: loading(),
															}}
														/>
														Unban
													</Button>
												</TableCell>
											</TableRow>
										);
									}}
								</For>
							</TableBody>
						</Table>
					)}
				</Match>
			</Switch>
		</SettingsPage>
	);
};

const DangerSettingsPage: Component = () => {
	const navigate = useNavigate();
	const user = useUserContext();
	const community = useCommunityContext();

	const [loading, setLoading] = createSignal<boolean>(false);
	const [communityNameReset, setCommunityNameReset] = createSignal("");

	const isValid = () => communityNameReset() === community().community.name;

	const deleteCommunity = async () => {
		setLoading(true);

		const res = await user.xrpc.social.colibri.community.delete(
			community().community.uri,
		);

		setLoading(false);

		if (!res) {
			toast.error("Failed to delete community");
			return;
		}

		navigate("/");
	};

	return (
		<SettingsPage loading={loading} title="Danger Zone">
			<h3 class="m-0 font-semibold">Delete this Community</h3>
			<p class="m-0">
				To delete this community and all associated data, first type in the name
				of the community below. <strong>This action cannot be undone.</strong>
			</p>
			<div class="flex flex-row gap-2 items-baseline-last">
				<TextField
					value={communityNameReset()}
					onChange={setCommunityNameReset}
					validationState={isValid() ? "valid" : "invalid"}
					disabled={loading()}
				>
					<TextFieldInput
						placeholder={community().community.name}
						maxLength={32}
						minLength={1}
						type="text"
						required
					/>
				</TextField>
				<Button
					variant="destructive"
					disabled={loading() || !isValid()}
					onClick={deleteCommunity}
				>
					<Spinner
						classList={{
							hidden: !loading(),
							block: loading(),
						}}
					/>
					Delete Community
				</Button>
			</div>
		</SettingsPage>
	);
};

export const CommunitySettingsModal: ParentComponent<{
	open: Accessor<boolean>;
	setOpen: Setter<boolean>;
}> = (props) => {
	const user = useUserContext();
	const community = useCommunityContext();
	const {
		canManageRoles,
		canCreateInvitation,
		canDeleteInvitation,
		canManageApprovals,
		canDeleteCommunity,
		canUnbanMember,
		canManageCommunity,
	} = usePermissions();

	return (
		<SettingsModal
			open={props.open}
			setOpen={props.setOpen}
			pages={[
				{
					title: "Community Profile",
					id: "general",
					component: GeneralSettingsPage,
					icon: () => <WrenchIcon />,
					visible: () => canManageCommunity(user.did),
				},
				{
					title: "Members",
					id: "members",
					component: MembersPage,
					icon: () => <UsersIcon />,
				},
				{
					title: "Roles",
					id: "roles",
					component: RolesPage,
					icon: () => <IdentificationBadgeIcon />,
					visible: () => canManageRoles(user.did),
				},
				{
					title: "Invite Links",
					id: "invitations",
					component: InviteLinksPage,
					icon: () => <LinkIcon />,
					visible: () =>
						canCreateInvitation(user.did) || canDeleteInvitation(user.did),
				},
				{
					title: "Join Requests",
					id: "joins",
					component: JoinRequestApprovals,
					icon: () => <TicketIcon />,
					visible: () =>
						community().community.requiresApprovalToJoin &&
						canManageApprovals(user.did),
					badge: () => community().applications.length,
				},
				{
					title: "Banned Users",
					id: "bans",
					component: BannedMembersPage,
					icon: () => <ProhibitIcon />,
					visible: () => canUnbanMember(user.did),
				},
			]}
			dangerPage={{
				title: "Danger Zone",
				id: "danger",
				component: DangerSettingsPage,
				icon: () => <WarningDiamondIcon />,
				visible: () => canDeleteCommunity(user.did),
			}}
			debugPage={{
				title: "Debug Information",
				id: "info",
				component: () => <SettingsInfoPage uri={community().community.uri} />,
				icon: () => <BugIcon />,
			}}
		>
			{props.children}
		</SettingsModal>
	);
};
