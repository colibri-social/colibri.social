import {
	Button,
	type HostingMode,
	HostingPicker,
	HostSetup,
	type HostSetupError,
	type HostSetupStep,
	hostingSubmitLabel,
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
import { isNativeShell } from "../../auth/native";
import { describeError } from "../../data/error-copy";
import { HostSignInError, prepareExternalTab } from "../../data/hosting";
import { spaceKey } from "../../data/ids";
import { COMMUNITY_NAME_MAX } from "../../data/source";
import {
	type CreateSpaceResult,
	IMAGES_NOT_SAVED,
} from "../../data/space-directory";
import { useData } from "../../data/store";
import { openExternalUrl } from "../../native/open-external";
import { defineContract, slot } from "../../screen/define";
import { usePlatform } from "../../screen/platform";
import { useStack } from "../../shell/stack";
import { useUnsavedChanges } from "../../shell/unsaved-changes";

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
		const [hosting, setHosting] = createSignal<HostingMode>("colibri");
		const [account, setAccount] = createSignal("");
		const [accountError, setAccountError] = createSignal<string>();
		const [setupStep, setSetupStep] = createSignal<HostSetupStep>();
		const [setupError, setSetupError] = createSignal<HostSetupError>();
		const [signedInAs, setSignedInAs] = createSignal<string>();
		const [signInUrl, setSignInUrl] = createSignal<string>();
		const picture = createPreview();
		let waiting: AbortController | undefined;
		onCleanup(() => waiting?.abort());

		const trimmedName = () => name().trim();
		const trimmedAccount = () => account().trim().replace(/^@/, "");
		const nameError = () =>
			name().length > 0 && trimmedName().length === 0
				? "Enter a name for your Space."
				: trimmedName().length > COMMUNITY_NAME_MAX
					? `Use ${COMMUNITY_NAME_MAX} characters or fewer.`
					: undefined;
		const canCreate = () =>
			trimmedName().length > 0 && !nameError() && !creating();
		const settingUp = () => !!setupStep() || !!setupError();

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
				blocked: () => creating() && !setupStep(),
				onBlocked: () => {},
			}),
		);
		let created = false;
		useUnsavedChanges({
			depth,
			dirty: () =>
				!created &&
				!creating() &&
				(trimmedName().length > 0 || !!picture.file()),
			description: () => "This Space won't be created.",
		});

		const close = () => {
			if (creating() && !setupStep()) return;
			waiting?.abort();
			stack.pop();
		};

		const backToForm = () => {
			waiting?.abort();
			waiting = undefined;
			setSetupStep(undefined);
			setSetupError(undefined);
			setSignedInAs(undefined);
			setCreating(false);
		};

		const changeHosting = (mode: HostingMode) => {
			setHosting(mode);
			setAccountError(undefined);
		};

		const finish = (result: CreateSpaceResult) => {
			if (result.imagesFailed) toast.info(IMAGES_NOT_SAVED);
			toast.success(`${result.community.name} is ready`);
			setCreating(false);
			created = true;
			stack.setRoot({
				tab: "spaces",
				space: spaceKey(result.community),
			});
			stack.popTo(0);
		};

		const createOnColibri = async () => {
			setCreating(true);
			try {
				finish(
					await data.directory.create({
						name: trimmedName(),
						picture: picture.file(),
					}),
				);
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

		const createOnOwnAccount = async () => {
			if (!trimmedAccount()) {
				setAccountError("Enter the account you want to use.");
				return;
			}
			setAccountError(undefined);
			const tab = prepareExternalTab(openExternalUrl, isNativeShell());
			waiting?.abort();
			const controller = new AbortController();
			waiting = controller;
			setSetupError(undefined);
			setSignedInAs(undefined);
			setSetupStep("signIn");
			setCreating(true);
			try {
				const result = await data.directory.create({
					name: trimmedName(),
					picture: picture.file(),
					host: {
						identifier: trimmedAccount(),
						signal: controller.signal,
						open: (url) => {
							setSignInUrl(url);
							tab.go(url);
						},
						onSignedIn: () => setSetupStep("creating"),
					},
				});
				if (controller.signal.aborted) return;
				setSetupStep("done");
				finish(result);
			} catch (error) {
				if (controller.signal.aborted) return;
				tab.close();
				if (error instanceof HostSignInError) {
					setSetupStep(undefined);
					setSetupError(error.failure);
					setSignedInAs(error.signedInAs);
					return;
				}
				backToForm();
				toast.error(describeError(error).title);
			} finally {
				if (waiting === controller) setCreating(false);
			}
		};

		const create = async () => {
			if (!canCreate()) return;
			if (hosting() === "own") {
				await createOnOwnAccount();
				return;
			}
			await createOnColibri();
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
			hosting,
			changeHosting,
			account,
			setAccount,
			accountError,
			settingUp,
			setupStep,
			setupError,
			signedInAs,
			trimmedAccount,
			reopenSignIn: () => {
				const url = signInUrl();
				if (url) openExternalUrl(url);
			},
			backToForm,
			useColibri: () => {
				backToForm();
				changeHosting("colibri");
			},
			useAnotherAccount: () => {
				backToForm();
				setAccount("");
			},
			retry: () => void createOnOwnAccount(),
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
					disabled={m.creating() && !m.settingUp()}
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
				<HostingPicker
					mode={m.hosting()}
					onModeChange={m.changeHosting}
					account={m.account()}
					onAccountChange={m.setAccount}
					accountError={m.accountError()}
					disabled={m.creating()}
					platform={usePlatform()()}
				/>
			</div>
		)),
		Setup: slot((m) => (
			<HostSetup
				spaceName={m.name().trim()}
				account={m.trimmedAccount()}
				step={m.setupStep()}
				error={m.setupError()}
				signedInAs={m.signedInAs()}
				onReopenSignIn={m.reopenSignIn}
				onBack={m.backToForm}
				onRetry={m.retry}
				onUseColibri={m.useColibri}
				onUseAnotherAccount={m.useAnotherAccount}
			/>
		)),
		Submit: slot((m) => (
			<Button
				block
				loading={m.creating()}
				disabled={!m.canCreate()}
				onClick={() => void m.create()}
			>
				{hostingSubmitLabel(m.hosting())}
			</Button>
		)),
	},
});
