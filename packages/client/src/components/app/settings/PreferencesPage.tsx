import { type Component, createMemo, Show } from "solid-js";
import { toast } from "somoto";
import {
	type BlueskyAlternative,
	BSKY_ALTERNATIVES,
} from "../../../atproto/bluesky-alternatives";
import { syncPreferredBadge } from "../../../atproto/preferred-badge";
import { syncPresenceService } from "../../../atproto/presence";
import { useUserContext } from "../../../contexts/User";
import { useUserPreferences } from "../../../contexts/UserPreferences";
import { showError } from "../../../errors/show-error";
import { useExperiment } from "../../../experiments";
import { isDesktopNative } from "../../../utils/platform";
import {
	type AppTheme,
	LIGHT_MODE_EXPERIMENT,
	resolvedTheme,
} from "../../../utils/theme";
import { applyNativeDecorations } from "../../../utils/titlebar";
import { restartToApply } from "../../../utils/updater";
import { badgeText, useUserBadges } from "../../../utils/user-badges";
import {
	Select,
	SelectContent,
	SelectDescription,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "../../ui/Select";
import {
	SwitchControl,
	SwitchDescription,
	SwitchInput,
	SwitchLabel,
	SwitchThumb,
	Switch as Toggle,
} from "../../ui/Switch";
import { SettingsPage } from "../common/SettingsModal";
import { Badge } from "../user/Badge";
import { AppViewSwitcher } from "./AppViewSwitcher";

type ThemeOption = { value: AppTheme; label: string };

const THEME_OPTIONS: ThemeOption[] = [
	{ value: "dark", label: "Dark" },
	{ value: "light", label: "Light" },
];

export const PreferencesPage: Component = () => {
	const userPreferences = useUserPreferences();
	const user = useUserContext();
	const lightModeEnabled = useExperiment(LIGHT_MODE_EXPERIMENT);

	const selectedTheme = () =>
		THEME_OPTIONS.find((option) => option.value === resolvedTheme()) ??
		THEME_OPTIONS[0];

	const selectedClient = () =>
		BSKY_ALTERNATIVES.find(
			(alt) => alt.id === userPreferences.preferences().preferredBlueskyClient,
		);

	const { all: allBadges, primary: primaryBadge } = useUserBadges(() => user);

	type BadgeOption = { value: string; label: string };
	const AUTOMATIC_BADGE: BadgeOption = {
		value: "",
		label: "Automatic (highest priority)",
	};
	const badgeOptions = createMemo<BadgeOption[]>(() => [
		AUTOMATIC_BADGE,
		...allBadges().map((val) => ({ value: val, label: badgeText(val) })),
	]);
	const selectedBadge = () =>
		badgeOptions().find(
			(option) => option.value === (user.data.preferredBadge ?? ""),
		) ?? AUTOMATIC_BADGE;

	const selectPreferredBadge = async (value: string) => {
		const badge = value || undefined;
		const previous = user.data?.preferredBadge;
		user.updateActorData({ preferredBadge: badge });
		try {
			await syncPreferredBadge(user.atproto.agent, user.did, badge);
		} catch (err) {
			user.updateActorData({ preferredBadge: previous });
			showError(err, { fallbackTitle: "Couldn't save your badge." });
		}
	};

	const toggleSharePresence = async (enabled: boolean) => {
		userPreferences.setSharePresence(enabled);
		try {
			await syncPresenceService(user.atproto.agent, user.did, enabled);
		} catch (err) {
			userPreferences.setSharePresence(!enabled);
			showError(err, { fallbackTitle: "Couldn't change presence sharing." });
		}
	};

	const toggleNativeWindowDecorations = async (enabled: boolean) => {
		userPreferences.setNativeWindowDecorations(enabled);
		await applyNativeDecorations(enabled);
		toast("Window frame changed.", {
			description: "Restart Colibri if it doesn't look right.",
			action: {
				label: "Restart",
				onClick: () => {
					void restartToApply();
				},
			},
		});
	};

	return (
		<SettingsPage loading={() => false} title="Preferences">
			<Show when={lightModeEnabled()}>
				<Select
					options={THEME_OPTIONS}
					optionValue={"value" as any}
					optionTextValue={"label" as any}
					class="mb-4"
					defaultValue={selectedTheme()}
					value={selectedTheme()}
					disallowEmptySelection={true}
					itemComponent={(props) => (
						<SelectItem
							item={props.item}
							onClick={() =>
								userPreferences.setTheme(
									(props.item.rawValue as unknown as ThemeOption).value,
								)
							}
						>
							{(props.item.rawValue as unknown as ThemeOption).label}
						</SelectItem>
					)}
				>
					<SelectLabel>Appearance</SelectLabel>
					<SelectDescription>
						Follows your system until you pick one here. Light mode is
						experimental and some screens still need work.
					</SelectDescription>
					<SelectTrigger class="w-full" aria-label="Appearance">
						<SelectValue<ThemeOption>>
							{(state) => state.selectedOption()?.label}
						</SelectValue>
					</SelectTrigger>
					<SelectContent class="[&>ul]:m-0 [&>ul]:py-0 [&>ul]:px-2" />
				</Select>
			</Show>
			<Show when={allBadges().length >= 2}>
				<div class="flex flex-col gap-3 mb-4">
					<Select
						options={badgeOptions()}
						optionValue={"value" as any}
						optionTextValue={"label" as any}
						value={selectedBadge()}
						defaultValue={selectedBadge()}
						disallowEmptySelection={true}
						itemComponent={(props) => (
							<SelectItem
								item={props.item}
								class="[&>div]:flex [&>div]:gap-2 [&>div]:items-center"
								onClick={() =>
									selectPreferredBadge(
										(props.item.rawValue as unknown as BadgeOption).value,
									)
								}
							>
								<Show
									when={(props.item.rawValue as unknown as BadgeOption).value}
									fallback={
										(props.item.rawValue as unknown as BadgeOption).label
									}
								>
									{(value) => (
										<div class="pointer-events-none">
											<Badge
												text={badgeText(value())}
												size="xs"
												style={value()}
											/>
										</div>
									)}
								</Show>
							</SelectItem>
						)}
					>
						<SelectLabel>Displayed Badge</SelectLabel>
						<SelectDescription>
							Choose which of your badges shows next to your name. Everyone sees
							your choice; the rest still appear on your profile.
						</SelectDescription>
						<SelectTrigger class="w-full" aria-label="Displayed Badge">
							<SelectValue<BadgeOption>>
								{(state) => {
									const option = state.selectedOption();
									return option?.value ? (
										<div class="pointer-events-none">
											<Badge
												text={badgeText(option.value)}
												size="xs"
												style={option.value}
											/>
										</div>
									) : (
										option?.label
									);
								}}
							</SelectValue>
						</SelectTrigger>
						<SelectContent class="[&>ul]:m-0 [&>ul]:py-0 [&>ul]:px-2" />
					</Select>
					<Show when={primaryBadge()}>
						{(badge) => (
							<div class="flex flex-row items-center gap-2">
								<span class="text-muted-foreground text-sm">Preview</span>
								<Badge text={badgeText(badge())} size="xs" style={badge()} />
							</div>
						)}
					</Show>
				</div>
			</Show>
			<Select
				options={BSKY_ALTERNATIVES}
				optionValue={"id" as any}
				optionTextValue={"name" as any}
				placeholder="Bluesky"
				class="mb-4"
				defaultValue={selectedClient()}
				value={selectedClient()}
				disallowEmptySelection={true}
				itemComponent={(props) => (
					<SelectItem
						item={props.item}
						class="[&>div]:flex [&>div]:gap-2 [&>div]:items-center"
						onClick={() => {
							userPreferences.setPreferences((current) => ({
								...current,
								preferredBlueskyClient: (
									props.item.rawValue as unknown as BlueskyAlternative
								).id,
							}));
						}}
					>
						{(props.item.rawValue as unknown as BlueskyAlternative).name}
					</SelectItem>
				)}
			>
				<SelectLabel>Bluesky Client</SelectLabel>
				<SelectDescription>
					The Bluesky client you prefer using. We'll rewrite all Bluesky (& co.)
					links that appear in Colibri to this client.
				</SelectDescription>
				<SelectTrigger class="w-full" aria-label="Bluesky Client">
					<SelectValue<BlueskyAlternative>>
						{(state) => state.selectedOption()?.name}
					</SelectValue>
				</SelectTrigger>
				<SelectContent class="[&>ul]:m-0 [&>ul]:py-0 [&>ul]:px-2" />
			</Select>
			<AppViewSwitcher />
			<Toggle
				class="flex flex-row gap-4 items-center w-full justify-between shrink-0 mt-4"
				checked={userPreferences.preferences().sharePresence}
				onChange={toggleSharePresence}
			>
				<div>
					<SwitchLabel>Share presence across AppViews</SwitchLabel>
					<SwitchDescription>
						When on, your online status and typing can reach members of your
						communities who use a different AppView.
					</SwitchDescription>
				</div>
				<div>
					<SwitchInput />
					<SwitchControl>
						<SwitchThumb />
					</SwitchControl>
				</div>
			</Toggle>
			<Toggle
				class="flex flex-row gap-4 items-center w-full justify-between shrink-0 mt-4"
				checked={userPreferences.preferences().attachAccountToReports}
				onChange={userPreferences.setAttachAccountToReports}
			>
				<div>
					<SwitchLabel>Include my account in error reports</SwitchLabel>
					<SwitchDescription>
						When on, your account identifier is attached to automatic error
						reports so we can tell how many people a bug affects and follow up
						with you. Off by default, and error reports are still sent without
						it.
					</SwitchDescription>
				</div>
				<div>
					<SwitchInput />
					<SwitchControl>
						<SwitchThumb />
					</SwitchControl>
				</div>
			</Toggle>
			<Show when={isDesktopNative()}>
				<Toggle
					class="flex flex-row gap-4 items-center w-full justify-between shrink-0 mt-4"
					checked={userPreferences.preferences().nativeWindowDecorations}
					onChange={toggleNativeWindowDecorations}
				>
					<div>
						<SwitchLabel>Use system window controls</SwitchLabel>
						<SwitchDescription>
							Let your operating system draw the window frame instead of
							Colibri.
						</SwitchDescription>
					</div>
					<div>
						<SwitchInput />
						<SwitchControl>
							<SwitchThumb />
						</SwitchControl>
					</div>
				</Toggle>
			</Show>
		</SettingsPage>
	);
};
