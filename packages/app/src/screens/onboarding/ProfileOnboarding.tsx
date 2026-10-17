import { type ColibriError, classifyThrown } from "@colibri-social/lib";
import {
	createOnboarding,
	defaultAvatarFor,
	defaultAvatarUrl,
	EntranceText,
	NotificationsScreen,
	ONBOARDING_DOT_COUNT,
	OnboardingActions,
	OnboardingFlow,
	type OnboardingPlatform,
	type OnboardingResult,
	type OnboardingStep,
	ProfileEditorScreen,
	type ProfileSetupSource,
	ProfileSourceScreen,
	profileSetupOptions,
	renderDefaultAvatar,
	Spinner,
	WelcomeScreen,
} from "@colibri-social/ui";
import {
	createEffect,
	createMemo,
	createSignal,
	Match,
	on,
	onCleanup,
	Show,
	Switch,
} from "solid-js";
import { useAccountActions } from "../../auth/account-actions";
import { describeError } from "../../data/error-copy";
import { themeColorsOf, themeFrom } from "../../data/profile-theme";
import type { ProfileSeed, ProfileSetup } from "../../data/source";
import type { DataStore } from "../../data/store";
import { deviceNotifications } from "../../native/notifications/device";

const TITLES: Record<OnboardingStep, string> = {
	welcome: "Welcome to Colibri Social",
	"sign-in": "Sign in",
	"create-account": "Create an account",
	"profile-source": "Set up your profile",
	"profile-editor": "Set up your profile",
	notifications: "Notifications",
};

const titleClass =
	"m-0 w-full text-center text-4xl leading-tight font-extrabold text-balance";
const descriptionClass =
	"m-0 w-full text-center text-base font-medium text-balance text-muted-foreground";

const asFile = (blob: Blob | undefined, name: string) =>
	blob instanceof File || !blob
		? blob
		: new File([blob], name, { type: blob.type });

type Saving =
	| { kind: "editing" }
	| { kind: "saving" }
	| { kind: "failed"; error: ColibriError; result: OnboardingResult };

export type ProfileOnboardingProps = {
	store: DataStore;
	setup: Extract<ProfileSetup, { complete: false }>;
	platform: OnboardingPlatform;
	onDone: () => void;
};

