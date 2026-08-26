import type { Details } from "@kobalte/core/file-field";
import {
	type Component,
	createSignal,
	For,
	Match,
	onMount,
	type ParentComponent,
	Show,
	Switch,
} from "solid-js";
import { toast } from "somoto";
import XCircleIcon from "~icons/ph/x-circle";
import { namespace } from "../../atproto/cache/keys";
import { resolveHandleToDid } from "../../atproto/identity";
import { colibri } from "../../atproto/lexicons";
import {
	advancePending,
	clearPending,
	creationInFlight,
	readPending,
	setCreationInFlight,
	writePending,
} from "../../atproto/pending-community";
import { resumeQuietly } from "../../atproto/resume-community-creation";
import { frameIs, progressStepLabel } from "../../atproto/sync-frames";
import type { CommunityView, LegacyCommunityView } from "../../atproto/views";
import type { ColibriClient } from "../../atproto/xrpc";
import { useSocketContext } from "../../contexts/Socket";
import { useUserContext } from "../../contexts/User";
import { classifyThrown } from "../../errors/classify";
import { ColibriError } from "../../errors/error";
import { showError } from "../../errors/show-error";
import { getAppViewDid } from "../../utils/appview";
import { IMAGE_UPLOAD_ACCEPT } from "../../utils/image-upload";
import { createLogger } from "../../utils/logger";
import { Image } from "../icons/Image";
import { Spinner } from "../icons/Spinner";
import { Button } from "../ui/Button";
import { DialogFooter } from "../ui/Dialog";
import {
	FileField,
	FileFieldDropzone,
	FileFieldHiddenInput,
	FileFieldItem,
	FileFieldItemList,
	FileFieldItemPreviewImage,
	FileFieldTrigger,
	takeImagePick,
} from "../ui/FileField";
import {
	RadioGroup,
	RadioGroupItem,
	RadioGroupItemInput,
	RadioGroupItemLabel,
	RadioGroupItems,
} from "../ui/RadioGroup";
import { ResponsiveDialog } from "../ui/ResponsiveDialog";
import {
	Switch as SwitchComp,
	SwitchControl,
	SwitchDescription,
	SwitchInput,
	SwitchLabel,
	SwitchThumb,
} from "../ui/Switch";
import {
	TextField,
	TextFieldDescription,
	TextFieldInput,
	TextFieldLabel,
} from "../ui/TextField";

const log = createLogger("community-create");

const COMMUNITY_DETAILS = 1;
const LOADING = 2;
const UNFINISHED = 3;
const BUSY = 4;

const MAX_PICTURE_BYTES = 1_048_576;
const MAX_BANNER_BYTES = 4_194_304;

const CREATE_TIMEOUT_MS = 120_000;
const INDEX_ATTEMPTS = 10;
const INDEX_POLL_MS = 1_000;

type CreationMode = "create" | "adopt" | "migrate";

const MIGRATION_OFFERED = false;

const MODE_CHOICES: Array<{
	value: CreationMode;
	label: string;
	description: string;
}> = [
	{
		value: "create",
		label: "Create new",
		description: "Colibri hosts it for you.",
	},
	// {
	// 	value: "adopt",
	// 	label: "Adopt an account",
	// 	description: "Bring an existing AT Protocol account.",
	// },
	...(MIGRATION_OFFERED
		? [
				{
					value: "migrate" as const,
					label: "Migrate a legacy community",
					description: "Rebuild an old Colibri community on spaces.",
				},
			]
		: []),
];

const isValidHandleOrDid = (value: string): boolean => {
	const trimmed = value.trim().toLowerCase();

	if (trimmed.startsWith("did:")) {
		const parts = trimmed.split(":");
		return parts.length >= 3 && parts.every((part) => part.length > 0);
	}

	return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(
		trimmed,
	);
};

const isValidAccountPassword = (value: string): boolean =>
	value.trim().length >= 8;

