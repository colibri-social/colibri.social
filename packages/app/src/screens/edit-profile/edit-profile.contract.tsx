import {
	AnimatedImage,
	Avatar,
	Button,
	createLocalPreview,
	DisplayNameField,
	ListGroup,
	NavHeader,
	PROFILE_AVATAR_MAX_BYTES,
	PROFILE_BANNER_MAX_BYTES,
	ProfileImagePicker,
	TextArea,
	TextField,
	ThemeColorPicker,
	ToggleRow,
	toast,
	UploadProgress,
} from "@colibri-social/ui";
import { GalleryAddIcon } from "@solar-icons/solid/bold/gallery-add";
import { GalleryRemoveIcon } from "@solar-icons/solid/bold/gallery-remove";
import { createMemo, createSignal, Show } from "solid-js";
import {
	bioError,
	displayNameError,
	pronounsError,
} from "../../data/profile-limits";
import { themeColorsOf, themeFrom } from "../../data/profile-theme";
import type { ProfileTheme } from "../../data/source";
import {
	type ProfileDraft,
	type ProfileSaveProgress,
	useData,
} from "../../data/store";
import { defineContract, slot } from "../../screen/define";
import { useStack } from "../../shell/stack";
import { createUnsavedForm, UnsavedBar } from "../settings/unsaved-form";
import { usePageHost } from "./page-host";

type Platform = { platform?: "mobile" | "desktop" };

const sameTheme = (a: ProfileTheme | undefined, b: ProfileTheme) =>
	JSON.stringify(themeFrom(a?.accentColor, themeColorsOf(a))) ===
	JSON.stringify(b);

