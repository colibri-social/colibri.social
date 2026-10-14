import {
	Button,
	IconButton,
	ImageCropper,
	ImageUploadTile,
	PROFILE_AVATAR_MAX_BYTES,
	PROFILE_CROP_INPUT_MAX_BYTES,
	PROFILE_IMAGE_ACCEPT,
	TextField,
	toast,
} from "@colibri-social/ui";
import { CloseIcon } from "@solar-icons/solid/bold/close";
import { createSignal, onCleanup, Show } from "solid-js";
import { spaceKey } from "../../data/ids";
import { COMMUNITY_NAME_MAX } from "../../data/source";
import { IMAGES_NOT_SAVED } from "../../data/space-directory";
import { useData } from "../../data/store";
import { defineContract, slot } from "../../screen/define";
import { usePlatform } from "../../screen/platform";
import { useStack } from "../../shell/stack";

export type CreateSpaceArgs = Record<string, string>;

const createPreview = () => {
	const [file, setFile] = createSignal<File>();
	const [src, setSrc] = createSignal<string>();
	const release = () => {
		const current = src();
		if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
	};
	onCleanup(release);
	return {
		file,
		src,
		animated: () => file()?.type === "image/gif",
		set: (next: File | undefined) => {
			release();
			setFile(next);
			setSrc(next ? URL.createObjectURL(next) : undefined);
		},
	};
};

export const CREATE_SPACE_COPY = {
	title: "Create your Space",
	description: "A Space is where you and other people hang out.",
} as const;

export const createSpace = defineContract({
	id: "createSpace",
	model: (_args: CreateSpaceArgs) => {
		const data = useData();
		const stack = useStack();
		const [name, setName] = createSignal("");
		const [creating, setCreating] = createSignal(false);
		const [imageError, setImageError] = createSignal<string>();
		const [cropping, setCropping] = createSignal<File>();
		const [cropOpen, setCropOpen] = createSignal(false);
		const picture = createPreview();

		const trimmedName = () => name().trim();
		const nameError = () =>
			name().length > 0 && trimmedName().length === 0
				? "Enter a name for your Space."
				: trimmedName().length > COMMUNITY_NAME_MAX
					? `Use ${COMMUNITY_NAME_MAX} characters or fewer.`
					: undefined;
		const canCreate = () =>
			trimmedName().length > 0 && !nameError() && !creating();

		const pickIcon = (file: File) => {
			setImageError(undefined);
			if (file.type === "image/gif") {
				if (file.size > PROFILE_AVATAR_MAX_BYTES) {
					setImageError("This image is too large. Pick one under 1 MB.");
					return;
				}
				picture.set(file);
				return;
			}
			setCropping(file);
			setCropOpen(true);
		};

		const applyIconCrop = (file: File) => {
			if (file.size > PROFILE_AVATAR_MAX_BYTES) {
				setImageError("This image is still too large after cropping.");
				return;
			}
			picture.set(file);
		};

		const depth = () =>
			stack.mounted().findIndex((layer) => layer.kind === "createSpace") + 1;
		onCleanup(
			stack.setPopGuard({
				get depth() {
					return depth();
				},
				blocked: creating,
				onBlocked: () => {},
			}),
		);

		const close = () => {
			if (!creating()) stack.pop();
		};

		const create = async () => {
			if (!canCreate()) return;
			setCreating(true);
			try {
				const result = await data.directory.create({
					name: trimmedName(),
					picture: picture.file(),
				});
				if (result.imagesFailed) toast.info(IMAGES_NOT_SAVED);
				toast.success(`${result.community.name} is ready`);
				setCreating(false);
				stack.setRoot({ tab: "spaces", space: spaceKey(result.community) });
				stack.popTo(0);
			} catch (error) {
				toast.error(
					error instanceof Error && error.message
						? error.message
						: "Colibri couldn't create the Space.",
				);
			} finally {
				setCreating(false);
			}
		};

		return {
			name,
			setName,
			creating,
			imageError,
			setImageError,
			cropping,
			cropOpen,
			setCropOpen,
			picture,
			nameError,
			canCreate,
			pickIcon,
			applyIconCrop,
			close,
			create,
		};
	},
	slots: {
		Header: slot((m) => (
			<div class="flex h-12 items-center p-2">
				<IconButton
					variant="ghost"
					size="md"
					label="Close"
					icon={<CloseIcon />}
					class="[&_svg]:size-6"
					disabled={m.creating()}
					onClick={m.close}
				/>
			</div>
		)),
		Intro: slot(() => (
			<div class="flex flex-col items-center gap-2 px-12 pt-2.5 pb-6 text-center">
				<h1 class="m-0 text-xl font-bold">{CREATE_SPACE_COPY.title}</h1>
				<p class="m-0 text-sm text-balance">{CREATE_SPACE_COPY.description}</p>
			</div>
		)),
		Images: slot((m) => (
			<div class="flex w-full flex-col items-center gap-2">
				<ImageCropper
					open={m.cropOpen()}
					onOpenChange={m.setCropOpen}
					file={m.cropping()}
					shape="avatar"
					platform={usePlatform()()}
					maxBytes={PROFILE_AVATAR_MAX_BYTES}
					onApply={m.applyIconCrop}
				/>
				<ImageUploadTile
					label={m.picture.src() ? "Change Space icon" : "Upload Space icon"}
					src={m.picture.src()}
					animated={m.picture.animated()}
					accept={PROFILE_IMAGE_ACCEPT}
					maxBytes={PROFILE_CROP_INPUT_MAX_BYTES}
					showDescription={false}
					disabled={m.creating()}
					onFileChange={m.pickIcon}
					onReject={(rejection) => m.setImageError(rejection.message)}
				/>
				<Show when={m.imageError()}>
					{(message) => (
						<p role="alert" class="m-0 text-xs font-medium text-destructive">
							{message()}
						</p>
					)}
				</Show>
			</div>
		)),
		Fields: slot((m) => (
			<div class="flex w-full flex-col gap-4">
				<TextField
					label="Space name"
					placeholder="My Space"
					required
					value={m.name()}
					onChange={m.setName}
					maxLength={COMMUNITY_NAME_MAX}
					error={m.nameError()}
					disabled={m.creating()}
				/>
			</div>
		)),
		Submit: slot((m) => (
			<Button
				block
				loading={m.creating()}
				disabled={!m.canCreate()}
				onClick={() => void m.create()}
			>
				Create Space
			</Button>
		)),
	},
});
