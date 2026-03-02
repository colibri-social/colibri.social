import { createSignal, Match, Switch, type Component } from "solid-js";
import {
	TextField,
	TextFieldInput,
	TextFieldLabel,
} from "../../shadcn-solid/text-field";
import { useGlobalContext } from "../../contexts/GlobalContext";
import { useNavigate, useParams } from "@solidjs/router";
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
import type { Details } from "@kobalte/core/file-field";
import { Image } from "../../icons/Image";
import { XCircle } from "../../icons/XCircle";
import { Button } from "../../shadcn-solid/Button";
import { Spinner } from "../../icons/Spinner";
import { actions } from "astro:actions";
import { SettingsModal, SettingsPage } from "../SettingsModal";
import type { ParentComponent } from "solid-js";
import { toast } from "somoto";
import { parseZodToErrorOrDisplay } from "@/utils/parse-zod-to-error-or-display";

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
										<XCircle className="w-5! h-5!" />
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
										<XCircle className="w-5! h-5!" />
									</button>
								</div>
							</Match>
							<Match when={true}>
								<div class="flex flex-col items-center justify-center gap-1">
									<Image className="w-6! h-6!" />
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

const InfoPage: Component = () => {
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
		<SettingsPage loading={loading} title="Debug Information">
			<p class="m-0">
				Below you'll find some useful information about this community which can
				help in debugging issues.
			</p>
			<div class="flex flex-col gap-2">
				<span>verify against lexicon</span>
				<span>rkey</span>
				<span>cid</span>
				<span>at-uri</span>
				<span>view on pdsls.dev</span>
			</div>
		</SettingsPage>
	);
};

export const CommunitySettingsModal: ParentComponent = (props) => {
	return (
		<SettingsModal
			pages={[
				{
					title: "Community Profile",
					id: "general",
					component: GeneralSettingsPage,
				},
			]}
			dangerPage={{
				title: "Danger Zone",
				id: "danger",
				component: DangerSettingsPage,
			}}
			debugPage={{
				title: "Debug Information",
				id: "info",
				component: InfoPage,
			}}
		>
			{props.children}
		</SettingsModal>
	);
};
