import { actions } from "astro:actions";
import type { Details } from "@kobalte/core/file-field";
import { useNavigate, useParams } from "@solidjs/router";
import type { ParentComponent } from "solid-js";
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
import { Icon } from "@/components/solid/icons/Icon";
import { RECORD_IDs } from "@/utils/atproto/lexicons";
import { parseZodToErrorOrDisplay } from "@/utils/parse-zod-to-error-or-display";
import { useGlobalContext } from "../../contexts/GlobalContext";
import { InviteLinkCreationModal } from "../../contexts/GlobalContext/InviteLinkCreationModal";
import { Spinner } from "../../icons/Spinner";
import type { MemberData } from "../../layouts/CommunityLayout";
import { Alert, AlertDescription, AlertTitle } from "../../shadcn-solid/Alert";
import { Button } from "../../shadcn-solid/Button";
import {
	FileField,
	FileFieldDropzone,
	FileFieldHiddenInput,
	FileFieldItem,
	FileFieldItemList,
	FileFieldItemPreviewImage,
	FileFieldLabel,
	FileFieldTrigger,
} from "../../shadcn-solid/file-field";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "../../shadcn-solid/Table";
import {
	TextField,
	TextFieldInput,
	TextFieldLabel,
} from "../../shadcn-solid/text-field";
import { SettingsInfoPage } from "../SettingsInfoPage";
import { SettingsModal, SettingsPage } from "../SettingsModal";
import { SmallUserAsync } from "../SmallUserAsync";
import { DeleteLinkModal } from "./DeleteLinkModal";

const GeneralSettingsPage: Component = () => {
	const [globalData, { addCommunity }] = useGlobalContext();
	const params = useParams();

	const community = () =>
		globalData.communities.find((x) => x.rkey === params.community)!;

	const [loading, setLoading] = createSignal<boolean>(false);
	const [name, setName] = createSignal(community().name);
	const [description, setDescription] = createSignal(community().description);
	const [image, setImage] = createSignal<Details>();
	const [imageRemoved, setImageRemoved] = createSignal(false);

	const existingImageUrl = () =>
		!imageRemoved() && image() === undefined
			? (community().picture ?? null)
			: null;

	const hasEdited = (): boolean =>
		name() !== community().name ||
		description() !== community().description ||
		imageRemoved() ||
		image() !== undefined;

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

		const communityData = await actions.editCommunity({
			name: name(),
			description: description(),
			rkey: community().rkey,
			image: base64Image
				? {
						base64: base64Image,
						type: mimeType!,
					}
				: undefined,
		});

		if (communityData.error) {
			setLoading(false);
			toast.error("Failed to update community", {
				description: parseZodToErrorOrDisplay(communityData.error.message),
			});
			return;
		}

		addCommunity(communityData.data!);
		resetCommunityData();
		setLoading(false);
	};

	const resetCommunityData = () => {
		setName(community().name);
		setDescription(community().description);
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
										<Icon
											variant="regular"
											name="x-circle-icon"
											class="w-5! h-5!"
										/>
									</button>
								</div>
							</Match>
							<Match when={existingImageUrl() !== null}>
								<div class="relative w-32 h-32">
									<img
										src={existingImageUrl()!}
										alt={community().name}
										class="w-32 h-32 object-cover"
									/>
									<button
										type="button"
										class="absolute top-1 right-1 text-white drop-shadow cursor-pointer"
										onClick={removeExistingImage}
										aria-label="Remove image"
									>
										<Icon
											variant="regular"
											name="x-circle-icon"
											class="w-5! h-5!"
										/>
									</button>
								</div>
							</Match>
							<Match when={true}>
								<div class="flex flex-col items-center justify-center gap-1">
									<Icon variant="regular" name="image-icon" class="w-6! h-6!" />
									<span>Upload</span>
								</div>
							</Match>
						</Switch>
					</FileFieldTrigger>
				</FileFieldDropzone>
				<FileFieldHiddenInput />
			</FileField>
		</SettingsPage>
	);
};

