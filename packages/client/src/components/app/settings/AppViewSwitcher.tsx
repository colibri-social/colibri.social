import {
	type Component,
	createEffect,
	createSignal,
	type JSX,
	on,
	Show,
	useContext,
} from "solid-js";
import { toast } from "somoto";
import { syncPresenceService } from "../../../atproto/presence";
import { endSession } from "../../../atproto/session";
import { AuthContext } from "../../../contexts/Auth";
import { useUserPreferences } from "../../../contexts/UserPreferences";
import {
	isValidAppViewUrl,
	normalizeAppViewUrl,
	verifyColibriAppView,
} from "../../../utils/appview";
import { Alert, AlertDescription, AlertTitle } from "../../ui/Alert";
import { Button } from "../../ui/Button";
import {
	TextField,
	TextFieldDescription,
	TextFieldInput,
	TextFieldLabel,
} from "../../ui/TextField";

const DefaultDescription = () => (
	<>
		The AppView you want to connect to. The AppView is responsible for relaying
		the messages sent in communities back to your device (the server). Switching
		AppViews signs you out and back in, since each AppView needs its own
		authorisation. Please note that communities are tied to AppViews and cannot
		currently be migrated, so switching AppView means losing access to
		previously created communities until you switch back.{" "}
		<Show when={import.meta.env.DEV}>
			<Alert variant="info" class="my-4">
				<AlertTitle>Development Mode</AlertTitle>
				<AlertDescription>
					In development, your requests will always go to 127.0.0.1:8000. This
					check will still be made against the URL you enter.
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
	</>
);

export const AppViewSwitcher: Component<{
	description?: JSX.Element;
	buttonLabel?: string;
}> = (props) => {
	const userPreferences = useUserPreferences();
	const auth = useContext(AuthContext);
	const [appView, setAppView] = createSignal(
		userPreferences.preferences().preferredAppView,
	);
	const [saving, setSaving] = createSignal(false);

	const agent = () => (auth?.loggedIn ? auth.agent : undefined);

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

		const currentAgent = agent();
		const did = currentAgent?.did;
		if (userPreferences.preferences().sharePresence && currentAgent && did) {
			try {
				await syncPresenceService(currentAgent, did, true, url);
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
			if (auth?.loggedIn && did) await auth.client.revoke(did);
		} finally {
			await endSession();
		}
	};

	createEffect(
		on(
			() => userPreferences.preferences().preferredAppView,
			(o) => setAppView(o),
			{ defer: true },
		),
	);

	const invalidAppViewUrl = () => !isValidAppViewUrl(appView());

	return (
		<TextField value={appView()} onChange={setAppView}>
			<TextFieldLabel>AppView</TextFieldLabel>
			<TextFieldDescription>
				{props.description ?? <DefaultDescription />}
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
					{props.buttonLabel ?? "Save & Sign in"}
				</Button>
			</div>
		</TextField>
	);
};