export const ProfileOnboarding = (props: ProfileOnboardingProps) => {
	const account = useAccountActions();
	const records = () => ({
		colibriProfile: !!props.setup.colibri,
		blueskyProfile: !!props.setup.bluesky,
	});
	const [displayName, setDisplayName] = createSignal("");
	const [nameColor, setNameColor] = createSignal<string>();
	const [pronouns, setPronouns] = createSignal("");
	const [bio, setBio] = createSignal("");
	const [themeColors, setThemeColors] = createSignal(themeColorsOf(undefined));
	const [avatar, setAvatar] = createSignal<Blob>();
	const [banner, setBanner] = createSignal<Blob>();
	const [sync, setSync] = createSignal(false);
	const [saving, setSaving] = createSignal<Saving>({ kind: "editing" });

	const fallbackAvatar = () =>
		defaultAvatarUrl(defaultAvatarFor(props.store.viewer.did));

	const seedFor = (source: ProfileSetupSource): ProfileSeed =>
		source === "existing"
			? (props.setup.colibri ?? {})
			: source === "bluesky"
				? (props.setup.bluesky ?? {})
				: {};

	const fill = (source: ProfileSetupSource) => {
		const seed = seedFor(source);
		setDisplayName(seed.displayName ?? "");
		setNameColor(seed.theme?.accentColor);
		setPronouns(seed.pronouns ?? "");
		setBio(seed.description ?? "");
		setThemeColors(themeColorsOf(seed.theme));
		setAvatar(seed.avatar);
		setBanner(seed.banner);
		setSync(source === "bluesky");
	};

	const save = async (result: OnboardingResult) => {
		deviceNotifications().dismissPrompt();
		setSaving({ kind: "saving" });
		try {
			const profile = result.profile;
			const synced = result.source === "bluesky" && sync();
			const avatarFile =
				synced || avatar()
					? asFile(avatar(), "avatar")
					: asFile(
							await renderDefaultAvatar(
								defaultAvatarFor(props.store.viewer.did),
							),
							"avatar.png",
						);
			await props.store.saveProfile({
				displayName: profile?.displayName ?? displayName(),
				description: profile?.bio ?? "",
				pronouns: profile?.pronouns ?? "",
				avatar: avatarFile,
				banner: asFile(banner(), "banner") ?? null,
				syncBluesky: synced,
				theme: themeFrom(
					profile?.nameColor ?? nameColor(),
					profile?.themeColors ?? themeColors(),
				),
			});
			props.onDone();
		} catch (thrown) {
			setSaving({
				kind: "failed",
				error: classifyThrown(thrown, { method: "profile.put" }),
				result,
			});
		}
	};

	const onboarding = createOnboarding({
		records,
		start: "welcome",
		onComplete: (result) => void save(result),
	});

	createEffect(on(onboarding.source, fill));

	const back = () => {
		if (onboarding.canGoBack()) return onboarding.back;
		if (onboarding.step() === "welcome") return undefined;
		return () => onboarding.goTo("welcome");
	};

	const avatarSrc = createMemo(() => {
		const blob = avatar();
		if (!blob) return fallbackAvatar();
		const url = URL.createObjectURL(blob);
		onCleanup(() => URL.revokeObjectURL(url));
		return url;
	});

	const bannerSrc = createMemo(() => {
		const blob = banner();
		if (!blob) return undefined;
		const url = URL.createObjectURL(blob);
		onCleanup(() => URL.revokeObjectURL(url));
		return url;
	});

	return (
		<Switch>
			<Match when={saving().kind === "saving"}>
				<OnboardingFlow platform={props.platform} title="Saving your profile">
					<div
						data-onboarding-screen="saving-profile"
						role="status"
						class="flex w-full flex-col items-center gap-6"
					>
						<Spinner size={32} label="Saving your profile" />
						<EntranceText
							as="h1"
							group={0}
							class={titleClass}
							lines="Saving your profile"
						/>
					</div>
				</OnboardingFlow>
			</Match>
			<Match
				when={(() => {
					const current = saving();
					return current.kind === "failed" ? current : undefined;
				})()}
			>
				{(failed) => {
					const copy = () => describeError(failed().error);
					return (
						<OnboardingFlow platform={props.platform} title={copy().title}>
							<div
								data-onboarding-screen="profile-failed"
								class="flex w-full flex-col items-center gap-4"
							>
								<EntranceText
									as="h1"
									group={0}
									class={titleClass}
									lines={copy().title}
								/>
								<Show when={copy().description}>
									{(description) => (
										<EntranceText
											group={1}
											class={descriptionClass}
											lines={description()}
										/>
									)}
								</Show>
								<OnboardingActions
									group={2}
									inline="grid"
									secondary={
										account
											? {
													label: "Sign out",
													onClick: () => void account.signOut(),
												}
											: undefined
									}
									primary={{
										label: "Try again",
										onClick: () => void save(failed().result),
									}}
								/>
							</div>
						</OnboardingFlow>
					);
				}}
			</Match>
			<Match when={saving().kind === "editing"}>
				<OnboardingFlow
					platform={props.platform}
					title={TITLES[onboarding.step()]}
					dot={onboarding.dot()}
					dotCount={ONBOARDING_DOT_COUNT}
					steps={onboarding.items()}
					onStepSelect={onboarding.goTo}
					onBack={back()}
				>
					<Switch>
						<Match when={onboarding.step() === "welcome"}>
							<WelcomeScreen onStart={onboarding.signedIn} />
						</Match>
						<Match when={onboarding.step() === "profile-source"}>
							<ProfileSourceScreen
								options={profileSetupOptions(records())}
								value={onboarding.source()}
								onChange={onboarding.setSource}
								onNext={onboarding.next}
							/>
						</Match>
						<Match when={onboarding.step() === "profile-editor"}>
							<ProfileEditorScreen
								platform={props.platform}
								handle={props.store.viewer.handle}
								displayName={displayName()}
								onDisplayNameChange={setDisplayName}
								nameColor={nameColor()}
								onNameColorChange={setNameColor}
								pronouns={pronouns()}
								onPronounsChange={setPronouns}
								bio={bio()}
								onBioChange={setBio}
								themeColors={themeColors()}
								onThemeColorsChange={setThemeColors}
								avatarSrc={avatarSrc()}
								onAvatarFile={setAvatar}
								bannerSrc={bannerSrc()}
								onBannerFile={setBanner}
								onBannerRemove={() => setBanner(undefined)}
								syncWithBluesky={sync()}
								onSyncWithBlueskyChange={
									onboarding.source() === "bluesky" ? setSync : undefined
								}
								onBack={back()}
								onNext={onboarding.saveProfile}
							/>
						</Match>
						<Match when={onboarding.step() === "notifications"}>
							<NotificationsScreen
								requestPermission={() => deviceNotifications().request()}
								onDone={onboarding.finish}
							/>
						</Match>
					</Switch>
				</OnboardingFlow>
			</Match>
		</Switch>
	);
};