export const editProfile = defineContract({
	id: "editProfile",
	model: (_args: Record<string, never>) => {
		const data = useData();
		const stack = useStack();
		const host = usePageHost();
		const viewer = data.viewer;
		const [displayName, setDisplayName] = createSignal(
			viewer.displayName ?? "",
		);
		const [bio, setBio] = createSignal(viewer.description ?? "");
		const [pronouns, setPronouns] = createSignal(viewer.pronouns ?? "");
		const [accent, setAccent] = createSignal(viewer.theme?.accentColor);
		const [themeColors, setThemeColors] = createSignal(
			themeColorsOf(viewer.theme),
		);
		const [syncBluesky, setSyncBluesky] = createSignal(!!viewer.syncBluesky);
		const [avatarFile, setAvatarFile] = createSignal<File | null>();
		const [bannerFile, setBannerFile] = createSignal<File | null>();
		const [imageError, setImageError] = createSignal<string>();
		const [saving, setSaving] = createSignal(false);
		const [progress, setProgress] = createSignal<ProfileSaveProgress>({});
		const [attempted, setAttempted] = createSignal(false);

		const avatar = createLocalPreview(() =>
			avatarFile() === null ? undefined : viewer.avatar,
		);
		const banner = createLocalPreview(() =>
			bannerFile() === null ? undefined : viewer.banner,
		);

		const theme = () => themeFrom(accent(), themeColors());
		const dirty = createMemo(
			() =>
				displayName() !== (viewer.displayName ?? "") ||
				bio() !== (viewer.description ?? "") ||
				pronouns() !== (viewer.pronouns ?? "") ||
				syncBluesky() !== !!viewer.syncBluesky ||
				avatarFile() !== undefined ||
				bannerFile() !== undefined ||
				!sameTheme(viewer.theme, theme()),
		);
		const nameError = () =>
			syncBluesky() ? undefined : displayNameError(displayName());
		const descriptionError = () =>
			syncBluesky() ? undefined : bioError(bio());
		const pronounsProblem = () => pronounsError(pronouns());
		const valid = () =>
			!nameError() && !descriptionError() && !pronounsProblem();

		const depth = () =>
			host
				? host.depth()
				: stack.mounted().findIndex((layer) => layer.kind === "editProfile") +
					1;

		const reset = () => {
			setDisplayName(viewer.displayName ?? "");
			setBio(viewer.description ?? "");
			setPronouns(viewer.pronouns ?? "");
			setAccent(viewer.theme?.accentColor);
			setThemeColors(themeColorsOf(viewer.theme));
			setSyncBluesky(!!viewer.syncBluesky);
			avatar.clear();
			banner.clear();
			setAvatarFile(undefined);
			setBannerFile(undefined);
			setImageError(undefined);
			setAttempted(false);
		};

		const save = async () => {
			setAttempted(true);
			if (!valid() || saving() || !dirty()) return;
			const draft: ProfileDraft = {
				displayName: displayName(),
				description: bio(),
				pronouns: pronouns(),
				avatar: avatarFile(),
				banner: bannerFile(),
				syncBluesky: syncBluesky(),
				theme: theme(),
			};
			setSaving(true);
			setProgress({});
			try {
				await data.saveProfile(draft, { onProgress: setProgress });
				reset();
				toast.success("Profile updated");
			} catch {
				toast.error("Couldn't update your profile");
			} finally {
				setSaving(false);
			}
		};

		const form = createUnsavedForm({ depth, dirty, saving, save, reset });

		return {
			viewer,
			displayName,
			setDisplayName,
			bio,
			setBio,
			pronouns,
			setPronouns,
			pronounsError: pronounsProblem,
			accent,
			setAccent,
			themeColors,
			setThemeColors,
			syncBluesky,
			setSyncBluesky,
			avatar,
			banner,
			pickAvatar: (file: File) => {
				avatar.set(file);
				setAvatarFile(file);
			},
			removeAvatar: () => {
				avatar.clear();
				setAvatarFile(null);
			},
			pickBanner: (file: File) => {
				banner.set(file);
				setBannerFile(file);
			},
			removeBanner: () => {
				banner.clear();
				setBannerFile(null);
			},
			imageError,
			setImageError,
			saving,
			progress,
			nameError: () => (attempted() ? nameError() : undefined),
			descriptionError,
			save,
			back: () => stack.pop(),
			dirty,
			reset,
			form,
		};
	},
	slots: {
		Header: slot((m) => (
			<NavHeader title="Edit profile" kind="back" onNavigate={m.back} safeTop />
		)),
		Bar: slot((m) => <UnsavedBar form={m.form} />),
		Images: slot((m, p: Platform) => (
			<div data-profile-edit-images="" class="relative">
				<ProfileImagePicker
					maxBytes={PROFILE_BANNER_MAX_BYTES}
					crop="banner"
					platform={p.platform ?? "mobile"}
					onFile={m.pickBanner}
					onError={m.setImageError}
				>
					{(open) => (
						<div class="relative aspect-[3/1] w-full">
							<button
								type="button"
								aria-label={m.banner.src() ? "Change banner" : "Add banner"}
								disabled={m.syncBluesky() || m.saving()}
								onClick={open}
								class="focus-ring-inset absolute inset-0 flex cursor-pointer items-center justify-center overflow-hidden text-white/90 disabled:cursor-not-allowed disabled:opacity-60"
								style={{
									background:
										m.themeColors().length > 1
											? `linear-gradient(135deg, ${m.themeColors()[0]}, ${m.themeColors()[1]})`
											: m.themeColors()[0],
								}}
							>
								<Show
									when={m.banner.src()}
									fallback={<GalleryAddIcon class="size-6 drop-shadow" />}
								>
									{(src) => (
										<AnimatedImage
											data-profile-banner-preview=""
											animated={m.banner.animated()}
											src={src()}
											alt=""
											class="absolute inset-0 size-full object-cover"
										/>
									)}
								</Show>
							</button>
							<Show when={m.saving() && m.progress().banner !== undefined}>
								<UploadProgress
									progress={m.progress().banner ?? 0}
									label="Uploading banner"
								/>
							</Show>
							<Show when={m.banner.src() && !m.syncBluesky() && !m.saving()}>
								<button
									type="button"
									aria-label="Remove banner"
									onClick={m.removeBanner}
									class="focus-ring absolute top-3 right-3 flex size-8 cursor-pointer items-center justify-center rounded-control-xs text-white drop-shadow-[0_1px_2px_rgb(0_0_0/0.6)]"
								>
									<GalleryRemoveIcon class="size-6" />
								</button>
							</Show>
						</div>
					)}
				</ProfileImagePicker>
				<div class="flex items-end justify-between gap-3 px-4">
					<ProfileImagePicker
						maxBytes={PROFILE_AVATAR_MAX_BYTES}
						crop="avatar"
						platform={p.platform ?? "mobile"}
						onFile={m.pickAvatar}
						onError={m.setImageError}
					>
						{(open) => (
							<button
								type="button"
								aria-label={m.avatar.src() ? "Change picture" : "Add picture"}
								disabled={m.syncBluesky() || m.saving()}
								onClick={open}
								class={`focus-ring relative -mt-9 flex size-[88px] shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border-4 bg-muted disabled:cursor-not-allowed ${p.platform === "desktop" ? "border-popover" : "border-background"}`}
							>
								<Show
									when={m.avatar.src()}
									fallback={
										<Avatar
											size="xl"
											name={m.displayName() || m.viewer.handle}
											seed={m.viewer.did}
										/>
									}
								>
									{(src) => (
										<AnimatedImage
											data-profile-avatar-preview=""
											animated={m.avatar.animated()}
											playback="demand"
											frameSize={88}
											src={src()}
											alt=""
											class="size-full object-cover"
										/>
									)}
								</Show>
								<Show when={m.saving() && m.progress().avatar !== undefined}>
									<UploadProgress
										progress={m.progress().avatar ?? 0}
										label="Uploading picture"
									/>
								</Show>
							</button>
						)}
					</ProfileImagePicker>
					<Show when={m.avatar.src() && !m.syncBluesky()}>
						<Button
							variant="secondary"
							disabled={m.saving()}
							onClick={m.removeAvatar}
						>
							Remove picture
						</Button>
					</Show>
				</div>
				<Show when={m.imageError()}>
					<p role="alert" class="m-0 px-4 pt-2 text-sm text-destructive">
						{m.imageError()}
					</p>
				</Show>
			</div>
		)),
		Fields: slot((m, p: Platform) => (
			<div class="flex flex-col gap-4">
				<DisplayNameField
					platform={p.platform ?? "mobile"}
					value={m.displayName()}
					onChange={m.setDisplayName}
					nameColor={m.accent()}
					onNameColorChange={m.setAccent}
					placeholder={m.viewer.handle}
					error={m.nameError()}
					disabled={m.syncBluesky() || m.saving()}
				/>
				<TextField
					label="Pronouns"
					placeholder="they/them"
					description={
						m.syncBluesky()
							? "Leave this empty to show your Bluesky pronouns."
							: "Shown next to your handle on your profile."
					}
					value={m.pronouns()}
					onChange={m.setPronouns}
					error={m.pronounsError()}
					disabled={m.saving()}
				/>
				<TextArea
					label="Bio"
					rows={4}
					autoResize
					showCount
					maxLength={256}
					value={m.bio()}
					onChange={m.setBio}
					error={m.descriptionError()}
					disabled={m.syncBluesky() || m.saving()}
				/>
			</div>
		)),
		Theme: slot((m, p: Platform) => (
			<div class="flex flex-col gap-2">
				<span class="text-sm font-medium text-muted-foreground">
					Theme colors
				</span>
				<ThemeColorPicker
					platform={p.platform ?? "mobile"}
					colors={m.themeColors()}
					onChange={m.setThemeColors}
					disabled={m.saving()}
				/>
			</div>
		)),
		Sync: slot((m) => (
			<ListGroup>
				<ToggleRow
					title="Keep in sync with Bluesky"
					description="When on, your name, avatar, banner and bio mirror your Bluesky profile and can't be edited here."
					checked={m.syncBluesky()}
					onChange={m.setSyncBluesky}
				/>
			</ListGroup>
		)),
	},
});
