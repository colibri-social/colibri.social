import type { JsonBlobRef } from "@atproto/lexicon";
import type { AT_URI } from "@colibri-social/lib";
import type { Details } from "@kobalte/core/file-field";
import {
	type Component,
	createSignal,
	Match,
	onMount,
	type ParentComponent,
	Show,
	Switch,
} from "solid-js";
import { toast } from "somoto";
import XCircleIcon from "~icons/ph/x-circle";
import { communityUriToUrlCompatible } from "../../atproto/community-uri-to-url-compatible";
import { getRecord, putRecord } from "../../atproto/pds";
import { resolveBlob } from "../../atproto/resolve-blob";
import { useSocketContext } from "../../contexts/Socket";
import { useUserContext } from "../../contexts/User";
import { Chevron } from "../icons/Chevron";
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
} from "../ui/FileField";
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

const COMMUNITY_DETAILS = 1;
const LOADING = 2;

// Labels for the self-hosting bootstrap steps the AppView pushes over the event
// socket while creating the community on the user's own server.
const BYO_PROGRESS_LABELS: Record<string, string> = {
	connecting: "Connecting to your server...",
	creating: "Creating your community...",
	registering: "Linking to Colibri...",
};

// A PDS host is accepted either as a bare domain ("colibri.social") or a full
// URL; it must resolve to a dotted hostname (or localhost) with no path.
const isValidPdsHost = (value: string): boolean => {
	const trimmed = value.trim();
	if (trimmed.length === 0) return false;

	try {
		const url = new URL(
			trimmed.includes("://") ? trimmed : `https://${trimmed}`,
		);
		return (
			url.hostname === "localhost" ||
			/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(url.hostname)
		);
	} catch {
		return false;
	}
};

// Either a DID ("did:method:identifier") or a handle (a dotted domain).
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

// App passwords are 19 chars ("xxxx-xxxx-xxxx-xxxx"); account passwords vary,
// so just require a non-trivial length.
const isValidPassword = (value: string): boolean => value.trim().length >= 8;

let creationInFlight = false;

/**
 * A legacy community to migrate. When supplied, the modal runs in "migration
 * mode": the details are pre-filled and submitting calls `community.migrate`
 * (cloning the legacy community onto a fresh DID) instead of `community.create`.
 */
export type MigrateTarget = {
	uri: AT_URI<"social.colibri.community">;
	name: string;
	description: string;
	picture?: JsonBlobRef;
};

