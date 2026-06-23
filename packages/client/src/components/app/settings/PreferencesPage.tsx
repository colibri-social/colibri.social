import {
	type Component,
	createEffect,
	createSignal,
	onCleanup,
	onMount,
	Show,
} from "solid-js";
import { useUserPreferences } from "../../../contexts/UserPreferences";
import { useVoiceChatContext } from "../../../contexts/VoiceChat";
import {
	Select,
	SelectContent,
	SelectDescription,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "../../ui/Select";
import { SettingsPage } from "../common/SettingsModal";
import {
	BlueskyAlternative,
	BSKY_ALTERNATIVES,
} from "../../../atproto/bluesky-alternatives";

export const PreferencesPage: Component = () => {
	const userPreferences = useUserPreferences();

	const selectedClient = () =>
		BSKY_ALTERNATIVES.find(
			(alt) => alt.id === userPreferences.preferences().preferredBlueskyClient,
		);

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
		</SettingsPage>
	);
};
