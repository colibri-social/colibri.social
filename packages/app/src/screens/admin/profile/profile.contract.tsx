import {
	AnimatedImage,
	Button,
	createLocalPreview,
	ListGroup,
	Modal,
	ModalContent,
	PROFILE_AVATAR_MAX_BYTES,
	PROFILE_BANNER_MAX_BYTES,
	ProfileImagePicker,
	SpaceIcon,
	StatusScreen,
	TextArea,
	TextField,
	ToggleRow,
	toast,
	UploadProgress,
} from "@colibri-social/ui";
import { DangerTriangleIcon } from "@solar-icons/solid/bold/danger-triangle";
import { GalleryAddIcon } from "@solar-icons/solid/bold/gallery-add";
import { GalleryRemoveIcon } from "@solar-icons/solid/bold/gallery-remove";
import {
	createEffect,
	createMemo,
	createSignal,
	onCleanup,
	Show,
} from "solid-js";
import {
	COMMUNITY_DESCRIPTION_MAX,
	COMMUNITY_NAME_MAX,
	type CommunityImageKind,
	type UpdateCommunityInput,
} from "../../../data/source";
import { defineContract, slot } from "../../../screen/define";
import { usePlatform } from "../../../screen/platform";
import type { AdminArgs } from "../../../shell/registry";
import { useStack } from "../../../shell/stack";
import { AdminNavHeader } from "../desktop/page-header";
import { useAdminSpace } from "../space-admin";

export const spaceNameError = (name: string) => {
	const trimmed = name.trim();
	if (trimmed.length === 0) return "Give your Space a name.";
	if (trimmed.length > COMMUNITY_NAME_MAX) {
		return `Names can be up to ${COMMUNITY_NAME_MAX} characters.`;
	}
	return undefined;
};

export const spaceDescriptionError = (description: string) =>
	description.trim().length > COMMUNITY_DESCRIPTION_MAX
		? `Descriptions can be up to ${COMMUNITY_DESCRIPTION_MAX} characters.`
		: undefined;

type ImageProgress = Partial<Record<CommunityImageKind, number>>;