export const CommunityCreationModal: ParentComponent<{
	migrateFrom?: MigrateTarget;
}> = (props) => {
	const isMigration = () => props.migrateFrom !== undefined;

	// URL of the legacy community's existing picture, shown as the default
	// preview in migration mode until the owner picks a replacement.
	const legacyPictureUrl = () =>
		props.migrateFrom
			? resolveBlob(
					props.migrateFrom.uri.split("/")[2],
					props.migrateFrom.picture,
				)
			: undefined;

	const [pdsLoc, setPdsLoc] = createSignal<string>("");
	const [handleOrDid, setHandleOrDid] = createSignal<string>("");
	const [password, setPassword] = createSignal<string>("");
	const [name, setName] = createSignal<string>(props.migrateFrom?.name ?? "");
	const [description, setDescription] = createSignal<string>(
		props.migrateFrom?.description ?? "",
	);
	const [picture, setPicture] = createSignal<Details>();
	const [banner, setBanner] = createSignal<Details>();
	const [loading, _setLoading] = createSignal<boolean>(false);
	const [open, setOpen] = createSignal(false);
	const [selfHost, setSelfHost] = createSignal<boolean>(false);
	const [requiresApprovalToJoin, setRequiresApprovalToJoin] =
		createSignal<boolean>(false);
	const [step, setStep] = createSignal<number>(COMMUNITY_DETAILS);

	const credentialsInvalid = () =>
		!(
			isValidPdsHost(pdsLoc()) &&
			isValidHandleOrDid(handleOrDid()) &&
			isValidPassword(password())
		);

	const resetState = () => {
		setPdsLoc("");
		setHandleOrDid("");
		setPassword("");
		setName(props.migrateFrom?.name ?? "");
		setDescription(props.migrateFrom?.description ?? "");
		setPicture(undefined);
		setBanner(undefined);
		setSelfHost(false);
		setRequiresApprovalToJoin(false);
		setStep(COMMUNITY_DETAILS);
	};

	const CommunityDetails: Component = () => {
		const nameValid = () => {
			return name() !== undefined &&
				name()!.trim().length < 33 &&
				name()!.trim().length > 0
				? "valid"
				: "invalid";
		};

		const descriptionValid = () => {
			return description() !== undefined && description()!.trim().length < 257
				? "valid"
				: "invalid";
		};

		const canCreate = () =>
			nameValid() === "valid" &&
			descriptionValid() === "valid" &&
			(!selfHost() || !credentialsInvalid());

		return (
			<>
				<div class="flex flex-col items-center justify-center w-full gap-4">
					<div class="flex gap-6 w-full">
						<FileField
							class="-size-full"
							onFileChange={setPicture}
							maxFiles={1}
						>
							<FileFieldDropzone class="w-30 h-30 min-h-0 rounded-md overflow-hidden relative">
								<FileFieldTrigger class="h-full w-full bg-muted/25 text-muted-foreground hover:bg-muted/50 p-0">
									<Switch>
										<Match when={picture() === undefined}>
											<Show
												when={legacyPictureUrl()}
												fallback={
													<div class="flex flex-col items-center justify-center gap-1">
														<Image className="w-6! h-6!" />
														<span>Upload picture</span>
													</div>
												}
											>
												{(url) => (
													<img
														src={url()}
														alt=""
														class="w-20 h-20 object-cover"
													/>
												)}
											</Show>
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
						<FileField onFileChange={setBanner} maxFiles={1}>
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
						<TextFieldInput
							maxLength={256}
							minLength={1}
							type="text"
							required
						/>
						<TextFieldDescription>
							Tell others what your community is about! Max. 256 characters.
						</TextFieldDescription>
					</TextField>
					<div class="w-full rounded-md border border-border">
						<button
							type="button"
							onClick={() => setSelfHost((v) => !v)}
							aria-expanded={selfHost()}
							class="flex w-full items-center justify-between gap-2 p-3 text-left text-sm text-muted-foreground hover:text-foreground"
						>
							<span class="flex flex-col">
								<span class="font-medium text-foreground">
									Advanced: host it yourself
								</span>
								<span>
									By default, Colibri hosts your community on our EU servers.
								</span>
							</span>
							<span
								class="shrink-0 transition-transform duration-200"
								classList={{ "rotate-90": selfHost() }}
							>
								<Chevron className="w-4! h-4!" />
							</span>
						</button>
						<Show when={selfHost()}>
							<div class="flex flex-col gap-4 border-t border-border p-3">
								<p class="text-sm text-muted-foreground m-0">
									If you run your own AT Protocol server (PDS), you can create
									the community there and let Colibri manage it for you.{" "}
									<b class="text-foreground">
										Do not use your personal account for this!
									</b>
								</p>
								<TextField value={pdsLoc()} onChange={setPdsLoc}>
									<TextFieldLabel>
										Server address <span class="text-destructive">*</span>
									</TextFieldLabel>
									<TextFieldInput
										minLength={1}
										type="text"
										required
										placeholder="https://colibri.social"
									/>
									<TextFieldDescription>
										The address of your AT Protocol server (your PDS host).
									</TextFieldDescription>
								</TextField>
								<TextField value={handleOrDid()} onChange={setHandleOrDid}>
									<TextFieldLabel>
										Account username <span class="text-destructive">*</span>
									</TextFieldLabel>
									<TextFieldInput
										minLength={1}
										type="text"
										required
										placeholder="community.example.com"
									/>
									<TextFieldDescription>
										The handle (or DID) you sign in with on that server.
									</TextFieldDescription>
								</TextField>
								<TextField value={password()} onChange={setPassword}>
									<TextFieldLabel>
										App password <span class="text-destructive">*</span>
									</TextFieldLabel>
									<TextFieldInput minLength={1} type="password" required />
									<TextFieldDescription>
										Create an app password in the account settings. Don't use
										the main password.
									</TextFieldDescription>
								</TextField>
							</div>
						</Show>
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
								Whether you want to explicitly need to allow users to chat in
								this community.
							</SwitchDescription>
						</div>
						<SwitchInput />
						<SwitchControl>
							<SwitchThumb />
						</SwitchControl>
					</SwitchComp>
				</div>
				<DialogFooter>
					<Button
						variant="secondary"
						disabled={loading()}
						onClick={() => setOpen(false)}
					>
						Cancel
					</Button>
					<Button disabled={!canCreate()} onClick={() => setStep(LOADING)}>
						Create
					</Button>
				</DialogFooter>
			</>
		);
	};

	const LoadingScreen: Component = () => {
		const user = useUserContext();
		const socket = useSocketContext();
		const [status, setStatus] = createSignal(
			isMigration() ? "Migrating community..." : "Creating community...",
		);

		const waitForCommunityIndexed = async (uri: string) => {
			for (let attempt = 0; attempt < 10; attempt++) {
				const res = await user.xrpc.social.colibri.actor.listCommunities();
				if (res?.communities?.some((c) => c.uri === uri)) return;
				await new Promise((resolve) => setTimeout(resolve, 1000));
			}
		};

		const stampLegacyAsMigrated = async (newCommunityUri: string) => {
			const legacyUri = props.migrateFrom!.uri;
			const [, , did, , rkey] = legacyUri.split("/");
			const current = await getRecord(
				user.atproto.agent,
				did,
				"social.colibri.community",
				rkey,
			);
			await putRecord(
				user.atproto.agent,
				did,
				"social.colibri.community",
				rkey,
				{
					...current,
					migratedTo: newCommunityUri,
				},
			);
		};

		onMount(async () => {
			if (creationInFlight) return;
			creationInFlight = true;

			const isByo = selfHost();
			const byo = isByo
				? { pds: pdsLoc(), identifier: handleOrDid(), password: password() }
				: undefined;

			const unsubscribe = socket.onEvent((event) => {
				if (event.type === "community_creation_progress" && event.data) {
					const label = BYO_PROGRESS_LABELS[event.data.step];
					if (label) setStatus(label);
				}
			});

			try {
				if (isByo) setStatus(BYO_PROGRESS_LABELS.connecting);
				let communityUri: string;

				if (isMigration()) {
					const pictureUrl = legacyPictureUrl();
					let picture: Blob | undefined;
					if (pictureUrl) {
						try {
							const res = await fetch(pictureUrl);
							picture = await res.blob();
						} catch (err) {
							console.error("[CommunityMigration] picture copy failed", err);
						}
					}
					const res = await user.xrpc.social.colibri.community.migrate(
						"legacy-community",
						props.migrateFrom!.uri,
						{ name: name(), description: description() || undefined },
						picture,
						byo,
					);
					if (!res) throw new Error("No response from server.");
					communityUri = res.community;

					// Stamp the legacy record so it disappears everywhere.
					setStatus("Finishing up...");
					try {
						await stampLegacyAsMigrated(communityUri);
					} catch (err) {
						console.error(
							"[CommunityMigration] failed to stamp legacy record",
							err,
						);
					}
				} else {
					const res = await user.xrpc.social.colibri.community.create(
						name(),
						description() || undefined,
						requiresApprovalToJoin(),
						picture()?.acceptedFiles[0],
						banner()?.acceptedFiles[0],
						byo,
					);
					if (!res) throw new Error("No response from server.");
					communityUri = res.community;
					setStatus("Finishing up...");
				}

				await waitForCommunityIndexed(communityUri);
				await user.refetchCommunities();
				const url = communityUriToUrlCompatible(
					communityUri as AT_URI<"social.colibri.community">,
				);
				resetState();
				setOpen(false);
				// We explicitly do a manual nav here to prevent some loading issues
				window.location.href = `/app/c/${url}`;
			} catch (err) {
				console.error("[CommunityCreation]", err);
				toast.error(
					isMigration()
						? "Failed to migrate community."
						: "Failed to create community.",
				);
				setStep(COMMUNITY_DETAILS);
			} finally {
				unsubscribe();
				creationInFlight = false;
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
			onOpenChange={setOpen}
			trigger={props.children}
			title={
				<span class="text-center w-full">
					{isMigration() ? "Migrate community" : "Create a community"}
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
			</Switch>
		</ResponsiveDialog>
	);
};
