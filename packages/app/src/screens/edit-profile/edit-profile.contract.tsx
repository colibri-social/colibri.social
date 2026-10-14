import {
	AnimatedImage,
	Avatar,
	Button,
	createLocalPreview,
	DisplayNameField,
	ListGroup,
	Modal,
	ModalContent,
	NavHeader,
	PROFILE_AVATAR_MAX_BYTES,
	PROFILE_BANNER_MAX_BYTES,
	ProfileImagePicker,
	TextArea,
	ThemeColorPicker,
	ToggleRow,
	toast,
	UploadProgress,
} from "@colibri-social/ui";
import { GalleryAddIcon } from "@solar-icons/solid/bold/gallery-add";
import { GalleryRemoveIcon } from "@solar-icons/solid/bold/gallery-remove";
import { createMemo, createSignal, onCleanup, Show } from "solid-js";
import { bioError, displayNameError } from "../../data/profile-limits";
import type { ProfileTheme } from "../../data/source";
import {
	type ProfileDraft,
	type ProfileSaveProgress,
	useData,
} from "../../data/store";
import { defineContract, slot } from "../../screen/define";
import { useStack } from "../../shell/stack";
import { type LeaveReason, usePageHost } from "./page-host";

type Platform = { platform?: "mobile" | "desktop" };

const DEFAULT_BANNER = "#2b2b31";

const themeColorsOf = (theme: ProfileTheme | undefined) => {
	if (theme?.gradient?.primary && theme.gradient.secondary) {
		return [theme.gradient.primary, theme.gradient.secondary];
	}
	return [theme?.bannerColor ?? DEFAULT_BANNER];
};

const themeFrom = (
	accent: string | undefined,
	colors: string[],
): ProfileTheme => {
	const theme: ProfileTheme = {};
	if (accent) theme.accentColor = accent;
	const [primary, secondary] = colors;
	if (primary && secondary) theme.gradient = { primary, secondary };
	else if (primary) theme.bannerColor = primary;
	return theme;
};

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
		const [discardOpen, setDiscardOpen] = createSignal(false);
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
				syncBluesky() !== !!viewer.syncBluesky ||
				avatarFile() !== undefined ||
				bannerFile() !== undefined ||
				!sameTheme(viewer.theme, theme()),
		);
		const nameError = () =>
			syncBluesky() ? undefined : displayNameError(displayName());
		const descriptionError = () =>
			syncBluesky() ? undefined : bioError(bio());
		const valid = () => !nameError() && !descriptionError();

		const depth = () =>
			host
				? host.depth()
				: stack.mounted().findIndex((layer) => layer.kind === "editProfile") +
					1;

		const blocked = () => dirty() && !saving();
		const onBlocked = () => setDiscardOpen(true);

		onCleanup(
			stack.setPopGuard({
				get depth() {
					return depth();
				},
				blocked,
				onBlocked,
			}),
		);
		if (host) onCleanup(host.register({ blocked, onBlocked }));

		const leave = (reason: LeaveReason) => {
			if (host) host.proceed(reason);
			else stack.forcePop();
		};

		const reset = () => {
			setDisplayName(viewer.displayName ?? "");
			setBio(viewer.description ?? "");
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
			if (!valid() || saving()) return;
			if (!dirty()) {
				leave("saved");
				return;
			}
			const draft: ProfileDraft = {
				displayName: displayName(),
				description: bio(),
				avatar: avatarFile(),
				banner: bannerFile(),
				syncBluesky: syncBluesky(),
				theme: theme(),
			};
			setSaving(true);
			setProgress({});
			try {
				await data.saveProfile(draft, { onProgress: setProgress });
				setAvatarFile(undefined);
				setBannerFile(undefined);
				toast.success("Profile updated");
				leave("saved");
			} catch {
				toast.error("Couldn't update your profile");
			} finally {
				setSaving(false);
			}
		};

		return {
			viewer,
			displayName,
			setDisplayName,
			bio,
			setBio,
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
			discardOpen,
			setDiscardOpen,
			discard: () => {
				setDiscardOpen(false);
				if (host) reset();
				leave("discard");
			},
			dirty,
			reset,
		};
	},
	slots: {
		Header: slot((m, p: Platform) => (
			<Show
				when={p.platform === "desktop"}
				fallback={
					<NavHeader
						title="Edit profile"
						kind="back"
						onNavigate={m.back}
						safeTop
						action={{
							type: "text",
							label: "Save",
							onClick: () => void m.save(),
							loading: m.saving(),
						}}
					/>
				}
			>
				<div
					data-profile-save-bar=""
					class="flex shrink-0 items-center justify-end gap-2 border-t border-border bg-popover px-4 py-3"
				>
					<Show when={m.dirty() && !m.saving()}>
						<Button variant="secondary" onClick={m.reset}>
							Reset
						</Button>
					</Show>
					<Button
						loading={m.saving()}
						disabled={!m.dirty()}
						onClick={() => void m.save()}
					>
						Save changes
					</Button>
				</div>
			</Show>
		)),
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
		Discard: slot((m) => (
			<Modal open={m.discardOpen()} onOpenChange={m.setDiscardOpen}>
				<ModalContent
					title="Discard changes?"
					description="Your edits to your profile won't be saved."
					footer={
						<>
							<Button
								variant="secondary"
								onClick={() => m.setDiscardOpen(false)}
							>
								Keep editing
							</Button>
							<Button variant="destructive" onClick={m.discard}>
								Discard
							</Button>
						</>
					}
				/>
			</Modal>
		)),
	},
});