const putCommunityImage = async (
	client: ColibriClient,
	did: string,
	kind: "picture" | "banner",
	file: File,
	maxBytes: number,
): Promise<CommunityView> => {
	if (file.size > maxBytes) {
		throw new ColibriError({ code: "ImageTooLarge" });
	}
	const res = await client.call(colibri.community.putImage.main, {
		params: { community: did, kind },
		body: file,
		encoding: file.type,
	});
	if (!res.ok) throw res.error;
	return res.data.community;
};

const applyPendingImages = async (
	client: ColibriClient,
	community: CommunityView,
	pictureFile: File | undefined,
	bannerFile: File | undefined,
): Promise<{ community: CommunityView; unsaved: boolean }> => {
	let latest = community;
	let unsaved = false;

	const apply = async (
		kind: "picture" | "banner",
		file: File | undefined,
		maxBytes: number,
	) => {
		if (!file) return;
		try {
			latest = await putCommunityImage(
				client,
				latest.did,
				kind,
				file,
				maxBytes,
			);
		} catch (err) {
			unsaved = true;
			log.warn(`could not save the community ${kind}`, {
				code: classifyThrown(err).code,
			});
		}
	};

	await apply("picture", pictureFile, MAX_PICTURE_BYTES);
	await apply("banner", bannerFile, MAX_BANNER_BYTES);

	return { community: latest, unsaved };
};

const IMAGES_UNSAVED_MESSAGE =
	"Your picture and banner weren't saved. You can set them in community settings.";

