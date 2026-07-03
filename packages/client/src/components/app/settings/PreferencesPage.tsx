import { type Component, createEffect, createSignal, on, Show } from "solid-js";
import { toast } from "somoto";
import {
	type BlueskyAlternative,
	BSKY_ALTERNATIVES,
} from "../../../atproto/bluesky-alternatives";
import { syncPresenceService } from "../../../atproto/presence";
import { endSession } from "../../../atproto/session";
import { useAuthContext } from "../../../contexts/Auth";
import { useUserContext } from "../../../contexts/User";
import { useUserPreferences } from "../../../contexts/UserPreferences";
import {
	isValidAppViewUrl,
	normalizeAppViewUrl,
	verifyColibriAppView,
} from "../../../utils/appview";
import { Alert, AlertDescription, AlertTitle } from "../../ui/Alert";
import { Button } from "../../ui/Button";
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
import {
	TextField,
	TextFieldDescription,
	TextFieldInput,
	TextFieldLabel,
} from "../../ui/TextField";
import { SettingsPage } from "../common/SettingsModal";

export const PreferencesPage: Component = () => {
	const userPreferences = useUserPreferences();
	const auth = useAuthContext();
	const user = useUserContext();
	const [appView, setAppView] = createSignal(
		userPreferences.preferences().preferredAppView,
	);
	const [saving, setSaving] = createSignal(false);

	const selectedClient = () =>
		BSKY_ALTERNATIVES.find(
			(alt) => alt.id === userPreferences.preferences().preferredBlueskyClient,
		);

	const saveAppViewAndReauth = async () => {
		if (saving()) return;

		const url = normalizeAppViewUrl(appView());
		if (!url) {
			toast.error("Please enter a valid AppView URL.");
			return;
		}

		setSaving(true);
		const toastId = toast.loading("Verifying AppView...");

		const description = await verifyColibriAppView(url);

		if (!description) {
			toast.error(
				"Couldn't reach a Colibri AppView at that URL. Double-check it and try again.",
				{ id: toastId },
			);
			setSaving(false);
			return;
		}

		userPreferences.setPreferredAppView(url);

		if (userPreferences.preferences().sharePresence) {
			try {
				await syncPresenceService(user.atproto.agent, user.did, true, url);
			} catch {}
		}

		toast.success(
			`Connected to Colibri AppView (${description.flavor}) v${description.version}.`,
			{
				id: toastId,
				description: "Signing you in again to authorise the new AppView...",
			},
		);

		try {
			await auth?.client.revoke(user.did);
		} finally {
			await endSession();
		}
	};

	createEffect(
		on(
			() => userPreferences.preferences().preferredAppView,
			(o) => setAppView(o),
			{
				defer: true,
			},
		),
	);

	const toggleSharePresence = async (enabled: boolean) => {
		userPreferences.setSharePresence(enabled);
		try {
			await syncPresenceService(user.atproto.agent, user.did, enabled);
		} catch {}
	};

	const invalidAppViewUrl = () => !isValidAppViewUrl(appView());

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
			<TextField value={appView()} onChange={setAppView}>
				<TextFieldLabel>AppView</TextFieldLabel>
				<TextFieldDescription>
					The AppView you want to connect to. The AppView is responsible for
					relaying the messages sent in communities back to your device (the
					server). Switching AppViews signs you out and back in, since each
					AppView needs its own authorisation. Please note that communities are
					tied to AppViews and cannot currently be migrated, so switching
					AppView means losing access to previously created communities until
					you switch back.{" "}
					<Show when={import.meta.env.DEV}>
						<Alert variant="info" class="my-4">
							<AlertTitle>Development Mode</AlertTitle>
							<AlertDescription>
								In development, your requests will always go to 127.0.0.1:8000.
								This check will still be made against the URL you enter.
							</AlertDescription>
						</Alert>
					</Show>
					<a
						href="https://github.com/colibri-social/appview"
						target="_blank"
						rel="noreferrer"
						class="text-primary hover:underline"
					>
						Read more about self-hosting our AppView.
					</a>
				</TextFieldDescription>
				<div class="flex flex-row items-center gap-4 w-full">
					<TextFieldInput
						minLength={1}
						type="url"
						required
						placeholder="https://api.colibri.social"
						class="w-full"
					/>
					<Button
						disabled={invalidAppViewUrl() || saving()}
						onClick={saveAppViewAndReauth}
					>
						Save & Sign in
					</Button>
				</div>
			</TextField>
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
