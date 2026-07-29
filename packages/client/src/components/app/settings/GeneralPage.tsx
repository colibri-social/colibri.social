import type { JsonBlobRef } from "@atproto/lexicon";
import type { ActorData } from "@colibri-social/lib";
import type { Details } from "@kobalte/core/file-field";
import {
	type Component,
	createSignal,
	For,
	type JSX,
	Match,
	Show,
	Switch,
} from "solid-js";
import { toast } from "somoto";
import ImageIcon from "~icons/ph/image";
import Image from "~icons/ph/image";
import XIcon from "~icons/ph/x";
import XCircleIcon from "~icons/ph/x-circle";
import { createRecord, putRecord, uploadBlob } from "../../../atproto/pds";
import { resolveBlob } from "../../../atproto/resolve-blob";
import { Button } from "../../../components/ui/Button";
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
import { UserContextProvider, useUserContext } from "../../../contexts/User";
import { useIsMobile } from "../../../utils/mobile-pane";
import { Spinner } from "../../icons/Spinner";
import { DialogCloseButton, DialogFooter } from "../../ui/Dialog";
import { ResponsiveDialog } from "../../ui/ResponsiveDialog";
import { Separator } from "../../ui/Separator";
import { SettingsPage } from "../common/SettingsModal";
import { MemberRow } from "../community/MemberSidebar";
import { ColorRow } from "../profile/common";
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

	const [openNewPlate, setOpenNewPlate] = createSignal(false);

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
			<UserContextProvider>
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
								description() !== undefined &&
								description()!.trim().length < 257
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
								class="resize-none text-sm sm:text-base"
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
					<div class="w-full flex-col gap-3 rounded-md border border-border">
						<div class="w-full flex gap-2 grow items-center [&>div]:grow p-3">
							<MemberRow member={user as ActorData} />
							<Button variant="secondary">Clear</Button>
							<Button onClick={() => setOpenNewPlate(true)}>New</Button>
							<NewPlateDialog
								open={openNewPlate()}
								onOpenChange={setOpenNewPlate}
							/>
						</div>
						<Separator class="my-0" />
						<div class="w-full gap-3 p-3 overflow-auto max-h-60 grid grid-cols-2">
							<For
								each={[
									"https://media.discordapp.net/attachments/1487037947147456524/1531758993087795490/image0.gif?ex=6a6a613a&is=6a690fba&hm=86f706f563a7945e578a91a03c13b3a63353f97ea5f53919ba41c1d62131cd14&=",
									"https://images.unsplash.com/photo-1541701494587-cb58502866ab?fm=jpg",
									"https://images.unsplash.com/photo-1508615039623-a25605d2b022?fm=jpg",
									"https://images.unsplash.com/photo-1518709268805-4e9042af9f23?fm=jpg",
									"https://images.unsplash.com/photo-1451187580459-43490279c0fa?fm=jpg",
									"https://images.unsplash.com/photo-1513694203232-719a280e022f?fm=jpg",
								]}
							>
								{(src) => {
									return (
										<img
											class="rounded-sm h-12 w-full object-cover"
											alt=""
											src={src}
										/>
									);
								}}
							</For>
						</div>
					</div>
				</div>

				<div class="mt-4 shrink-0">
					<ThemeControls state={theme()} setState={patchTheme} />
				</div>
			</UserContextProvider>
		</SettingsPage>
	);
};

const PLATE_COLLECTION = "social.colibri.actor.plate";

const NewPlateDialog: Component<{
	open: boolean;
	onOpenChange: (open: boolean) => void;
}> = (props) => {
	const user = useUserContext();
	const isMobile = useIsMobile();

	const [name, setName] = createSignal<string>();
	const [color, setColor] = createSignal<string>("#000000");
	const [picture, setPicture] = createSignal<Details>();
	const [pictureUri, setPictureUri] = createSignal<string>();
	const [saving, setSaving] = createSignal<boolean>(false);

	const resetState = () => {
		setName(undefined);
		setColor("#000000");
		setPicture(undefined);
		setPictureUri(undefined);
	};

	const handleClose = (open: boolean) => {
		resetState();
		props.onOpenChange(open);
	};

	const handleSave = async () => {
		setSaving(true);
		await createRecord(user.atproto.agent, user.did, PLATE_COLLECTION, {
			name: name(),
			color: color(),
			picture: await uploadBlob(
				user.atproto.agent,
				picture()!.acceptedFiles[0]!,
			),
		});
		handleClose(false);
		setSaving(false);
	};

	const nameValid = () => {
		return name() !== undefined &&
			name()!.trim().length < 33 &&
			name()!.trim().length > 0
			? "valid"
			: "invalid";
	};

	const canSave = () => {
		return nameValid() === "valid" && picture() !== undefined;
	};

	return (
		<ResponsiveDialog
			open={props.open}
			onOpenChange={handleClose}
			title="New plate"
		>
			<Show when={!isMobile()}>
				<div class="absolute top-5 right-5 flex items-center justify-center w-6 h-6 hover:bg-muted/50 cursor-pointer rounded-sm z-50">
					<DialogCloseButton class="absolute cursor-pointer">
						<XIcon />
					</DialogCloseButton>
				</div>
			</Show>
			<TextField
				value={name()}
				onChange={setName}
				validationState={nameValid()}
			>
				<TextFieldLabel>Name</TextFieldLabel>
				<TextFieldInput
					minLength={1}
					type="text"
					required
					placeholder="My new plate"
				/>
			</TextField>
			<ColorRow label="Color" value={color()} onChange={setColor} />
			<div class="grid grid-cols-2 w-full gap-3">
				<MemberRow
					member={user as ActorData}
					overridePlate={{ image: pictureUri(), color: color() }}
				/>
				<FileField
					onFileChange={(v) => {
						setPicture(v);
						setPictureUri(URL.createObjectURL(v.acceptedFiles[0]));
					}}
					maxFiles={1}
				>
					<FileFieldDropzone class="w-full h-12 min-h-0 rounded-md overflow-hidden relative">
						<FileFieldTrigger class="h-full w-full bg-muted/25 text-muted-foreground hover:bg-muted/50 p-0">
							<Switch>
								<Match when={picture() === undefined}>
									<div class="flex items-center justify-center gap-2">
										<Image class="w-6! h-6!" />
										<span>Upload background</span>
									</div>
								</Match>
								<Match when={picture() !== undefined}>
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
											setPicture(undefined);
											setPictureUri(undefined);
										}}
										aria-label="Remove background"
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
			<DialogFooter>
				<Button
					variant="secondary"
					disabled={saving()}
					onClick={() => handleClose(false)}
				>
					Cancel
				</Button>
				<Button onClick={handleSave} disabled={saving() || !canSave()}>
					<Spinner
						classList={{
							hidden: !saving(),
							block: saving(),
						}}
					/>
					Save
				</Button>
			</DialogFooter>
		</ResponsiveDialog>
	);
};