export const CommunityCreationModal: ParentComponent = (props) => {
	const user = useUserContext();

	const [mode, setMode] = createSignal<CreationMode>("create");

	const [name, setName] = createSignal<string>("");
	const [description, setDescription] = createSignal<string>("");
	const [picture, setPicture] = createSignal<Details>();
	const [banner, setBanner] = createSignal<Details>();
	const [requiresApprovalToJoin, setRequiresApprovalToJoin] =
		createSignal<boolean>(false);

	const [identifier, setIdentifier] = createSignal<string>("");
	const [password, setPassword] = createSignal<string>("");

	const [legacyCandidates, setLegacyCandidates] = createSignal<
		LegacyCommunityView[]
	>([]);
	const [unreadableLegacyDids, setUnreadableLegacyDids] = createSignal<
		string[]
	>([]);
	const [migratableStatus, setMigratableStatus] = createSignal<
		"loading" | "loaded" | "error"
	>("loading");
	const [includeUnadministered, setIncludeUnadministered] =
		createSignal<boolean>(false);
	const [selectedLegacyDid, setSelectedLegacyDid] = createSignal<string>("");

	const [loading, _setLoading] = createSignal<boolean>(false);
	const [open, setOpen] = createSignal(false);
	const [step, setStep] = createSignal<number>(COMMUNITY_DETAILS);

	const ns = () => namespace(getAppViewDid(), user.did);

	const enterModal = (next: boolean) => {
		if (next && !creationInFlight() && readPending(ns())) {
			setStep(UNFINISHED);
		}
		setOpen(next);
	};

	const resetState = () => {
		setMode("create");
		setName("");
		setDescription("");
		setPicture(undefined);
		setBanner(undefined);
		setRequiresApprovalToJoin(false);
		setIdentifier("");
		setPassword("");
		setLegacyCandidates([]);
		setUnreadableLegacyDids([]);
		setMigratableStatus("loading");
		setIncludeUnadministered(false);
		setSelectedLegacyDid("");
		setStep(COMMUNITY_DETAILS);
	};

	const nameValid = () =>
		name().trim().length > 0 && name().trim().length < 33 ? "valid" : "invalid";

	const descriptionValid = () =>
		description().trim().length < 257 ? "valid" : "invalid";

	const canCreate = () => {
		if (mode() === "migrate") {
			return selectedLegacyDid().length > 0;
		}

		const detailsValid =
			nameValid() === "valid" && descriptionValid() === "valid";

		if (mode() === "adopt") {
			return (
				detailsValid &&
				isValidHandleOrDid(identifier()) &&
				isValidAccountPassword(password())
			);
		}

		return detailsValid;
	};

	const loadMigratableCommunities = async (showAll: boolean) => {
		setMigratableStatus("loading");
		setSelectedLegacyDid("");
		const res = await user.xrpc.call(colibri.community.listMigratable.main, {
			params: { includeUnadministered: showAll },
		});
		if (!res.ok) {
			log.error("list migratable communities failed", {
				code: res.error.code,
			});
			showError(res.error);
			setMigratableStatus("error");
			return;
		}
		setLegacyCandidates(res.data.communities);
		setUnreadableLegacyDids(res.data.unreadable ?? []);
		setIncludeUnadministered(showAll);
		setMigratableStatus("loaded");
	};

	const MigrateCandidates: Component = () => {
		onMount(() => {
			void loadMigratableCommunities(includeUnadministered());
		});

		return (
			<Switch>
				<Match when={migratableStatus() === "loading"}>
					<div class="flex flex-col items-center justify-center gap-2 w-full py-6">
						<Spinner className="w-6 h-6 animate-spin text-muted-foreground" />
						<span class="text-sm text-muted-foreground">
							Looking for communities you can migrate.
						</span>
					</div>
				</Match>
				<Match when={migratableStatus() === "error"}>
					<div class="flex flex-col items-center justify-center gap-2 w-full py-6 text-center">
						<span class="text-sm text-muted-foreground">
							Colibri couldn't load your communities.
						</span>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() =>
								void loadMigratableCommunities(includeUnadministered())
							}
						>
							Retry
						</Button>
					</div>
				</Match>
				<Match when={migratableStatus() === "loaded"}>
					<Show
						when={legacyCandidates().length > 0}
						fallback={
							<p class="text-sm text-muted-foreground m-0">
								You don't have anything to migrate. Only a community that holds
								its own DID can migrate. One that lives inside its owner's
								repository can't be moved this way.
							</p>
						}
					>
						<RadioGroup
							class="w-full gap-1.5"
							value={selectedLegacyDid()}
							onChange={setSelectedLegacyDid}
						>
							<RadioGroupItems class="w-full flex-col">
								<For each={legacyCandidates()}>
									{(candidate) => (
										<RadioGroupItem
											class="w-full"
											value={candidate.did}
											disabled={!candidate.viewerIsAdmin}
										>
											<RadioGroupItemInput />
											<RadioGroupItemLabel class="flex w-full items-center justify-between text-pretty rounded-md p-2 border border-border outline-2 outline-transparent gap-2 data-checked:border-primary data-checked:outline-primary/50 data-checked:bg-primary/10 data-disabled:cursor-not-allowed data-disabled:opacity-50">
												<span class="flex flex-col text-left">
													<strong>{candidate.name}</strong>
													<span class="font-normal text-sm text-muted-foreground">
														{candidate.handle ?? candidate.did}
													</span>
													<Show when={!candidate.viewerIsAdmin}>
														<span class="font-normal text-sm text-muted-foreground">
															You don't administer this community.
														</span>
													</Show>
												</span>
												<span class="font-normal text-sm text-muted-foreground whitespace-nowrap">
													{candidate.memberCount} members,{" "}
													{candidate.channelCount} channels
												</span>
											</RadioGroupItemLabel>
										</RadioGroupItem>
									)}
								</For>
							</RadioGroupItems>
						</RadioGroup>
					</Show>
					<Show when={unreadableLegacyDids().length > 0}>
						<div class="flex flex-col gap-1 w-full rounded-md border border-border p-3">
							<p class="text-sm font-medium m-0">Unavailable</p>
							<For each={unreadableLegacyDids()}>
								{(did) => (
									<p class="text-sm text-muted-foreground m-0 break-all">
										{did}: its repository didn't respond, so Colibri can't tell
										if it's migratable.
									</p>
								)}
							</For>
						</div>
					</Show>
					<Button
						type="button"
						variant="link"
						size="sm"
						class="self-start h-auto p-0"
						onClick={() =>
							void loadMigratableCommunities(!includeUnadministered())
						}
					>
						{includeUnadministered()
							? "Show only communities you can migrate"
							: "Show communities you don't administer"}
					</Button>
				</Match>
			</Switch>
		);
	};

	const CommunityDetails: Component = () => (
		<>
			<div class="flex flex-col items-center justify-center w-full gap-4">
				<RadioGroup
					class="w-full gap-1.5"
					value={mode()}
					onChange={(v) => setMode(v as CreationMode)}
				>
					<RadioGroupItems class="w-full flex-col md:flex-row">
						<For each={MODE_CHOICES}>
							{(choice) => (
								<RadioGroupItem class="w-full md:flex-1" value={choice.value}>
									<RadioGroupItemInput />
									<RadioGroupItemLabel class="flex w-full flex-col text-center text-pretty rounded-md p-2 border border-border outline-2 outline-transparent gap-1 data-checked:border-primary data-checked:outline-primary/50 data-checked:bg-primary/10">
										<strong>{choice.label}</strong>
										<span class="font-normal text-sm text-muted-foreground">
											{choice.description}
										</span>
									</RadioGroupItemLabel>
								</RadioGroupItem>
							)}
						</For>
					</RadioGroupItems>
				</RadioGroup>

				<Show when={mode() === "migrate"}>
					<p class="text-sm text-muted-foreground m-0">
						We'll rebuild this community's categories, channels and roles as
						spaces. Message history stays where it is.
					</p>
					<MigrateCandidates />
				</Show>

				<Show when={mode() !== "migrate"}>
					<div class="flex gap-6 w-full">
						<FileField
							class="-size-full"
							accept={IMAGE_UPLOAD_ACCEPT}
							onFileChange={takeImagePick(setPicture)}
							maxFiles={1}
						>
							<FileFieldDropzone class="w-30 h-30 min-h-0 rounded-md overflow-hidden relative">
								<FileFieldTrigger class="h-full w-full bg-muted/25 text-muted-foreground hover:bg-muted/50 p-0">
									<Switch>
										<Match when={picture() === undefined}>
											<div class="flex flex-col items-center justify-center gap-1">
												<Image className="w-6! h-6!" />
												<span>Upload picture</span>
											</div>
										</Match>
										<Match when={picture() !== undefined}>
											<FileFieldItemList class="w-full h-full m-0 p-0 relative">
												{() => (
													<FileFieldItem class="w-full h-full m-0 p-0 border-none [&>div]:w-full -grid">
														<FileFieldItemPreviewImage class="w-full h-full object-cover" />
													</FileFieldItem>
												)}
											</FileFieldItemList>
											<button
												type="button"
												class="absolute top-1 right-1 text-white drop-shadow drop-shadow-black cursor-pointer"
												onClick={(e) => {
													e.preventDefault();
													e.stopPropagation();
													setPicture(undefined);
												}}
												aria-label="Remove picture"
											>
												<XCircleIcon />
											</button>
										</Match>
									</Switch>
								</FileFieldTrigger>
							</FileFieldDropzone>
							<FileFieldHiddenInput />
						</FileField>
						<FileField
							accept={IMAGE_UPLOAD_ACCEPT}
							onFileChange={takeImagePick(setBanner)}
							maxFiles={1}
						>
							<FileFieldDropzone class="w-full h-30 min-h-0 rounded-md overflow-hidden relative">
								<FileFieldTrigger class="h-full w-full bg-muted/25 text-muted-foreground hover:bg-muted/50 p-0">
									<Switch>
										<Match when={banner() === undefined}>
											<div class="flex flex-col items-center justify-center gap-1">
												<Image className="w-6! h-6!" />
												<span>Upload banner</span>
											</div>
										</Match>
										<Match when={banner() !== undefined}>
											<FileFieldItemList class="w-full h-full m-0 p-0 relative">
												{() => (
													<FileFieldItem class="w-full h-full m-0 p-0 border-none [&>div]:h-full -grid">
														<FileFieldItemPreviewImage class="w-full h-full object-cover" />
													</FileFieldItem>
												)}
											</FileFieldItemList>
											<button
												type="button"
												class="absolute top-1 right-1 text-white drop-shadow drop-shadow-black cursor-pointer"
												onClick={(e) => {
													e.preventDefault();
													e.stopPropagation();
													setBanner(undefined);
												}}
												aria-label="Remove banner"
											>
												<XCircleIcon />
											</button>
										</Match>
									</Switch>
								</FileFieldTrigger>
							</FileFieldDropzone>
							<FileFieldHiddenInput />
						</FileField>
					</div>
					<TextField
						value={name()}
						onChange={setName}
						validationState={nameValid()}
					>
						<TextFieldLabel>
							Community Name <span class="text-destructive">*</span>
						</TextFieldLabel>
						<TextFieldInput maxLength={32} minLength={1} type="text" required />
						<TextFieldDescription>
							Must be between one and 32 characters long.
						</TextFieldDescription>
					</TextField>
					<TextField
						value={description()}
						onChange={setDescription}
						validationState={descriptionValid()}
					>
						<TextFieldLabel>Community Description</TextFieldLabel>
						<TextFieldInput maxLength={256} type="text" />
						<TextFieldDescription>
							Tell others what your community is about! Max. 256 characters.
						</TextFieldDescription>
					</TextField>
				</Show>

				<Show when={mode() === "adopt"}>
					<div class="flex flex-col gap-4 w-full rounded-md border border-border p-3">
						<p class="text-sm text-muted-foreground m-0">
							Bring an existing AT Protocol account onto Colibri.{" "}
							<b class="text-foreground">
								Do not use your personal account for this!
							</b>
						</p>
						<TextField value={identifier()} onChange={setIdentifier}>
							<TextFieldLabel>
								Account handle or DID <span class="text-destructive">*</span>
							</TextFieldLabel>
							<TextFieldInput
								minLength={1}
								type="text"
								required
								placeholder="community.example.com"
							/>
						</TextField>
						<TextField value={password()} onChange={setPassword}>
							<TextFieldLabel>
								Account password <span class="text-destructive">*</span>
							</TextFieldLabel>
							<TextFieldInput minLength={1} type="password" required />
							<TextFieldDescription>
								Its full account password, not an app password: Colibri needs
								full access to take over this account's credentials.
							</TextFieldDescription>
						</TextField>
					</div>
				</Show>

				<Show when={mode() !== "migrate"}>
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
								Whether you want to explicitly need to allow users to chat in
								this community.
							</SwitchDescription>
						</div>
						<SwitchInput />
						<SwitchControl>
							<SwitchThumb />
						</SwitchControl>
					</SwitchComp>
				</Show>
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
					disabled={!canCreate()}
					onClick={() => setStep(creationInFlight() ? BUSY : LOADING)}
				>
					{mode() === "migrate"
						? "Migrate"
						: mode() === "adopt"
							? "Adopt"
							: "Create"}
				</Button>
			</DialogFooter>
		</>
	);

	const enterCommunity = (did: string) => {
		resetState();
		setOpen(false);
		window.location.href = `/app/c/${did}`;
	};

	const UnfinishedScreen: Component = () => {
		const pending = readPending(ns());
		const [checking, setChecking] = createSignal(false);

		const check = async () => {
			setChecking(true);
			const outcome = await resumeQuietly(user.xrpc, ns());
			setChecking(false);

			if (outcome.kind === "done") {
				if (outcome.imagesDropped) toast(IMAGES_UNSAVED_MESSAGE);
				await user.refetchCommunities();
				enterCommunity(outcome.community.did);
				return;
			}

			if (outcome.kind === "abandoned") {
				toast(`${outcome.name} was never finished. You can create it again.`);
				setStep(COMMUNITY_DETAILS);
				return;
			}

			if (outcome.kind === "none") {
				setStep(COMMUNITY_DETAILS);
				return;
			}

			toast("Colibri still can't tell whether it finished. Try again shortly.");
		};

		const discard = () => {
			clearPending(ns());
			setStep(COMMUNITY_DETAILS);
		};

		return (
			<>
				<div class="flex flex-col gap-2">
					<p class="m-0 text-sm text-muted-foreground">
						Colibri lost contact with the server while creating{" "}
						<span class="font-medium text-foreground">
							{pending?.name ?? "your community"}
						</span>
						. It may already exist, so Colibri won't create a second one until
						it knows.
					</p>
				</div>
				<DialogFooter>
					<Button variant="secondary" disabled={checking()} onClick={discard}>
						Start over
					</Button>
					<Button disabled={checking()} onClick={() => void check()}>
						{checking() ? "Checking…" : "Check again"}
					</Button>
				</DialogFooter>
			</>
		);
	};

	const BusyScreen: Component = () => (
		<div class="flex flex-col items-center justify-center gap-3 py-6">
			<span class="text-sm text-muted-foreground text-center text-pretty">
				A community is already being created. Wait for that one to finish before
				starting another.
			</span>
			<Button variant="secondary" onClick={() => setOpen(false)}>
				Close
			</Button>
		</div>
	);

	const LoadingScreen: Component = () => {
		const socket = useSocketContext();
		const [status, setStatus] = createSignal("Working");
		let progressFailure: string | undefined;

		const waitForCommunityIndexed = async (did: string) => {
			for (let attempt = 0; attempt < INDEX_ATTEMPTS; attempt++) {
				const res = await user.xrpc.call(
					colibri.community.getCommunity.main,
					{ params: { community: did } },
					{ expected: ["CommunityNotFound", "NotFound"] },
				);
				if (res.ok && res.data.community.viewer.isMember) return;
				await new Promise((resolve) => setTimeout(resolve, INDEX_POLL_MS));
			}
			log.warn("the new community had not indexed in time", { community: did });
		};

		const runCreate = async (): Promise<CommunityView> => {
			const created = await user.xrpc.call(
				colibri.community.create.main,
				{
					body: {
						name: name().trim(),
						description: description().trim() || undefined,
						requiresApprovalToJoin: requiresApprovalToJoin(),
					},
				},
				{ signal: AbortSignal.timeout(CREATE_TIMEOUT_MS) },
			);
			if (!created.ok) throw created.error;
			return created.data.community;
		};

		const runAdopt = async (): Promise<CommunityView> => {
			const trimmedIdentifier = identifier().trim();
			const did = await resolveHandleToDid(trimmedIdentifier);
			const adopted = await user.xrpc.call(
				colibri.community.adopt.main,
				{
					body: {
						did,
						identifier: trimmedIdentifier,
						password: password(),
						name: name().trim(),
						description: description().trim() || undefined,
						requiresApprovalToJoin: requiresApprovalToJoin(),
					},
				},
				{ signal: AbortSignal.timeout(CREATE_TIMEOUT_MS) },
			);
			if (!adopted.ok) throw adopted.error;
			return adopted.data.community;
		};

		const runMigrate = async (): Promise<CommunityView> => {
			const migrated = await user.xrpc.call(colibri.community.migrate.main, {
				body: { community: selectedLegacyDid() },
			});
			if (!migrated.ok) throw migrated.error;
			return migrated.data.community;
		};

		const applySettings = async (
			community: CommunityView,
		): Promise<CommunityView> => {
			if (mode() === "migrate") return community;
			if (community.requiresApprovalToJoin === requiresApprovalToJoin())
				return community;

			const updated = await user.xrpc.call(colibri.community.update.main, {
				body: {
					community: community.did,
					requiresApprovalToJoin: requiresApprovalToJoin(),
				},
			});
			if (updated.ok) return updated.data.community;

			log.warn("could not apply the join setting", {
				code: updated.error.code,
			});
			toast(
				"Join approval wasn't applied. You can change it in community settings.",
			);
			return community;
		};

		const provision = async (): Promise<{
			community: CommunityView;
			recovered: boolean;
		}> => {
			if (mode() === "migrate") {
				return { community: await runMigrate(), recovered: false };
			}

			writePending(ns(), {
				name: name().trim(),
				requiresApprovalToJoin: requiresApprovalToJoin(),
				startedAt: Date.now(),
				imagesDropped:
					picture()?.acceptedFiles[0] !== undefined ||
					banner()?.acceptedFiles[0] !== undefined,
			});

			try {
				const community =
					mode() === "adopt" ? await runAdopt() : await runCreate();
				return { community, recovered: false };
			} catch (err) {
				const resumed = await resumeQuietly(user.xrpc, ns());
				if (resumed.kind === "done") {
					log.warn("recovered a community whose response was lost", {
						code: classifyThrown(err).code,
					});
					if (resumed.imagesDropped) toast(IMAGES_UNSAVED_MESSAGE);
					return { community: resumed.community, recovered: true };
				}
				if (resumed.kind === "wait") setStep(UNFINISHED);
				throw err;
			}
		};

		const finishFreshCommunity = async (
			community: CommunityView,
		): Promise<CommunityView> => {
			const settled = await applySettings(community);
			const images = await applyPendingImages(
				user.xrpc,
				settled,
				picture()?.acceptedFiles[0],
				banner()?.acceptedFiles[0],
			);
			if (images.unsaved) toast(IMAGES_UNSAVED_MESSAGE);
			return images.community;
		};

		onMount(async () => {
			if (creationInFlight()) {
				setStep(BUSY);
				return;
			}

			const unsubscribe = socket.onEvent((event) => {
				if (!frameIs(event, "communityProgressEvent")) return;
				if (event.community) advancePending(ns(), event.community);
				if (event.step === "failed" && event.message) {
					progressFailure = event.message;
				}
				setStatus(
					event.step === "failed"
						? (event.message ?? progressStepLabel(event.step))
						: progressStepLabel(event.step),
				);
			});

			try {
				setCreationInFlight(true);

				const provisioned = await provision();
				const community = provisioned.recovered
					? provisioned.community
					: await finishFreshCommunity(provisioned.community);

				setStatus("Finishing up...");
				await waitForCommunityIndexed(community.did);
				clearPending(ns());
				await user.refetchCommunities();
				enterCommunity(community.did);
			} catch (err) {
				log.error(`${mode()} community failed`, {
					code: classifyThrown(err).code,
				});
				showError(err, { description: progressFailure });
				if (step() === LOADING) setStep(COMMUNITY_DETAILS);
			} finally {
				unsubscribe();
				setCreationInFlight(false);
			}
		});

		return (
			<div class="flex flex-col items-center justify-center gap-3 py-6">
				<Spinner className="w-8 h-8 animate-spin text-muted-foreground" />
				<span class="text-sm text-muted-foreground">{status()}</span>
			</div>
		);
	};

	return (
		<ResponsiveDialog
			open={open()}
			onOpenChange={enterModal}
			trigger={props.children}
			title={
				<span class="text-center w-full">
					{step() === UNFINISHED
						? "Unfinished community"
						: mode() === "migrate"
							? "Migrate a community"
							: mode() === "adopt"
								? "Adopt a community"
								: "Create a community"}
				</span>
			}
			contentClass="w-lg"
		>
			<Switch>
				<Match when={step() === COMMUNITY_DETAILS}>
					<CommunityDetails />
				</Match>
				<Match when={step() === LOADING}>
					<LoadingScreen />
				</Match>
				<Match when={step() === UNFINISHED}>
					<UnfinishedScreen />
				</Match>
				<Match when={step() === BUSY}>
					<BusyScreen />
				</Match>
			</Switch>
		</ResponsiveDialog>
	);
};
