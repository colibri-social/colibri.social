import type { Details } from "@kobalte/core/file-field";
import { useNavigate, useParams } from "@solidjs/router";
import type { Accessor, ParentComponent, Setter } from "solid-js";
import {
	type Component,
	createResource,
	createSignal,
	For,
	Match,
	Show,
	Suspense,
	Switch,
} from "solid-js";
import { toast } from "somoto";
import { parseZodToErrorOrDisplay } from "../../../utils/parse-zod-to-error-or-display";
import { Spinner } from "../../icons/Spinner";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "../../../components/ui/Alert";
import { Button } from "../../../components/ui/Button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogPortal,
} from "../../../components/ui/Dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuPortal,
	DropdownMenuTrigger,
} from "../../../components/ui/DropdownMenu";
import {
	FileField,
	FileFieldDropzone,
	FileFieldHiddenInput,
	FileFieldItem,
	FileFieldItemList,
	FileFieldItemPreviewImage,
	FileFieldLabel,
	FileFieldTrigger,
} from "../../../components/ui/FileField";
import {
	Switch as SwitchComp,
	SwitchControl,
	SwitchDescription,
	SwitchInput,
	SwitchLabel,
	SwitchThumb,
} from "../../../components/ui/Switch";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "../../../components/ui/Table";
import {
	TextField,
	TextFieldInput,
	TextFieldLabel,
} from "../../../components/ui/TextField";
import { useCommunityContext } from "../../../contexts/Community";
import { resolveBlob } from "../../../atproto/resolve-blob";
import { useUserContext } from "../../../contexts/User";
import { SettingsModal, SettingsPage } from "../common/SettingsModal";
import XCircleIcon from "~icons/ph/x-circle";
import ImageIcon from "~icons/ph/image";
import User from "../user";
import PlusIcon from "~icons/ph/plus";
import { DeleteLinkModal } from "./DeleteInvitationModal";
import { InviteLinkCreationModal } from "./InviteLinkCreationModal";
import { SettingsInfoPage } from "../common/SettingsInfoPage";
import { Member } from "../../../atproto/xrpc/social/colibri/community/listMembers";
import { Applicant } from "../../../atproto/xrpc/social/colibri/community/listApplications";
import { displayableNameFn } from "../user/DisplayableName";

