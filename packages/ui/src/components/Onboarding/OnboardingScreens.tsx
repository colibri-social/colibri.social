import { BellIcon } from "@solar-icons/solid/bold/bell";
import { GalleryAddIcon } from "@solar-icons/solid/bold/gallery-add";
import { GalleryRemoveIcon } from "@solar-icons/solid/bold/gallery-remove";
import { createSignal, createUniqueId, type JSX, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { createLocalPreview } from "../../utils/local-preview";
import { AnimatedImage } from "../AnimatedImage/AnimatedImage";
import { ThemeColorPicker } from "../ColorPicker/ColorPicker";
import { Hummingbird } from "../Hummingbird/Hummingbird";
import { ToggleRow } from "../List/List";
import { DisplayNameField } from "../Profile/DisplayNameField";
import { TextArea, TextField } from "../TextField/TextField";
import type { OnboardingProfile } from "./create-onboarding";
import { Entrance, EntranceText } from "./Entrance";
import { HandleField, type HandleSuggestion } from "./HandleField";
import { validateImageFile } from "./ImageUploadTile";
import { OnboardingActions, useOnboardingChrome } from "./OnboardingChrome";
import {
	type ProfileSetupOption,
	ProfileSetupPicker,
	type ProfileSetupSource,
} from "./ProfileSetupPicker";

export const ATMOSPHERE_ACCOUNT_URL = "https://atmosphereaccount.com/";
export const PROFILE_IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
export const PROFILE_AVATAR_MAX_BYTES = 1_000_000;
export const PROFILE_BANNER_MAX_BYTES = 1_000_000;

const titleClass =
	"m-0 w-full text-center text-4xl leading-tight font-extrabold text-balance";
const descriptionClass =
	"m-0 w-full text-center text-base font-medium text-balance text-muted-foreground";

export type WelcomeScreenProps = {
	onStart: () => void;
};

export const WelcomeScreen = (props: WelcomeScreenProps) => {
	const chrome = useOnboardingChrome();
	return (
		<div
			data-onboarding-screen="welcome"
			class="flex flex-col items-center gap-8"
		>
			<Show when={chrome.variant() !== "split"}>
				<Entrance group={0}>
					<Hummingbird size={128} dart poke dartRange={{ x: 72, y: 40 }} />
				</Entrance>
			</Show>
			<EntranceText
				as="h1"
				group={1}
				class="m-0 text-center text-5xl leading-none text-foreground"
				lines={[
					{ text: "Welcome to", class: "font-sans font-extrabold" },
					{ text: "Colibri Social", class: "pt-1 font-display font-normal" },
				]}
			/>
			<EntranceText
				group={3}
				class="m-0 text-center text-xl font-semibold"
				lines="Let's get you started."
			/>
			<OnboardingActions
				group={4}
				primary={{ label: "Start setup", onClick: () => props.onStart() }}
			/>
		</div>
	);
};

export type SignInScreenProps = {
	onHandleChange?: (handle: string) => void;
	onHandleQuery?: (query: string) => void;
	handleSuggestions?: readonly HandleSuggestion[];
	onSignIn: (handle: string, account?: HandleSuggestion) => void;
	onCreateAccount: () => void;
	error?: JSX.Element;
	loading?: boolean;
};

export const SignInScreen = (props: SignInScreenProps) => {
	const [handle, setHandle] = createSignal("");
	const formId = createUniqueId();
	const submit = (event: SubmitEvent) => {
		event.preventDefault();
		const value = handle().trim().replace(/^@/, "");
		if (value) props.onSignIn(value);
	};

	return (
		<form
			id={formId}
			data-onboarding-screen="sign-in"
			onSubmit={submit}
			class="flex w-full flex-col items-center gap-4"
		>
			<EntranceText
				as="h1"
				group={0}
				class={titleClass}
				lines="Sign in with your existing account"
			/>
			<EntranceText
				group={1}
				class={descriptionClass}
				lines="Sign in with the Atmosphere account you already have, for example your Bluesky, Semble or Tangled account."
			/>
			<Entrance group={2} class="w-full">
				<HandleField
					label="Handle or username"
					placeholder="alice.bsky.social"
					suggestions={props.handleSuggestions}
					onQuery={props.onHandleQuery}
					onInput={(value) => {
						setHandle(value);
						props.onHandleChange?.(value);
					}}
					onAccept={(account) => props.onSignIn(account.handle, account)}
					error={props.error}
				/>
			</Entrance>
			<OnboardingActions
				group={3}
				inline="grid"
				secondary={{
					label: "Create account",
					onClick: () => props.onCreateAccount(),
				}}
				primary={{
					label: "Log in",
					type: "submit",
					form: formId,
					loading: props.loading,
					disabled: !handle().trim(),
				}}
			/>
		</form>
	);
};

export type CreateAccountScreenProps = {
	onBack: () => void;
	onOpenBrowser: () => void;
};

export const CreateAccountScreen = (props: CreateAccountScreenProps) => (
	<div
		data-onboarding-screen="create-account"
		class="flex w-full flex-col items-center gap-4 px-2"
	>
		<EntranceText
			as="h1"
			group={0}
			class={titleClass}
			lines="Create an account on colibri.social"
		/>
		<EntranceText
			group={1}
			class={descriptionClass}
			lines="We'll redirect you to colibri.social where you can sign up for an Atmosphere account."
		/>
		<OnboardingActions
			group={2}
			inline="grid"
			back={{ label: "Back", onClick: () => props.onBack() }}
			primary={{ label: "Open browser", onClick: () => props.onOpenBrowser() }}
		/>
		<Entrance group={4}>
			<a
				href={ATMOSPHERE_ACCOUNT_URL}
				target="_blank"
				rel="noopener noreferrer"
				class="focus-ring rounded-control-xs text-base font-medium text-primary-highlight underline-offset-4 hover:underline"
			>
				What is an Atmosphere account?
			</a>
		</Entrance>
	</div>
);

export type ProfileSourceScreenProps = {
	options: ProfileSetupOption[];
	value?: ProfileSetupSource;
	onChange: (value: ProfileSetupSource) => void;
	onNext: () => void;
};

export const ProfileSourceScreen = (props: ProfileSourceScreenProps) => {
	return (
		<div
			data-onboarding-screen="profile-source"
			class="flex w-full flex-col items-center gap-8"
		>
			<EntranceText
				as="h1"
				group={0}
				class={titleClass}
				lines={["Let's get your", "profile going."]}
			/>
			<Entrance group={2} class="w-full">
				<ProfileSetupPicker
					options={props.options}
					value={props.value}
					onChange={props.onChange}
					class="w-full"
				/>
			</Entrance>
			<OnboardingActions
				group={3}
				primary={{ label: "Next", onClick: () => props.onNext() }}
			/>
		</div>
	);
};

type ImagePickerProps = {
	maxBytes: number;
	onFile?: (file: File) => void;
	onError: (message: string | undefined) => void;
	children: (open: () => void) => JSX.Element;
};

const ImagePicker = (props: ImagePickerProps) => {
	let input: HTMLInputElement | undefined;
	const pick = async (file: File | undefined) => {
		if (!file) return;
		const rejection = await validateImageFile(
			file,
			PROFILE_IMAGE_ACCEPT,
			props.maxBytes,
		);
		props.onError(rejection?.message);
		if (!rejection) props.onFile?.(file);
	};
	return (
		<>
			<input
				ref={input}
				type="file"
				accept={PROFILE_IMAGE_ACCEPT}
				class="sr-only"
				tabIndex={-1}
				aria-hidden="true"
				onChange={(event) => {
					void pick(event.currentTarget.files?.[0]);
					event.currentTarget.value = "";
				}}
			/>
			{props.children(() => input?.click())}
		</>
	);
};

export type ProfileEditorScreenProps = {
	handle?: string;
	displayName?: string;
	onDisplayNameChange?: (value: string) => void;
	nameColor?: string;
	onNameColorChange?: (color: string) => void;
	pronouns?: string;
	onPronounsChange?: (value: string) => void;
	bio?: string;
	onBioChange?: (value: string) => void;
	themeColors: string[];
	onThemeColorsChange: (colors: string[]) => void;
	avatarSrc?: string;
	onAvatarFile?: (file: File) => void;
	bannerSrc?: string;
	onBannerFile?: (file: File) => void;
	onBannerRemove?: () => void;
	syncWithBluesky?: boolean;
	onSyncWithBlueskyChange?: (sync: boolean) => void;
	platform?: "desktop" | "mobile";
	onBack?: () => void;
	onNext: (profile: OnboardingProfile) => void;
};

export const resolveDisplayName = (displayName?: string, handle?: string) =>
	displayName?.trim() || handle?.trim().replace(/^@/, "") || "";

export const ProfileEditorScreen = (props: ProfileEditorScreenProps) => {
	const [imageError, setImageError] = createSignal<string>();
	const errorId = createUniqueId();
	const formId = createUniqueId();
	const chrome = useOnboardingChrome();
	const docked = () => chrome.variant() !== "mobile";
	const avatar = createLocalPreview(() => props.avatarSrc);
	const banner = createLocalPreview(() => props.bannerSrc);
	const bannerRemovable = () =>
		Boolean(banner.src()) && (props.onBannerRemove || !props.bannerSrc);

	const submit = (event: SubmitEvent) => {
		event.preventDefault();
		props.onNext({
			displayName: resolveDisplayName(props.displayName, props.handle),
			nameColor: props.nameColor,
			pronouns: props.pronouns?.trim() || undefined,
			bio: props.bio?.trim() || undefined,
			themeColors: props.themeColors,
		});
	};

	return (
		<form
			id={formId}
			data-onboarding-screen="profile-editor"
			onSubmit={submit}
			class="flex w-full flex-col items-center gap-6"
		>
			<h1 class="sr-only">Set up your profile</h1>
			<Entrance group={0} class="w-full">
				<div
					data-profile-editor-card=""
					class="relative w-full overflow-hidden rounded-sheet border border-border bg-popover shadow-overlay"
				>
					<ImagePicker
						maxBytes={PROFILE_BANNER_MAX_BYTES}
						onFile={(file) => {
							banner.set(file);
							props.onBannerFile?.(file);
						}}
						onError={setImageError}
					>
						{(open) => (
							<div class="relative h-[118px] w-full">
								<button
									type="button"
									aria-label={banner.src() ? "Change banner" : "Add banner"}
									aria-describedby={imageError() ? errorId : undefined}
									onClick={open}
									class="focus-ring-inset flex size-full cursor-pointer items-center justify-center bg-secondary text-muted-foreground hover:text-foreground"
								>
									<Show
										when={banner.src()}
										fallback={<GalleryAddIcon class="size-6" />}
									>
										{(src) => (
											<AnimatedImage
												data-profile-banner-preview=""
												animated={banner.animated()}
												src={src()}
												alt=""
												class="absolute inset-0 size-full object-cover"
											/>
										)}
									</Show>
								</button>
								<Show when={bannerRemovable()}>
									<button
										type="button"
										aria-label="Remove banner"
										onClick={() => {
											banner.clear();
											props.onBannerRemove?.();
										}}
										class="focus-ring absolute top-4 right-4 flex size-6 cursor-pointer items-center justify-center rounded-control-xs text-white drop-shadow-[0_1px_2px_rgb(0_0_0/0.6)]"
									>
										<GalleryRemoveIcon class="size-6" />
									</button>
								</Show>
							</div>
						)}
					</ImagePicker>
					<ImagePicker
						maxBytes={PROFILE_AVATAR_MAX_BYTES}
						onFile={(file) => {
							avatar.set(file);
							props.onAvatarFile?.(file);
						}}
						onError={setImageError}
					>
						{(open) => (
							<button
								type="button"
								aria-label={avatar.src() ? "Change picture" : "Add picture"}
								aria-describedby={imageError() ? errorId : undefined}
								onClick={open}
								class="focus-ring absolute top-[81px] left-[11px] flex size-[72px] cursor-pointer items-center justify-center overflow-hidden rounded-full border-4 border-popover bg-muted text-muted-foreground"
							>
								<Show
									when={avatar.src()}
									fallback={<GalleryAddIcon class="size-6" />}
								>
									{(src) => (
										<AnimatedImage
											data-profile-avatar-preview=""
											animated={avatar.animated()}
											src={src()}
											alt=""
											class="size-full object-cover"
										/>
									)}
								</Show>
							</button>
						)}
					</ImagePicker>
					<div class="flex flex-col gap-4 px-4 pt-[44px] pb-4">
						<div
							data-profile-name-row=""
							class={cx(
								"flex gap-4",
								docked() ? "flex-row items-start" : "flex-col",
							)}
						>
							<DisplayNameField
								label="Display name"
								value={props.displayName}
								onChange={props.onDisplayNameChange}
								nameColor={props.nameColor}
								onNameColorChange={props.onNameColorChange}
								platform={props.platform}
								placeholder={props.handle ?? "username.handle"}
								class={docked() ? "min-w-0 flex-[2]" : undefined}
							/>
							<TextField
								label="Pronouns"
								placeholder="they/them"
								value={props.pronouns}
								onChange={props.onPronounsChange}
								maxLength={20}
								class={docked() ? "min-w-0 flex-1" : undefined}
							/>
						</div>
						<TextArea
							label="Bio"
							rows={4}
							value={props.bio}
							onChange={props.onBioChange}
							maxLength={256}
						/>
						<div class="flex flex-col gap-2">
							<span class="text-sm font-medium text-muted-foreground">
								Theme colors
							</span>
							<ThemeColorPicker
								colors={props.themeColors}
								onChange={props.onThemeColorsChange}
								platform={props.platform}
							/>
						</div>
					</div>
				</div>
			</Entrance>
			<Show when={imageError()}>
				<p
					id={errorId}
					role="alert"
					class="m-0 -mt-3 w-full text-center text-sm font-medium text-destructive"
				>
					{imageError()}
				</p>
			</Show>
			<Show when={props.onSyncWithBlueskyChange}>
				<Entrance group={1} class="w-full">
					<div class="w-full overflow-hidden rounded-control-lg bg-popover">
						<ToggleRow
							title="Stay in sync with Bluesky?"
							description="Updates to your Bluesky profile will be mirrored to your Colibri profile."
							checked={props.syncWithBluesky}
							onChange={(sync) => props.onSyncWithBlueskyChange?.(sync)}
						/>
					</div>
				</Entrance>
			</Show>
			<OnboardingActions
				group={2}
				back={
					props.onBack
						? { label: "Back", onClick: () => props.onBack?.() }
						: undefined
				}
				primary={{ label: "Next", type: "submit", form: formId }}
			/>
		</form>
	);
};

export type NotificationPermissionResult =
	| NotificationPermission
	| "unsupported"
	| "skipped";

export const requestBrowserNotificationPermission =
	async (): Promise<NotificationPermissionResult> => {
		if (typeof Notification === "undefined") return "unsupported";
		try {
			return await Notification.requestPermission();
		} catch {
			return "denied";
		}
	};

export type NotificationsScreenProps = {
	requestPermission?: () => Promise<NotificationPermissionResult>;
	onDone: (result: NotificationPermissionResult) => void;
};

export const NotificationsScreen = (props: NotificationsScreenProps) => {
	const [asking, setAsking] = createSignal(false);
	const enable = async () => {
		if (asking()) return;
		setAsking(true);
		let result: NotificationPermissionResult = "denied";
		try {
			result = await (
				props.requestPermission ?? requestBrowserNotificationPermission
			)();
		} catch {
			result = "denied";
		}
		setAsking(false);
		props.onDone(result);
	};

	return (
		<div
			data-onboarding-screen="notifications"
			class="flex w-full flex-col items-center gap-8"
		>
			<EntranceText
				as="h1"
				group={0}
				class={titleClass}
				lines="Want to receive notifications?"
			/>
			<OnboardingActions
				group={2}
				secondary={{ label: "Skip", onClick: () => props.onDone("skipped") }}
				primary={{
					label: "Enable notifications",
					icon: <BellIcon />,
					loading: asking(),
					onClick: () => void enable(),
				}}
			/>
		</div>
	);
};
