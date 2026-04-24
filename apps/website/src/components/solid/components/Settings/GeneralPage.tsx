import { actions } from "astro:actions";
import { APPVIEW_DOMAIN } from "astro:env/client";
import type { Details } from "@kobalte/core/file-field";
import { type Component, createSignal, Match, Switch } from "solid-js";
import { toast } from "somoto";
import { parseZodToErrorOrDisplay } from "@/utils/parse-zod-to-error-or-display";
import { useGlobalContext } from "../../contexts/GlobalContext";
import Icon from "../../icons/Icon";
import {
	FileField,
	FileFieldDropzone,
	FileFieldHiddenInput,
	FileFieldItem,
	FileFieldItemList,
	FileFieldItemPreviewImage,
	FileFieldTrigger,
} from "../../shadcn-solid/file-field";
import {
	TextField,
	TextFieldInput,
	TextFieldLabel,
	TextFieldTextArea,
} from "../../shadcn-solid/text-field";
import { SettingsPage } from "../common/SettingsModal";

export const GeneralPage: Component = () => {
	const [globalData, { setUserData }] = useGlobalContext();

	const [loading, setLoading] = createSignal<boolean>(false);

	const [banner, setBanner] = createSignal<Details>();
	const [image, setImage] = createSignal<Details>();
	const [name, setName] = createSignal(globalData.user.displayName || "");
	const [description, setDescription] = createSignal(
		globalData.user.description || "",
	);

	const [imageRemoved, setImageRemoved] = createSignal(false);
	const [bannerRemoved, setBannerRemoved] = createSignal(false);

	const [status, setStatus] = createSignal(globalData.user.status);

	const existingImageUrl = () =>
		!imageRemoved() && image() === undefined
			? (globalData.user.avatar ?? null)
			: null;

	const existingBannerUrl = () =>
		!bannerRemoved() && banner() === undefined
			? (globalData.user.banner ?? null)
			: null;

	const hasEdited = (): boolean =>
		name() !== globalData.user.displayName ||
		description() !== globalData.user.description ||
		status() !== globalData.user.status ||
		imageRemoved() ||
		bannerRemoved() ||
		image() !== undefined ||
		banner() !== undefined;

	const cdnUrlToAppViewUrl = (url: string | null) => {
		if (!url) return null;
		if (!url.startsWith("https://cdn.bsky.app")) return url;

		const split = url.split("/");
		const did = split[6];
		const cid = split[7];

		return `https://${APPVIEW_DOMAIN}/api/blob?did=${did}&cid=${cid}`;
	};

	const saveProfile = async () => {
		setLoading(true);

		// Download original image, convert to base64 if defined and not changed
		const existingImage = cdnUrlToAppViewUrl(existingImageUrl());
		const existingBanner = cdnUrlToAppViewUrl(existingBannerUrl());
		const reader = new FileReader();

		let imageBase64: string | undefined;
		let imageMimeType: string | undefined;
		let bannerBase64: string | undefined;
		let bannerMimeType: string | undefined;

		if (existingImage) {
			const originalImage = await (await fetch(existingImage)).blob();

			imageBase64 = await new Promise<string>((resolve, reject) => {
				reader.onload = () => resolve(reader.result as string);
				reader.onerror = reject;
				reader.readAsDataURL(originalImage);
			});

			imageMimeType = originalImage.type;
			// Get mime type for image, convert to base64
		} else if (image()) {
			imageBase64 = await new Promise<string>((resolve, reject) => {
				reader.onload = () => resolve(reader.result as string);
				reader.onerror = reject;
				reader.readAsDataURL(image()!.acceptedFiles[0]);
			});

			imageMimeType = image()!.acceptedFiles[0].type;
		}

		if (existingBanner) {
			const originalImage = await (await fetch(existingBanner)).blob();

			bannerBase64 = await new Promise<string>((resolve, reject) => {
				reader.onload = () => resolve(reader.result as string);
				reader.onerror = reject;
				reader.readAsDataURL(originalImage);
			});

			bannerMimeType = originalImage.type;
			// Get mime type for image, convert to base64
		} else if (banner()) {
			bannerBase64 = await new Promise<string>((resolve, reject) => {
				reader.onload = () => resolve(reader.result as string);
				reader.onerror = reject;
				reader.readAsDataURL(banner()!.acceptedFiles[0]);
			});

			bannerMimeType = banner()!.acceptedFiles[0].type;
		}

		const userData = await actions.editProfile({
			name: name(),
			description: description(),
			image: imageBase64
				? {
						base64: imageBase64,
						type: imageMimeType!,
					}
				: undefined,
			banner: bannerBase64
				? {
						base64: bannerBase64,
						type: bannerMimeType!,
					}
				: undefined,
		});

		if (userData.error) {
			setLoading(false);
			toast.error("Failed to update profile", {
				description: parseZodToErrorOrDisplay(userData.error.message),
			});
			return;
		}

		setUserData({
			...globalData.user,
			displayName: name(),
			description: description(),
			avatar: userData.data.imageUrl,
			banner: userData.data.bannerUrl,
		});
		resetEdits();
		setLoading(false);
	};

	const resetEdits = () => {
		setName(globalData.user.displayName || "");
		setDescription(globalData.user.description || "");
		setImage(undefined);
		setBanner(undefined);
		setImageRemoved(false);
		setBannerRemoved(false);
		setStatus(globalData.user.status);
	};

	return (
		<SettingsPage
			loading={loading}
			canReset={hasEdited()}
			title="Profile"
			onSave={saveProfile}
			onReset={resetEdits}
		>
			<div class="w-full flex flex-col rounded-2xl border border-border bg-card text-foreground overflow-hidden relative">
				<FileField
					class="items-start absolute w-full aspect-3/1 h-auto"
					onFileChange={setBanner}
					maxFiles={1}
				>
					<FileFieldDropzone class="w-full h-full rounded-none border-none">
						<FileFieldTrigger class="h-full w-full p-0 bg-muted/25 hover:bg-muted/50 overflow-hidden rounded-none">
							<Switch>
								<Match when={banner() !== undefined}>
									<div class="relative h-full w-full">
										<FileFieldItemList class="h-full w-full m-0 p-0">
											{() => (
												<FileFieldItem class="h-full w-full m-0 p-0 border-none block [&>div]:w-full [&>div]:h-full">
													<FileFieldItemPreviewImage class="h-full w-full aspect-3/1 self-center object-cover rounded-none" />
												</FileFieldItem>
											)}
										</FileFieldItemList>
									</div>
								</Match>
								<Match when={existingBannerUrl() !== null}>
									<div class="relative h-full w-full">
										<img
											src={existingBannerUrl()!}
											alt={name()}
											class="h-full w-full object-cover aspect-3/1"
										/>
									</div>
								</Match>
								<Match when={true}>
									<div class="flex flex-col items-center justify-center gap-1">
										<Icon
											variant="regular"
											name="image-icon"
											class="w-6! h-6!"
										/>
										<span>Upload</span>
									</div>
								</Match>
							</Switch>
						</FileFieldTrigger>
					</FileFieldDropzone>
					<FileFieldHiddenInput />
				</FileField>
				<div class="flex flex-col mt-32 p-4 gap-2">
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
												alt={name()}
												class="w-24 h-24 object-cover"
											/>
										</div>
									</Match>
									<Match when={true}>
										<div class="flex flex-col items-center justify-center gap-1">
											<Icon
												variant="regular"
												name="image-icon"
												class="w-6! h-6!"
											/>
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
							name()!.trim().length < 64 &&
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
						<TextFieldTextArea
							rows={10}
							maxLength={256}
							required
							class="resize-none"
						/>
					</TextField>
				</div>
			</div>
		</SettingsPage>
	);
};
