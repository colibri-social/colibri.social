import type { AT_URI } from "@colibri-social/lib";
import type { Details } from "@kobalte/core/file-field";
import { useNavigate } from "@solidjs/router";
import {
	type Component,
	createEffect,
	createSignal,
	For,
	Match,
	type ParentComponent,
	Switch,
} from "solid-js";
import { toast } from "somoto";
import { communityUriToUrlCompatible } from "../../atproto/community-uri-to-url-compatible";
import { useUserContext } from "../../contexts/User";
import { Image } from "../icons/Image";
import { Spinner } from "../icons/Spinner";
import { Button } from "../ui/Button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogPortal,
	DialogTrigger,
} from "../ui/Dialog";
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

const [pdsLoc, setPdsLoc] = createSignal<string>("");
const [handleOrDid, setHandleOrDid] = createSignal<string>("");
const [password, setPassword] = createSignal<string>("");
const [name, setName] = createSignal<string>("");
const [description, setDescription] = createSignal<string>("");
const [picture, setPicture] = createSignal<Details>();
const [loading, _setLoading] = createSignal<boolean>(false);
const [open, setOpen] = createSignal(false);
const [ownership, setOwnership] = createSignal<string>("managed");
const [step, setStep] = createSignal<number>(OWNERSHIP_CHOICE);

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

const credentialsInvalid = () =>
	!(
		isValidPdsHost(pdsLoc()) &&
		isValidHandleOrDid(handleOrDid()) &&
		isValidPassword(password())
	);

const CommunityOwnership: Component = () => {
	const options = [
		{
			title: "Colibri-managed",
			description:
				"We create the community on our EU-based server host it for you.",
			value: "managed",
			disabled: false,
		},
		{
			title: "Bring your own",
			description:
				"You create the community on your own PDS and allow us to manage it.",
			value: "byo",
			disabled: false,
		},
	];

	return (
		<>
			<div class="flex flex-row items-center justify-center w-full gap-4">
				<RadioGroup defaultValue={ownership()} onChange={setOwnership}>
					<RadioGroupItems>
						<For each={options}>
							{(option) => (
								<RadioGroupItem value={option.value} disabled={option.disabled}>
									<RadioGroupItemInput disabled={option.disabled} />
									<RadioGroupItemLabel
										class="flex flex-col text-center text-pretty rounded-md p-2 border border-border outline-2 outline-transparent gap-2 data-checked:border-primary data-checked:outline-primary/50 data-checked:bg-primary/10"
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
	return (
		<>
			<div class="flex flex-col items-center justify-center w-full gap-4">
				<FileField onFileChange={setPicture} maxFiles={1}>
					<FileFieldDropzone class="w-20 h-20 min-h-0 rounded-full overflow-hidden">
						<FileFieldTrigger class="h-20 w-20 bg-muted/25 text-muted-foreground hover:bg-muted/50">
							<Switch>
								<Match when={picture() === undefined}>
									<div class="flex flex-col items-center justify-center gap-1">
										<Image className="w-6! h-6!" />
										<span>Upload</span>
									</div>
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
					validationState={
						name() !== undefined &&
						name()!.trim().length < 33 &&
						name()!.trim().length > 0
							? "valid"
							: "invalid"
					}
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
					validationState={
						description() !== undefined && description()!.trim().length < 257
							? "valid"
							: "invalid"
					}
				>
					<TextFieldLabel>Community Description</TextFieldLabel>
					<TextFieldInput maxLength={256} minLength={1} type="text" required />
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
				<Button onClick={() => setStep(4)}>Create</Button>
			</DialogFooter>
		</>
	);
};

const resetState = () => {
	setPdsLoc("");
	setHandleOrDid("");
	setPassword("");
	setName("");
	setDescription("");
	setPicture(undefined);
	setOwnership("managed");
	setStep(OWNERSHIP_CHOICE);
};

const LoadingScreen: Component = () => {
	const user = useUserContext();
	const navigate = useNavigate();

	createEffect(async () => {
		let pictureBlob: Blob | undefined;
		let mimeType: string | undefined;

		if (picture()) {
			pictureBlob = picture()!.acceptedFiles[0];
			mimeType = pictureBlob.type;
		}

		try {
			const res = await user.xrpc.social.colibri.community.create(
				name(),
				description() || undefined,
				false,
				pictureBlob,
				mimeType,
			);

			if (!res) throw new Error("No response from server.");

			await user.refetchCommunities();
			const url = communityUriToUrlCompatible(
				res.community as AT_URI<"social.colibri.community">,
			);
			resetState();
			setOpen(false);
			navigate(`/app/c/${url}`);
		} catch (err) {
			console.error("[CommunityCreation]", err);
			toast.error("Failed to create community.");
			setStep(COMMUNITY_DETAILS);
		}
	});

	return (
		<div class="flex flex-col items-center justify-center gap-3 py-6">
			<span class="text-sm text-muted-foreground">Creating community…</span>
		</div>
	);
};

export const CommunityCreationModal: ParentComponent = (props) => {
	return (
		<Dialog open={open()} onOpenChange={setOpen}>
			<DialogTrigger>{props.children}</DialogTrigger>
			<DialogPortal>
				<DialogContent class="w-lg">
					<DialogHeader>
						<h2 class="m-0 text-center">Create a community</h2>
					</DialogHeader>
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
				</DialogContent>
			</DialogPortal>
		</Dialog>
	);
};
