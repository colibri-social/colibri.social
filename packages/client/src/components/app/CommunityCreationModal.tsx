import type { Details } from "@kobalte/core/file-field";
import {
	Component,
	createSignal,
	Match,
	type ParentComponent,
	Switch,
	For,
	createEffect,
} from "solid-js";
import { toast } from "somoto";
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
	TextField,
	TextFieldDescription,
	TextFieldInput,
	TextFieldLabel,
} from "../ui/TextField";
import {
	RadioGroup,
	RadioGroupItem,
	RadioGroupItemInput,
	RadioGroupItemLabel,
	RadioGroupItems,
	RadioGroupLabel,
} from "../ui/RadioGroup";
import { useUserContext } from "../../contexts/User";

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
const [loading, setLoading] = createSignal<boolean>(false);
const [open, setOpen] = createSignal(false);
const [ownership, setOwnership] = createSignal<string>("managed");
const [step, setStep] = createSignal<number>(OWNERSHIP_CHOICE);

// TODO: These can be better checks
const allCredentialsValid = () =>
	pdsLoc().length > 0 && handleOrDid().length > 0 && password().length > 0
		? false
		: true;

const CommunityOwnership: Component = () => {
	const options = [
		{
			title: "Colibri-managed",
			description:
				"We create the community on our EU-based server host it for you.",
			value: "managed",
		},
		{
			title: "Bring your own",
			description:
				"You create the community on your own PDS and allow us to manage it.",
			value: "byo",
		},
	];

	return (
		<>
			<div class="flex flex-row items-center justify-center w-full gap-4">
				<RadioGroup defaultValue={ownership()} onChange={setOwnership}>
					<RadioGroupItems>
						<For each={options}>
							{(option) => (
								<RadioGroupItem value={option.value}>
									<RadioGroupItemInput />
									<RadioGroupItemLabel class="flex flex-col text-center text-pretty rounded-md p-2 border border-border outline-2 outline-transparent gap-2 data-checked:border-primary data-checked:outline-primary/50 data-checked:bg-primary/10">
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
						PDS HOST <span class="text-destructive">*</span>
					</TextFieldLabel>
					<TextFieldInput
						minLength={1}
						type="text"
						required
						placeholder="colibri.social"
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
					disabled={allCredentialsValid()}
					aria-disabled={allCredentialsValid()}
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

const LoadingScreen: Component = () => {
	const user = useUserContext();

	const createCommunity = async () => {
		setLoading(true);

		// TODO: Create community
		console.log(name(), picture(), ownership());

		// TODO: Optimistically add community, navigate

		setLoading(false);
		setOpen(false);
		// props.navigate(`/c/${data.community}`);
	};

	createEffect(async () => {
		let base64Picture: string | undefined;
		let mimeType: string | undefined;

		if (picture()) {
			base64Picture = await new Promise<string>((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => resolve(reader.result as string);
				reader.onerror = reject;
				reader.readAsDataURL(picture()!.acceptedFiles[0]);
			});

			mimeType = picture()!.acceptedFiles[0].type;
		}

		// TODO: Handle BYO flow
		const res = await user.xrpc.social.colibri.community.create(
			name(),
			description(),
			false, // TODO: Checkbox / Toggle
			base64Picture,
			mimeType,
		);

		console.log(res);

		// Add community + navigate to it here or handle error
		const error = undefined;
		if (error) {
			setLoading(false);
			toast.error("Failed to create community", {
				// description: parseZodToErrorOrDisplay(error.message),
			});
			return;
		}
	});

	return (
		<div>
			<span>Creating community...</span>
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
