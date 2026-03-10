import { actions } from "astro:actions";
import type { Details } from "@kobalte/core/file-field";
import { useParams } from "@solidjs/router";
import type { ParentComponent } from "solid-js";
import { type Component, createSignal, Match, Switch } from "solid-js";
import { toast } from "somoto";
import { RECORD_IDs } from "@/utils/atproto/lexicons";
import { parseZodToErrorOrDisplay } from "@/utils/parse-zod-to-error-or-display";
import { useGlobalContext } from "../contexts/GlobalContext";
import { Image } from "../icons/Image";
import { XCircle } from "../icons/XCircle";
import {
	FileField,
	FileFieldDropzone,
	FileFieldHiddenInput,
	FileFieldItem,
	FileFieldItemList,
	FileFieldItemPreviewImage,
	FileFieldLabel,
	FileFieldTrigger,
} from "../shadcn-solid/file-field";
import {
	TextField,
	TextFieldInput,
	TextFieldLabel,
} from "../shadcn-solid/text-field";
import { InfoPageItem } from "./SettingsInfoPage";
import { SettingsModal, SettingsPage } from "./SettingsModal";
import { PDSls } from "../icons/PDSls";
import { Alert } from "../shadcn-solid/Alert";
import { Info } from "../icons/Info";

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
			title="Profile"
			onSave={editCommunityData}
			onReset={resetCommunityData}
		>
			<Alert variant="info">
				<Info />
				<p class="m-0 text-sm">
					Changing your settings here will update them across the ATmosphere (on
					Bluesky and other platforms).
				</p>
			</Alert>
			<div class="w-full flex flex-col rounded-lg border border-border bg-card p-4 text-foreground">
				{/* TODO: banner file field, name, bio, status text, bg gradient */}
				<FileField class="items-start" onFileChange={setImage} maxFiles={1}>
					<FileFieldDropzone class="h-24 w-24 min-h-0 rounded-full">
						<FileFieldTrigger class="h-24 w-24 p-0 bg-muted/25 hover:bg-muted/50 rounded-full overflow-hidden">
							<Switch>
								<Match when={image() !== undefined}>
									<div class="relative w-24 h-24">
										<FileFieldItemList class="w-24 h-24 m-0 p-0">
											{() => (
												<FileFieldItem class="w-24 h-24 m-0 p-0 border-none [&>div]:w-24">
													<FileFieldItemPreviewImage class="w-24 h-24 object-cover" />
												</FileFieldItem>
											)}
										</FileFieldItemList>
									</div>
								</Match>
								<Match when={existingImageUrl() !== null}>
									<div class="relative w-24 h-24">
										<img
											src={existingImageUrl()!}
											alt={community().name}
											class="w-24 h-24 object-cover"
										/>
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
					<TextFieldLabel>Display Name</TextFieldLabel>
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
			</div>
		</SettingsPage>
	);
};

const DebugPage: Component = () => {
	const [globalData] = useGlobalContext();

	const atUri = `at://${globalData.user.sub}`;
	return (
		<SettingsPage loading={() => false} title="Debug Information">
			<div class="flex flex-col gap-4">
				<InfoPageItem title="DID" value={globalData.user.sub} />
				<InfoPageItem title="AT-URI" value={atUri} />
				<a
					href={`https://pdsls.dev/${atUri}`}
					target="_blank"
					class="font-normal hover:underline w-fit flex flex-row gap-2 items-center mt-4"
				>
					<PDSls />
					<span>View on PDSls</span>
				</a>
			</div>
		</SettingsPage>
	);
};

export const UserSettingsModal: ParentComponent = (props) => {
	return (
		<SettingsModal
			pages={[
				{
					title: "Profile",
					id: "general",
					component: GeneralSettingsPage,
				},
			]}
			debugPage={{
				title: "Debug Information",
				id: "info",
				component: DebugPage,
			}}
		>
			{props.children}
		</SettingsModal>
	);
};
