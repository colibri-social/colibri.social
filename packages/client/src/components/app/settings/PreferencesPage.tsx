import type { Component } from "solid-js";
import {
	type BlueskyAlternative,
	BSKY_ALTERNATIVES,
} from "../../../atproto/bluesky-alternatives";
import { syncPresenceService } from "../../../atproto/presence";
import { useUserContext } from "../../../contexts/User";
import { useUserPreferences } from "../../../contexts/UserPreferences";
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
import { AppViewSwitcher } from "./AppViewSwitcher";

export const PreferencesPage: Component = () => {
	const userPreferences = useUserPreferences();
	const user = useUserContext();

	const selectedClient = () =>
		BSKY_ALTERNATIVES.find(
			(alt) => alt.id === userPreferences.preferences().preferredBlueskyClient,
		);

	const toggleSharePresence = async (enabled: boolean) => {
		userPreferences.setSharePresence(enabled);
		try {
			await syncPresenceService(user.atproto.agent, user.did, enabled);
		} catch {}
	};

	return (
		<SettingsPage loading={() => false} title="Preferences">
			<Select
				options={BSKY_ALTERNATIVES}
				optionValue={"id" as any}
				optionTextValue={"name" as any}
				placeholder="Bluesky"
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
				class="flex flex-row gap-4 items-center w-full justify-between shrink-0"
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
		</SettingsPage>
	);
};
