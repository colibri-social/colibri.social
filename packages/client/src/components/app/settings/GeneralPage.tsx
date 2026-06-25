import type { JsonBlobRef } from "@atproto/lexicon";
import type { Details } from "@kobalte/core/file-field";
import { type Component, createSignal, Match, Switch } from "solid-js";
import { toast } from "somoto";
import ImageIcon from "~icons/ph/image";
import { putRecord, uploadBlob } from "../../../atproto/pds";
import { resolveBlob } from "../../../atproto/resolve-blob";
import {
	FileField,
	FileFieldDropzone,
	FileFieldHiddenInput,
	FileFieldItem,
	FileFieldItemList,
	FileFieldItemPreviewImage,
	FileFieldTrigger,
} from "../../../components/ui/FileField";
import {
	TextField,
	TextFieldInput,
	TextFieldLabel,
	TextFieldTextArea,
} from "../../../components/ui/TextField";
import { useUserContext } from "../../../contexts/User";
import { SettingsPage } from "../common/SettingsModal";

export const GeneralPage: Component = () => {
	const user = useUserContext();
	const [loading, setLoading] = createSignal<boolean>(false);

	const [banner, setBanner] = createSignal<Details>();
	const [image, setImage] = createSignal<Details>();
	const [name, setName] = createSignal(user.data.displayName || "");
	const [description, setDescription] = createSignal(
		user.data.description || "",
	);

	const [imageRemoved, setImageRemoved] = createSignal(false);
	const [bannerRemoved, setBannerRemoved] = createSignal(false);

	const existingImageUrl = () =>
		!imageRemoved() && image() === undefined
			? (user.data.avatar ?? undefined)
			: undefined;

	const existingBannerUrl = () =>
		!bannerRemoved() && banner() === undefined
			? (user.data.banner ?? undefined)
			: undefined;

	const hasEdited = (): boolean =>
		name() !== user.data.displayName ||
		description() !== user.data.description ||
		imageRemoved() ||
		bannerRemoved() ||
		image() !== undefined ||
		banner() !== undefined;

	const saveProfile = async () => {
		setLoading(true);

		try {
			const { agent } = user.atproto;
			const repo = user.did;

			// Profile fields (display name, description, avatar, banner) live in the
			// user's own `app.bsky.actor.profile` record, so we write straight to the
			// PDS. Read the current record first to preserve fields this form doesn't
			// manage and to keep blobs the user didn't touch.
			let record: Record<string, unknown> = {};
			try {
				const res = await agent.com.atproto.repo.getRecord({
					repo,
					collection: "app.bsky.actor.profile",
					rkey: "self",
				});
				record = (res.data.value as Record<string, unknown>) ?? {};
			} catch {
				// No profile record yet — create one from scratch.
			}

			// Mirror every change into the local cache so the UI updates without a
			// full refetch. `toJSON()` yields the `{ ref: { $link } }` shape that
			// `resolveBlob` expects for freshly uploaded blobs.
			const patch: Partial<typeof user.data> = {
				displayName: name().trim(),
				description: description().trim(),
			};

			// Avatar: upload a new file, clear it on removal, otherwise leave as-is.
			if (image()) {
				const blob = await uploadBlob(agent, image()!.acceptedFiles[0]);
				record.avatar = blob;
				patch.avatar = blob.toJSON() as unknown as JsonBlobRef;
			} else if (imageRemoved()) {
				record.avatar = undefined;
				patch.avatar = undefined;
			}

			// Banner: same three cases.
			if (banner()) {
				const blob = await uploadBlob(agent, banner()!.acceptedFiles[0]);
				record.banner = blob;
				patch.banner = blob.toJSON() as unknown as JsonBlobRef;
			} else if (bannerRemoved()) {
				record.banner = undefined;
				patch.banner = undefined;
			}

			record.displayName = name().trim();
			record.description = description().trim();

			await putRecord(agent, repo, "app.bsky.actor.profile", "self", record);

			user.updateActorData(patch);

			toast.success("Profile updated.");
			resetEdits();
		} catch (err) {
			console.error("[GeneralPage] Failed to save profile", err);
			toast.error("Failed to update profile.");
		} finally {
			setLoading(false);
		}
	};

	const resetEdits = () => {
		setName(user.data.displayName || "");
		setDescription(user.data.description || "");
		setImage(undefined);
		setBanner(undefined);
		setImageRemoved(false);
		setBannerRemoved(false);
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
								<Match
									when={
										resolveBlob(user.did, existingBannerUrl()!) !== undefined
									}
								>
									<div class="relative h-full w-full">
										<img
											src={resolveBlob(user.did, existingBannerUrl()!)}
											alt={name()}
											class="h-full w-full object-cover aspect-3/1"
										/>
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
									<Match
										when={
											resolveBlob(user.did, existingImageUrl()!) !== undefined
										}
									>
										<div class="relative w-24 h-24">
											<img
												src={resolveBlob(user.did, existingImageUrl()!)}
												alt={name()}
												class="w-24 h-24 object-cover"
											/>
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