const GeneralSettingsPage: Component = () => {
	const user = useUserContext();
	const community = useCommunityContext();

	const [loading, setLoading] = createSignal<boolean>(false);
	const [name, setName] = createSignal(community().community.name);
	const [description, setDescription] = createSignal(
		community().community.description,
	);
	const [image, setImage] = createSignal<Details>();
	const [imageRemoved, setImageRemoved] = createSignal(false);
	const [requiresApprovalToJoin, setRequiresApprovalToJoin] = createSignal(
		community().community.requiresApprovalToJoin,
	);

	const existingImageUrl = () =>
		!imageRemoved() && image() === undefined
			? (resolveBlob(community().did, community().community.picture) ?? null)
			: null;

	const hasEdited = (): boolean =>
		name() !== community().community.name ||
		description() !== community().community.description ||
		imageRemoved() ||
		image() !== undefined ||
		requiresApprovalToJoin() !== community().community.requiresApprovalToJoin;

	const clearNewFile = (e?: MouseEvent) => {
		e?.preventDefault();
		e?.stopPropagation();
		setImage(undefined);
	};

	const removeExistingImage = (e: MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setImageRemoved(true);
	};

	const editCommunityData = async () => {
		setLoading(true);
		try {
			// Download original image, convert to base64 if defined and not changed
			const existingImage = existingImageUrl();
			const reader = new FileReader();

			let base64Image: string | undefined;
			let mimeType: string | undefined;

			if (existingImage) {
				const originalImage = await (await fetch(existingImage)).blob();

				base64Image = await new Promise<string>((resolve, reject) => {
					reader.onload = () => resolve(reader.result as string);
					reader.onerror = reject;
					reader.readAsDataURL(originalImage);
				});

				mimeType = originalImage.type;
				// Get mime type for image, convert to base64
			} else if (image()) {
				base64Image = await new Promise<string>((resolve, reject) => {
					reader.onload = () => resolve(reader.result as string);
					reader.onerror = reject;
					reader.readAsDataURL(image()!.acceptedFiles[0]);
				});

				mimeType = image()!.acceptedFiles[0].type;
			}

			await user.xrpc.social.colibri.community.update(
				community().community.uri,
				name().trim() !== community().community.name
					? name().trim()
					: undefined,
				description().trim() !== (community().community.description ?? "")
					? description().trim()
					: undefined,
				base64Image,
				mimeType,
			);

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
		clearNewFile();
		setImageRemoved(false);
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
			<FileField class="items-start" onFileChange={setImage} maxFiles={1}>
				<FileFieldLabel>Community Image</FileFieldLabel>
				<FileFieldDropzone class="h-32 w-32 min-h-0">
					<FileFieldTrigger class="h-32 w-32 p-0 bg-muted/25 hover:bg-muted/50 rounded-sm overflow-hidden">
						<Switch>
							<Match when={image() !== undefined}>
								<div class="relative w-32 h-32">
									<FileFieldItemList class="w-32 h-32 m-0 p-0">
										{() => (
											<FileFieldItem class="w-32 h-32 m-0 p-0 border-none [&>div]:w-32">
												<FileFieldItemPreviewImage class="w-32 h-32 object-cover" />
											</FileFieldItem>
										)}
									</FileFieldItemList>
									<button
										type="button"
										class="absolute top-1 right-1 text-white drop-shadow cursor-pointer"
										onClick={clearNewFile}
										aria-label="Remove selected image"
									>
										<XCircleIcon />
									</button>
								</div>
							</Match>
							<Match when={existingImageUrl() !== null}>
								<div class="relative w-32 h-32">
									<img
										src={existingImageUrl()!}
										alt={community().community.name}
										class="w-32 h-32 object-cover"
									/>
									<button
										type="button"
										class="absolute top-1 right-1 text-white drop-shadow cursor-pointer"
										onClick={removeExistingImage}
										aria-label="Remove image"
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
										<TableHead class="text-right">Delete</TableHead>
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
														<User.InlineProfile user={invitation.createdBy} />
													</Suspense>
												</TableCell>
												<TableCell>
													{invitation.active ? "Yes" : "No"}
												</TableCell>
												<TableCell class="text-right">
													<Show when={invitation.active}>
														<DeleteLinkModal
															invitation={invitation}
															refetch={refetch}
														>
															<Button variant="destructive" size="sm">
																Delete
															</Button>
														</DeleteLinkModal>
													</Show>
												</TableCell>
											</TableRow>
										)}
									</For>
								</TableBody>
							</Table>
							<InviteLinkCreationModal generateNew refetch={refetch}>
								<Button variant="secondary">
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
	const uri = () => community().community.uri;

	const [loading] = createSignal<boolean>(false);
	const [pendingMembers, { refetch }] = createResource(uri, async (u) => {
		const res = await user.xrpc.social.colibri.community.listApplications(u);
		return res?.applications ?? [];
	});

	const [inflightApprovals, setInflightApprovals] = createSignal<
		Array<Applicant>
	>([]);

	const acceptJoinRequest = async (member: Applicant) => {
		setInflightApprovals((current) => [...current, member]);

		await user.xrpc.social.colibri.community.approveMembership(
			member.membership,
		);

		setInflightApprovals((current) =>
			current.filter((x) => x.did !== member.did),
		);

		refetch();
	};

	return (
		<SettingsPage loading={loading} title="Join Requests">
			<Switch>
				<Match when={!pendingMembers()}>
					<div class="my-2 flex w-full items-center justify-center">
						<Spinner />
					</div>
				</Match>
				<Match when={pendingMembers()}>
					{(member) => (
						<Table class="h-full">
							<TableHeader>
								<TableRow>
									<TableHead class="w-[350px]">User</TableHead>
									<TableHead class="text-right">Accept</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody class="relative">
								<For each={member()}>
									{(data) => {
										const loading = () =>
											inflightApprovals().some((x) => x.did === data.did);
										return (
											<TableRow>
												<TableCell>
													<Suspense fallback={<Spinner />}>
														<User.InlineProfile user={data.data} />
													</Suspense>
												</TableCell>
												<TableCell class="text-right">
													<Button
														size="sm"
														disabled={loading()}
														onClick={() => {
															acceptJoinRequest(data);
														}}
														variant="secondary"
													>
														<Spinner
															classList={{
																hidden: !loading(),
																block: loading(),
															}}
														/>
														Accept
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

type ActionDialogData = {
	open: boolean;
	type: "kick" | "block";
};

const ActionDialog: ParentComponent<{
	dialog: Accessor<ActionDialogData>;
	setDialog: Setter<ActionDialogData>;
	member: Member;
	refetch: () => void;
}> = (props) => {
	const community = useCommunityContext()!;
	const [loading, setLoading] = createSignal(false);

	const header = () =>
		props.dialog().type === "kick"
			? `Kick ${displayableNameFn(props.member)} from this community?`
			: `Block ${displayableNameFn(props.member)} from this community?`;

	const description = () =>
		props.dialog().type === "kick"
			? "They will be able to re-join with a link."
			: "They will be unable to rejoin unless you revoke the block.";

	const handleAction = async () => {
		setLoading(true);

		const kickData = await actions.removeApprovalRecord({
			community: community.rkey(),
			member: props.member.member_did,
		});

		if (kickData.error) {
			setLoading(false);
			toast.error("Failed to remove approval record", {
				description: parseZodToErrorOrDisplay(kickData.error.message),
			});
			return;
		}

		if (props.dialog().type === "block") {
			const banData = await actions.blockDidFromCommunity({
				community: community.rkey(),
				member: props.member.member_did,
			});

			if (banData.error) {
				setLoading(false);
				toast.error("Failed to ban user. They have been kicked instead.", {
					description: parseZodToErrorOrDisplay(banData.error.message),
				});
				return;
			}
		}

		setLoading(false);

		// TODO(app): Band-aid fix, race condition n all that. Wait for member to join via global context.
		setTimeout(props.refetch, 1000);
	};

	return (
		<Dialog open={props.dialog().open}>
			<DialogPortal>
				<DialogContent class="w-128">
					<DialogHeader>
						<h2 class="m-0 text-center">{header()}</h2>
					</DialogHeader>
					<div class="flex flex-col gap-4">
						<p class="m-0 text-center">{description()}</p>
					</div>
					<DialogFooter>
						<Button
							variant="secondary"
							disabled={loading()}
							onClick={() =>
								props.setDialog((current) => ({
									open: false,
									type: current.type,
								}))
							}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							disabled={loading()}
							onClick={handleAction}
						>
							<Spinner
								classList={{
									hidden: !loading(),
									block: loading(),
								}}
							/>
							{props.dialog().type === "kick" ? "Kick" : "Block"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</DialogPortal>
		</Dialog>
	);
};

const MemberActionsContextMenu: ParentComponent<{
	member: MemberData;
	refetch: () => void;
}> = (props) => {
	const community = useCommunityContext()!;

	const [dialog, setDialog] = createSignal<ActionDialogData>({
		open: false,
		type: "kick",
	});

	return (
		<>
			<ActionDialog
				refetch={props.refetch}
				member={props.member}
				dialog={dialog}
				setDialog={setDialog}
			/>
			<DropdownMenu placement="bottom-end">
				<DropdownMenuTrigger>{props.children}</DropdownMenuTrigger>
				<DropdownMenuPortal>
					<DropdownMenuContent>
						<Show when={!community.requiresApprovalToJoin}>
							<DropdownMenuItem
								class="text-destructive!"
								onClick={() => setDialog({ open: true, type: "kick" })}
							>
								<Icon
									name="boot-icon"
									variant="fill"
									class="text-destructive"
								/>
								Kick
							</DropdownMenuItem>
						</Show>
						<DropdownMenuItem
							class="text-destructive!"
							onClick={() => setDialog({ open: true, type: "block" })}
						>
							<Icon
								name="prohibit-icon"
								variant="fill"
								class="text-destructive"
							/>
							Block
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenuPortal>
			</DropdownMenu>
		</>
	);
};

const fetchMembers = async ([community, owner]: [string, string]) => {
	return await actions.listMembers({ community, owner });
};

const MembersPage: Component = () => {
	const params = useParams();
	const [globalData] = useGlobalContext();

	const community = () => params.community!;

	const [loading] = createSignal<boolean>(false);
	const [communityMembers, { refetch }] = createResource(
		() => [community(), globalData.user.sub] as [string, string],
		fetchMembers,
		{ initialValue: { data: [], error: undefined } },
	);

	return (
		<SettingsPage
			loading={loading}
			title={`Members${(communityMembers().data ?? []).length > 0 ? ` (${(communityMembers().data ?? []).length})` : ""}`}
		>
			<Switch>
				<Match when={!communityMembers()}>
					<div class="my-2 flex w-full items-center justify-center">
						<Spinner />
					</div>
				</Match>
				<Match when={communityMembers()}>
					{(member) => (
						<Table class="h-full">
							<TableHeader>
								<TableRow>
									<TableHead class="w-[350px]">User</TableHead>
									<TableHead class="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody class="relative">
								<Switch>
									<Match when={member().error}>
										<Alert variant="destructive" class="my-2 absolute">
											<AlertTitle>
												An error occurred while fetching the data:
											</AlertTitle>
											<AlertDescription>
												{member().error!.message}
											</AlertDescription>
										</Alert>
									</Match>
									<Match when={member().data}>
										{(data) => (
											<For each={data()}>
												{(data) => {
													return (
														<TableRow>
															<TableCell>
																<Suspense fallback={<Spinner />}>
																	<SmallUserAsync did={data.member_did} />
																</Suspense>
															</TableCell>
															<TableCell class="text-right">
																<MemberActionsContextMenu
																	member={data}
																	refetch={refetch}
																>
																	<Button
																		size="sm"
																		class="p-0 aspect-square"
																		variant="ghost"
																	>
																		<Icon
																			name="dots-three-outline-vertical-icon"
																			variant="fill"
																		/>
																	</Button>
																</MemberActionsContextMenu>
															</TableCell>
														</TableRow>
													);
												}}
											</For>
										)}
									</Match>
								</Switch>
							</TableBody>
						</Table>
					)}
				</Match>
			</Switch>
		</SettingsPage>
	);
};

const fetchBlockedMembers = async ([community, owner]: [string, string]) => {
	return await actions.listBlockedMembers({ community, owner });
};

const BlockedMembersPage: Component = () => {
	const params = useParams();
	const [globalData] = useGlobalContext();

	const community = () => params.community!;

	const [loading, setLoading] = createSignal<boolean>(false);
	const [blockedMembers, { refetch }] = createResource(
		() => [community(), globalData.user.sub] as [string, string],
		fetchBlockedMembers,
		{ initialValue: { data: [], error: undefined } },
	);

	const unblockMember = async (member: string) => {
		setLoading(true);

		const unblockRes = await actions.unblockDidFromCommunity({
			community: community(),
			member: member,
		});

		if (unblockRes.error) {
			setLoading(false);
			toast.error("Failed to remove unblock user", {
				description: parseZodToErrorOrDisplay(unblockRes.error.message),
			});
			return;
		}

		setLoading(false);

		// TODO(app): Band-aid fix, race condition n all that. Wait for member to join via global context.
		setTimeout(refetch, 1000);
	};

	return (
		<SettingsPage
			loading={loading}
			title={`Blocked Members${(blockedMembers().data ?? []).length > 0 ? ` (${(blockedMembers().data ?? []).length})` : ""}`}
		>
			<Switch>
				<Match when={!blockedMembers()}>
					<div class="my-2 flex w-full items-center justify-center">
						<Spinner />
					</div>
				</Match>
				<Match when={blockedMembers()}>
					{(member) => (
						<Table class="h-full">
							<TableHeader>
								<TableRow>
									<TableHead class="w-[350px]">User</TableHead>
									<TableHead class="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody class="relative">
								<Switch>
									<Match when={member().error}>
										<Alert variant="destructive" class="my-2 absolute">
											<AlertTitle>
												An error occurred while fetching the data:
											</AlertTitle>
											<AlertDescription>
												{member().error!.message}
											</AlertDescription>
										</Alert>
									</Match>
									<Match when={member().data}>
										{(data) => (
											<For each={data()}>
												{(data) => {
													return (
														<TableRow>
															<TableCell>
																<Suspense fallback={<Spinner />}>
																	<SmallUserAsync did={data.member_did} />
																</Suspense>
															</TableCell>
															<TableCell class="text-right">
																<Button
																	size="sm"
																	disabled={loading()}
																	onClick={() => {
																		unblockMember(data.member_did);
																	}}
																	variant="secondary"
																>
																	<Spinner
																		classList={{
																			hidden: !loading(),
																			block: loading(),
																		}}
																	/>
																	Unblock
																</Button>
															</TableCell>
														</TableRow>
													);
												}}
											</For>
										)}
									</Match>
								</Switch>
							</TableBody>
						</Table>
					)}
				</Match>
			</Switch>
		</SettingsPage>
	);
};

const DangerSettingsPage: Component = () => {
	const [globalData, { removeCommunity }] = useGlobalContext();
	const params = useParams();
	const navigate = useNavigate();

	const [loading, setLoading] = createSignal<boolean>(false);
	const [communityNameReset, setCommunityNameReset] = createSignal("");

	const community = () =>
		globalData.communities.find((x) => x.rkey === params.community);
	const isValid = () => communityNameReset() === community()?.name;

	const deleteCommunity = async () => {
		setLoading(true);

		const deletedCommunity = await actions.deleteCommunity({
			rkey: community()!.rkey,
		});

		setLoading(false);

		if (deletedCommunity.error) {
			toast.error("Failed to delete community", {
				description: parseZodToErrorOrDisplay(deletedCommunity.error.message),
			});
			return;
		}

		removeCommunity(community()!.rkey);
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
						placeholder={community()?.name}
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

export const CommunitySettingsModal: ParentComponent = (props) => {
	const params = useParams();
	const community = useCommunityContext();

	return (
		<SettingsModal
			pages={[
				{
					title: "Community Profile",
					id: "general",
					component: GeneralSettingsPage,
					icon: "wrench-icon",
				},
				{
					title: "Members",
					id: "members",
					component: MembersPage,
					icon: "users-icon",
				},
				{
					title: "Invite Links",
					id: "invitations",
					component: InviteLinksPage,
					icon: "link-icon",
				},
				{
					title: "Join Requests",
					id: "joins",
					component: JoinRequestApprovals,
					icon: "ticket-icon",
					visible: community().community.requiresApprovalToJoin ?? true,
				},
				{
					title: "Blocked Users",
					id: "blocks",
					component: BlockedMembersPage,
					icon: "prohibit-icon",
				},
			]}
			dangerPage={{
				title: "Danger Zone",
				id: "danger",
				component: DangerSettingsPage,
				icon: "warning-diamond-icon",
			}}
			debugPage={{
				title: "Debug Information",
				id: "info",
				component: () => <SettingsInfoPage uri={community().community.uri} />,
				icon: "bug-icon",
			}}
		>
			{props.children}
		</SettingsModal>
	);
};
