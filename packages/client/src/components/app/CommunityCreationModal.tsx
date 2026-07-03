import type { AT_URI } from "@colibri-social/lib";
import type { JsonBlobRef } from "@atproto/lexicon";
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
import { communityUriToUrlCompatible } from "../../atproto/community-uri-to-url-compatible";
import { getRecord, putRecord } from "../../atproto/pds";
import { resolveBlob } from "../../atproto/resolve-blob";
import { useSocketContext } from "../../contexts/Socket";
import { useUserContext } from "../../contexts/User";
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
import {
	RadioGroup,
	RadioGroupItem,
	RadioGroupItemInput,
	RadioGroupItemLabel,
	RadioGroupItems,
} from "../ui/RadioGroup";
import { ResponsiveDialog } from "../ui/ResponsiveDialog";
import {
	TextField,
	TextFieldDescription,
	TextFieldInput,
	TextFieldLabel,
} from "../ui/TextField";

const OWNERSHIP_CHOICE = 1;
const BYO_CREDENTIALS = 2;
const COMMUNITY_DETAILS = 3;
const LOADING = 4;

// Labels for the BYO bootstrap steps the AppView pushes over the event socket
// while creating the community on the user's PDS.
const BYO_PROGRESS_LABELS: Record<string, string> = {
	connecting: "Connecting to your PDS...",
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
	const [loading, _setLoading] = createSignal<boolean>(false);
	const [open, setOpen] = createSignal(false);
	const [ownership, setOwnership] = createSignal<string>("managed");
	const [step, setStep] = createSignal<number>(OWNERSHIP_CHOICE);

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
		setOwnership("managed");
		setStep(OWNERSHIP_CHOICE);
	};

	const CommunityOwnership: Component = () => {
		const options = [
			{
				title: "Colibri-managed",
				description:
					"We create the community on our EU-based server and host & manage it for you.",
				value: "managed",
				disabled: false,
			},
			{
				title: "Bring your own",
				description:
					"You create a new community account on your own PDS and allow us to manage it.",
				value: "byo",
				disabled: false,
			},
		];

		return (
			<>
				<div class="flex flex-row items-center justify-center w-full gap-4">
					<RadioGroup defaultValue={ownership()} onChange={setOwnership}>
						<RadioGroupItems class="flex-col sm:flex-row">
							<For each={options}>
								{(option) => (
									<RadioGroupItem
										value={option.value}
										disabled={option.disabled}
										class="w-full"
									>
										<RadioGroupItemInput disabled={option.disabled} />
										<RadioGroupItemLabel
											class="flex flex-col text-center w-full text-pretty rounded-md p-2 border border-border outline-2 outline-transparent gap-2 data-checked:border-primary data-checked:outline-primary/50 data-checked:bg-primary/10"
											classList={{
												"opacity-50": option.disabled,
											}}
										>
											<strong class="w-full text-lg">{option.title}</strong>
											<span>{option.description}</span>
										</RadioGroupItemLabel>
									</RadioGroupItem>
								)}
							</For>
						</RadioGroupItems>
					</RadioGroup>
				</div>
				<DialogFooter>
					<Button
						variant="secondary"
						disabled={loading()}
						onClick={() => setOpen(false)}
					>
						Cancel
					</Button>
					<Switch>
						<Match when={ownership() === "byo"}>
							<Button onClick={() => setStep(2)}>Next</Button>
						</Match>
						<Match when={ownership() === "managed"}>
							<Button onClick={() => setStep(3)}>Next</Button>
						</Match>
					</Switch>
				</DialogFooter>
			</>
		);
	};

	const CredentialsInput: Component = () => {
		return (
			<>
				<div class="flex flex-col items-center justify-center w-full gap-4">
					<TextField value={pdsLoc()} onChange={setPdsLoc}>
						<TextFieldLabel>
							PDS Host <span class="text-destructive">*</span>
						</TextFieldLabel>
						<TextFieldInput
							minLength={1}
							type="text"
							required
							placeholder="https://colibri.social"
						/>
					</TextField>
					<TextField value={handleOrDid()} onChange={setHandleOrDid}>
						<TextFieldLabel>
							Account Handle (or DID) <span class="text-destructive">*</span>
						</TextFieldLabel>
						<TextFieldInput
							minLength={1}
							type="text"
							required
							placeholder="alice.colibri.social"
						/>
					</TextField>
					<TextField value={password()} onChange={setPassword}>
						<TextFieldLabel>
							Account Password <span class="text-destructive">*</span>
						</TextFieldLabel>
						<TextFieldInput minLength={1} type="password" required />
					</TextField>
				</div>
				<DialogFooter>
					<Button variant="secondary" onClick={() => setStep(1)}>
						Back
					</Button>
					<Button
						onClick={() => setStep(3)}
						disabled={credentialsInvalid()}
						aria-disabled={credentialsInvalid()}
					>
						Next
					</Button>
				</DialogFooter>
			</>
		);
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
			nameValid() === "valid" && descriptionValid() === "valid";

		return (
			<>
				<div class="flex flex-col items-center justify-center w-full gap-4">
					<FileField onFileChange={setPicture} maxFiles={1}>
						<FileFieldDropzone class="w-20 h-20 min-h-0 rounded-md overflow-hidden">
							<FileFieldTrigger class="h-20 w-20 bg-muted/25 text-muted-foreground hover:bg-muted/50 p-0">
								<Switch>
									<Match when={picture() === undefined}>
										<Show
											when={legacyPictureUrl()}
											fallback={
												<div class="flex flex-col items-center justify-center gap-1">
													<Image className="w-6! h-6!" />
													<span>Upload</span>
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
										<FileFieldItemList class="w-20 h-20 m-0 p-0 relative">
											{() => (
												<FileFieldItem class="w-20 h-20 m-0 p-0 border-none [&>div]:w-20">
													<FileFieldItemPreviewImage class="w-20 h-20 object-cover" />
												</FileFieldItem>
											)}
										</FileFieldItemList>
									</Match>
								</Switch>
							</FileFieldTrigger>
						</FileFieldDropzone>
						<FileFieldHiddenInput />
					</FileField>
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
				</div>
				<DialogFooter>
					<Switch>
						<Match when={ownership() === "managed"}>
							<Button variant="secondary" onClick={() => setStep(1)}>
								Back
							</Button>
						</Match>
						<Match when={ownership() === "byo"}>
							<Button variant="secondary" onClick={() => setStep(2)}>
								Back
							</Button>
						</Match>
					</Switch>
					<Button disabled={!canCreate()} onClick={() => setStep(4)}>
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

		// Resolves the picture bytes to send
		const resolvePictureBytes = async (): Promise<{
			blob?: Blob;
			mimeType?: string;
		}> => {
			if (picture()) {
				const blob = picture()!.acceptedFiles[0];
				return { blob, mimeType: blob.type };
			}
			const url = legacyPictureUrl();
			if (url) {
				try {
					const res = await fetch(url);
					const blob = await res.blob();
					return { blob, mimeType: blob.type };
				} catch (err) {
					console.error("[CommunityMigration] picture copy failed", err);
				}
			}
			return {};
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

			const isByo = ownership() === "byo";
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

				const { blob: pictureBlob, mimeType } = await resolvePictureBytes();

				let communityUri: string;

				if (isMigration()) {
					const res = await user.xrpc.social.colibri.community.migrate(
						"legacy-community",
						props.migrateFrom!.uri,
						{ name: name(), description: description() || undefined },
						pictureBlob,
						mimeType,
						byo,
					);
					if (!res) throw new Error("No response from server.");
					communityUri = res.community;

					// Stamp the legacy record so it disappears everywhere.
					setStatus("Finishing up...");
					await stampLegacyAsMigrated(communityUri);
				} else {
					const res = await user.xrpc.social.colibri.community.create(
						name(),
						description() || undefined,
						false,
						pictureBlob,
						mimeType,
						byo,
					);
					if (!res) throw new Error("No response from server.");
					communityUri = res.community;
					setStatus("Finishing up...");
				}

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
				<Match when={step() === OWNERSHIP_CHOICE}>
					<CommunityOwnership />
				</Match>
				<Match when={step() === BYO_CREDENTIALS}>
					<CredentialsInput />
				</Match>
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
