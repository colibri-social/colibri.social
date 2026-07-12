import type { JsonBlobRef } from "@atproto/lexicon";
import type { Details } from "@kobalte/core/file-field";
import {
	type Component,
	createSignal,
	type JSX,
	Match,
	Switch,
} from "solid-js";
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
	SwitchControl,
	SwitchDescription,
	SwitchInput,
	SwitchLabel,
	SwitchThumb,
	Switch as Toggle,
} from "../../../components/ui/Switch";
import {
	TextField,
	TextFieldInput,
	TextFieldLabel,
	TextFieldTextArea,
} from "../../../components/ui/TextField";
import { useUserContext } from "../../../contexts/User";
import { SettingsPage } from "../common/SettingsModal";
import {
	ThemeControls,
	type ThemeState,
	themeStateFromTheme,
	themeStateToRecord,
} from "../profile/theme";
import { displayableNameFn } from "../user/DisplayableName";

const COLLECTION = "social.colibri.actor.profile";

export const GeneralPage: Component = () => {
	const user = useUserContext();
	const [loading, setLoading] = createSignal<boolean>(false);

	const [banner, setBanner] = createSignal<Details>();
	const [image, setImage] = createSignal<Details>();
	const [name, setName] = createSignal(displayableNameFn(user));
	const [description, setDescription] = createSignal(
		user.data.description || "",
	);
	const [syncBluesky, setSyncBluesky] = createSignal(
		user.data.syncBluesky ?? false,
	);
	const [theme, setTheme] = createSignal<ThemeState>(
		themeStateFromTheme(user.data.theme),
	);

	const [imageRemoved, setImageRemoved] = createSignal(false);
	const [bannerRemoved, setBannerRemoved] = createSignal(false);

	const bannerStyle = (): JSX.CSSProperties => {
		const t = theme();
		if (t.useGradient)
			return {
				background: `linear-gradient(135deg, ${t.gradientPrimary}, ${t.gradientSecondary})`,
			};
		return { background: t.bannerColor };
	};

	const existingImageUrl = () =>
		!imageRemoved() && image() === undefined
			? (user.data.avatar ?? undefined)
			: undefined;

	const existingBannerUrl = () =>
		!bannerRemoved() && banner() === undefined
			? (user.data.banner ?? undefined)
			: undefined;

	const initialTheme = JSON.stringify(themeStateToRecord(theme()));

	const hasEdited = (): boolean =>
		name() !== displayableNameFn(user) ||
		description() !== (user.data.description ?? "") ||
		syncBluesky() !== (user.data.syncBluesky ?? false) ||
		JSON.stringify(themeStateToRecord(theme())) !== initialTheme ||
		imageRemoved() ||
		bannerRemoved() ||
		image() !== undefined ||
		banner() !== undefined;

	const patchTheme = (patch: Partial<ThemeState>) =>
		setTheme((prev) => ({ ...prev, ...patch }));

	const saveProfile = async () => {
		setLoading(true);

		try {
			const { agent } = user.atproto;
			const repo = user.did;
			const sync = syncBluesky();

			let record: Record<string, unknown> = {};
			try {
				const res = await agent.com.atproto.repo.getRecord({
					repo,
					collection: COLLECTION,
					rkey: "self",
				});
				record = (res.data.value as Record<string, unknown>) ?? {};
			} catch {
				// No record yet — create one from scratch.
			}

			record.syncBluesky = sync;

			const themeRecord = themeStateToRecord(theme());
			record.theme = themeRecord;

			const patch: Partial<typeof user.data> = {
				syncBluesky: sync,
				theme: themeRecord,
			};

			if (sync) {
				// Bluesky is the live source for the mirrored fields, so drop them
				// from the record. Reflect the current Bluesky values locally.
				record.displayName = undefined;
				record.description = undefined;
				record.avatar = undefined;
				record.banner = undefined;

				try {
					const res = await agent.com.atproto.repo.getRecord({
						repo,
						collection: "app.bsky.actor.profile",
						rkey: "self",
					});
					const bsky = res.data.value as Record<string, unknown>;
					patch.displayName = (bsky.displayName as string) ?? user.handle;
					patch.description = (bsky.description as string) ?? "";
					patch.avatar = bsky.avatar as JsonBlobRef | undefined;
					patch.banner = bsky.banner as JsonBlobRef | undefined;
				} catch {
					// No Bluesky profile to mirror.
				}
			} else {
				record.displayName = name().trim();
				record.description = description().trim();
				patch.displayName = name().trim();
				patch.description = description().trim();

				// Avatar: upload a new file, clear it on removal, otherwise leave
				// as-is. `toJSON()` yields the `{ ref: { $link } }` shape that
				// `resolveBlob` expects for freshly uploaded blobs.
				if (image()) {
					const blob = await uploadBlob(agent, image()!.acceptedFiles[0]);
					record.avatar = blob;
					patch.avatar = blob.toJSON() as unknown as JsonBlobRef;
				} else if (imageRemoved()) {
					record.avatar = undefined;
					patch.avatar = undefined;
				}

				if (banner()) {
					const blob = await uploadBlob(agent, banner()!.acceptedFiles[0]);
					record.banner = blob;
					patch.banner = blob.toJSON() as unknown as JsonBlobRef;
				} else if (bannerRemoved()) {
					record.banner = undefined;
					patch.banner = undefined;
				}
			}

			await putRecord(agent, repo, COLLECTION, "self", record);

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
		setName(displayableNameFn(user));
		setDescription(user.data.description || "");
		setSyncBluesky(user.data.syncBluesky ?? false);
		setTheme(themeStateFromTheme(user.data.theme));
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
			<div class="w-full shrink-0 flex flex-col rounded-2xl border border-border bg-card text-foreground overflow-hidden relative">
				<FileField
					class="items-start absolute w-full aspect-3/1 h-auto min-h-42"
					onFileChange={setBanner}
					maxFiles={1}
					disabled={syncBluesky()}
				>
					<FileFieldDropzone class="w-full h-full rounded-none border-none min-h-0">
						<FileFieldTrigger
							class="h-full w-full p-0 overflow-hidden rounded-none transition hover:brightness-110"
							style={bannerStyle()}
						>
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
									<div class="flex flex-col items-center justify-center gap-1 text-white/90 drop-shadow">
										<ImageIcon class="w-6! h-6!" />
										<span>Upload</span>
									</div>
								</Match>
							</Switch>
						</FileFieldTrigger>
					</FileFieldDropzone>
					<FileFieldHiddenInput />
				</FileField>
				<div class="flex flex-col mt-26 p-4 gap-2 z-20">
					<FileField
						class="items-start"
						onFileChange={setImage}
						maxFiles={1}
						disabled={syncBluesky()}
					>
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
						<TextFieldInput
							maxLength={32}
							minLength={1}
							type="text"
							required
							disabled={syncBluesky()}
							class="font-bold"
							style={{ color: theme().accentColor }}
						/>
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
						<TextFieldLabel>Bio</TextFieldLabel>
						<TextFieldTextArea
							rows={9}
							maxLength={256}
							required
							disabled={syncBluesky()}
							class="resize-none"
						/>
					</TextField>
				</div>
			</div>

			<Toggle
				class="flex flex-row gap-4 items-center w-full justify-between mt-4 shrink-0"
				checked={syncBluesky()}
				onChange={setSyncBluesky}
			>
				<div>
					<SwitchLabel>Keep in sync with Bluesky</SwitchLabel>
					<SwitchDescription>
						When on, your name, avatar, banner and bio mirror your Bluesky
						profile and can't be edited here.
					</SwitchDescription>
				</div>
				<div>
					<SwitchInput />
					<SwitchControl>
						<SwitchThumb />
					</SwitchControl>
				</div>
			</Toggle>

			<div class="mt-4 shrink-0">
				<ThemeControls state={theme()} setState={patchTheme} />
			</div>
		</SettingsPage>
	);
};