export const spaceProfile = defineContract({
	id: "adminProfile",
	model: (args: AdminArgs) => {
		const stack = useStack();
		const admin = useAdminSpace(args.space);
		const { data, community } = admin;
		const initial = community();
		const [name, setName] = createSignal(initial?.name ?? "");
		const [description, setDescription] = createSignal(
			initial?.description ?? "",
		);
		const [requiresApproval, setRequiresApproval] = createSignal(
			!!initial?.requiresApprovalToJoin,
		);
		const [pictureFile, setPictureFile] = createSignal<File | null>();
		const [bannerFile, setBannerFile] = createSignal<File | null>();
		const [imageError, setImageError] = createSignal<string>();
		const [saving, setSaving] = createSignal(false);
		const [progress, setProgress] = createSignal<ImageProgress>({});
		const [discardOpen, setDiscardOpen] = createSignal(false);
		const [attempted, setAttempted] = createSignal(false);
		let seeded = !!initial;
		createEffect(() => {
			const current = community();
			if (seeded || !current) return;
			seeded = true;
			setName(current.name);
			setDescription(current.description ?? "");
			setRequiresApproval(!!current.requiresApprovalToJoin);
		});
		const picture = createLocalPreview(() =>
			pictureFile() === null ? undefined : community()?.picture,
		);
		const banner = createLocalPreview(() =>
			bannerFile() === null ? undefined : community()?.banner,
		);

		const changes = createMemo((): Omit<UpdateCommunityInput, "community"> => {
			const current = community();
			const next: Omit<UpdateCommunityInput, "community"> = {};
			if (!current) return next;
			if (name().trim() !== current.name) next.name = name().trim();
			if (description().trim() !== (current.description ?? "")) {
				next.description = description().trim();
			}
			if (requiresApproval() !== !!current.requiresApprovalToJoin) {
				next.requiresApprovalToJoin = requiresApproval();
			}
			return next;
		});
		const dirty = createMemo(
			() =>
				Object.keys(changes()).length > 0 ||
				pictureFile() !== undefined ||
				bannerFile() !== undefined,
		);
		const nameError = () => spaceNameError(name());
		const descriptionError = () => spaceDescriptionError(description());
		const valid = () => !nameError() && !descriptionError();

		const depth = () =>
			stack
				.mounted()
				.findIndex(
					(layer) =>
						layer.kind === "admin" &&
						layer.page === "profile" &&
						layer.space === args.space,
				) + 1;

		onCleanup(
			stack.setPopGuard({
				get depth() {
					return depth();
				},
				blocked: () => dirty() && !saving(),
				onBlocked: () => setDiscardOpen(true),
			}),
		);

		const leave = () => stack.forcePop();

		const uploadImage = async (kind: CommunityImageKind, file: File | null) => {
			const current = community();
			if (!current) return;
			await data.community.setImage(current.did, kind, file, (fraction) =>
				setProgress((value) => ({ ...value, [kind]: fraction })),
			);
		};

		const save = async () => {
			setAttempted(true);
			const current = community();
			if (!current || !valid() || saving()) return;
			if (!dirty()) {
				leave();
				return;
			}
			setSaving(true);
			setProgress({});
			try {
				const pending: Promise<unknown>[] = [];
				const nextPicture = pictureFile();
				const nextBanner = bannerFile();
				if (nextPicture !== undefined) {
					pending.push(uploadImage("picture", nextPicture));
				}
				if (nextBanner !== undefined) {
					pending.push(uploadImage("banner", nextBanner));
				}
				await Promise.all(pending);
				setPictureFile(undefined);
				setBannerFile(undefined);
				const patch = changes();
				if (Object.keys(patch).length > 0) {
					await data.community.update({ community: current.did, ...patch });
				}
				toast.success("Space profile saved");
				leave();
			} catch {
				toast.error("Couldn't save the Space profile");
			} finally {
				setSaving(false);
			}
		};

		return {
			...admin,
			name,
			setName,
			description,
			setDescription,
			requiresApproval,
			setRequiresApproval,
			picture,
			banner,
			pickPicture: (file: File) => {
				picture.set(file);
				setPictureFile(file);
			},
			removePicture: () => {
				picture.clear();
				setPictureFile(null);
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
				leave();
			},
		};
	},
	slots: {
		Header: slot((m) => (
			<AdminNavHeader
				title="Space profile"
				kind="back"
				onNavigate={m.back}
				safeTop
				action={
					m.community()
						? {
								type: "text",
								label: "Save",
								onClick: () => void m.save(),
								loading: m.saving(),
							}
						: undefined
				}
			/>
		)),
		Missing: slot((m) => (
			<Show when={m.missing()}>
				<StatusScreen
					tone="destructive"
					icon={<DangerTriangleIcon />}
					title="This Space isn't available"
					description="It may have been deleted, or you're no longer a member."
				/>
			</Show>
		)),
		Images: slot((m) => (
			<div data-space-profile-images="" class="relative">
				<ProfileImagePicker
					maxBytes={PROFILE_BANNER_MAX_BYTES}
					crop="banner"
					platform={usePlatform()()}
					onFile={m.pickBanner}
					onError={m.setImageError}
				>
					{(open) => (
						<div class="relative aspect-[3/1] w-full overflow-hidden rounded-control bg-secondary">
							<button
								type="button"
								aria-label={m.banner.src() ? "Change banner" : "Add banner"}
								disabled={m.saving()}
								onClick={open}
								class="focus-ring-inset absolute inset-0 flex cursor-pointer items-center justify-center overflow-hidden text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60"
							>
								<Show
									when={m.banner.src()}
									fallback={<GalleryAddIcon class="size-6" />}
								>
									{(src) => (
										<AnimatedImage
											data-space-banner-preview=""
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
							<Show when={m.banner.src() && !m.saving()}>
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
						platform={usePlatform()()}
						onFile={m.pickPicture}
						onError={m.setImageError}
					>
						{(open) => (
							<button
								type="button"
								aria-label={m.picture.src() ? "Change icon" : "Add icon"}
								disabled={m.saving()}
								onClick={open}
								class="focus-ring relative -mt-8 flex size-[72px] shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-control border-4 border-popover bg-muted disabled:cursor-not-allowed"
							>
								<Show
									when={m.picture.src()}
									fallback={<SpaceIcon name={m.name() || "Space"} size={64} />}
								>
									{(src) => (
										<AnimatedImage
											data-space-icon-preview=""
											animated={m.picture.animated()}
											src={src()}
											alt=""
											class="size-full object-cover"
										/>
									)}
								</Show>
								<Show when={m.saving() && m.progress().picture !== undefined}>
									<UploadProgress
										progress={m.progress().picture ?? 0}
										label="Uploading icon"
									/>
								</Show>
							</button>
						)}
					</ProfileImagePicker>
					<Show when={m.picture.src()}>
						<Button
							variant="secondary"
							disabled={m.saving()}
							onClick={m.removePicture}
						>
							Remove icon
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
		Fields: slot((m) => (
			<div class="flex flex-col gap-4">
				<TextField
					label="Name"
					value={m.name()}
					onChange={m.setName}
					maxLength={COMMUNITY_NAME_MAX}
					error={m.nameError()}
					disabled={m.saving()}
					required
				/>
				<TextArea
					label="Description"
					rows={3}
					autoResize
					showCount
					maxLength={COMMUNITY_DESCRIPTION_MAX}
					value={m.description()}
					onChange={m.setDescription}
					error={m.descriptionError()}
					disabled={m.saving()}
				/>
			</div>
		)),
		Access: slot((m) => (
			<ListGroup>
				<ToggleRow
					title="Require join approval"
					description="New members need to be approved before they can chat in this Space."
					checked={m.requiresApproval()}
					onChange={m.setRequiresApproval}
					disabled={m.saving()}
				/>
			</ListGroup>
		)),
		Discard: slot((m) => (
			<Modal open={m.discardOpen()} onOpenChange={m.setDiscardOpen}>
				<ModalContent
					title="Discard changes?"
					description="Your edits to this Space won't be saved."
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