const fetchCodes = async (community: string) => {
	return await actions.listInviteCodes({ community });
};

const InviteLinksPage: Component = () => {
	const params = useParams();

	const [loading] = createSignal<boolean>(false);
	const [codes, { refetch }] = createResource(
		() => params.community,
		fetchCodes,
	);

	return (
		<SettingsPage loading={loading} title="Invite Links">
			<Switch>
				<Match when={!codes()}>
					<div class="my-2 flex w-full items-center justify-center">
						<Spinner />
					</div>
				</Match>
				<Match when={codes()}>
					{(codes) => (
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
									<Switch>
										<Match when={codes().error}>
											<Alert variant="destructive" class="my-2 absolute">
												<AlertTitle>
													An error occurred while fetching the data:
												</AlertTitle>
												<AlertDescription>
													{codes().error!.message}
												</AlertDescription>
											</Alert>
										</Match>
										<Match when={codes().data}>
											{(data) => (
												<For each={data().sort((x) => (x.active ? -1 : 1))}>
													{(code) => (
														<TableRow
															classList={{
																"opacity-50": !code.active,
															}}
														>
															<TableCell class="font-medium">
																{code.code}
															</TableCell>
															<TableCell>
																<Suspense fallback={<Spinner />}>
																	<SmallUserAsync did={code.created_by_did} />
																</Suspense>
															</TableCell>
															<TableCell>
																{code.active ? "Yes" : "No"}
															</TableCell>
															<TableCell class="text-right">
																<Show when={code.active}>
																	<DeleteLinkModal
																		code={code.code}
																		ownerDID={code.created_by_did}
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
											)}
										</Match>
									</Switch>
								</TableBody>
							</Table>
							<InviteLinkCreationModal
								generateNew
								community={(() => params.community!)()}
								refetch={refetch}
							>
								<Button variant="secondary">
									<Icon variant="regular" name="plus-icon" />
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

const fetchPendingMembers = async ([community, owner]: [string, string]) => {
	return await actions.listPendingMembers({ community, owner });
};

const JoinRequestApprovals: Component = () => {
	const params = useParams();
	const [globalData] = useGlobalContext();

	const community = () => params.community!;

	const [inflightApprovals, setInflightApprovals] = createSignal<
		Array<MemberData>
	>([]);
	const [loading] = createSignal<boolean>(false);
	const [pendingMembers, { refetch }] = createResource(
		() => [community(), globalData.user.sub] as [string, string],
		fetchPendingMembers,
	);

	const acceptJoinRequest = async (member: MemberData) => {
		setInflightApprovals((current) => [...current, member]);

		const res = await actions.approveJoinRequest({
			member: member.member_did,
			community: community(),
		});

		setInflightApprovals((current) =>
			current.filter((x) => x.member_did !== member.member_did),
		);

		if (res.error) {
			toast.error("Failed to approve request", {
				description: parseZodToErrorOrDisplay(res.error.message),
			});
			return;
		}

		// TODO(launch): Band-aid fix, race condition n all that. Wait for member to join via global context.
		setTimeout(refetch, 1000);
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
									<TableHead class="w-[150px]">User</TableHead>
									<TableHead class="text-right">Accept</TableHead>
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
													const loading = () =>
														inflightApprovals().some(
															(x) => x.member_did === data.member_did,
														);
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
																		acceptJoinRequest(data);
																	}}
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
	const [globalData] = useGlobalContext();
	const params = useParams();

	const community = () =>
		globalData.communities.find((x) => x.rkey === params.community);

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
				component: () => (
					<SettingsInfoPage
						did={community()!.owner_did}
						collection={RECORD_IDs.COMMUNITY}
						rkey={community()!.rkey}
					/>
				),
				icon: "bug-icon",
			}}
		>
			{props.children}
		</SettingsModal>
	);
};
