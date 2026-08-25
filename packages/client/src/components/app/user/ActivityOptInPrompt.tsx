import { type Component, createResource, createSignal, Show } from "solid-js";
import { toast } from "somoto";
import XIcon from "~icons/ph/x";
import {
	getPreferences,
	shareActivityOf,
	writeShareActivity,
} from "../../../atproto/notificationPreference";
import { hasActivitySource } from "../../../atproto/teal-source";
import { useSettingsModalContext } from "../../../contexts/SettingsModal";
import { useUserContext } from "../../../contexts/User";
import { useUserPreferences } from "../../../contexts/UserPreferences";
import { createLogger } from "../../../utils/logger";
import { Button } from "../../ui/Button";
import { ActivityIcon } from "./ActivityCard";

const log = createLogger("activity-opt-in");

export const ActivityOptInPrompt: Component<{
	onRequestClose?: () => void;
}> = (props) => {
	const user = useUserContext();
	const settingsModal = useSettingsModalContext();
	const { preferences, setActivityPromptDismissed } = useUserPreferences();
	const [busy, setBusy] = createSignal(false);

	const [available] = createResource(
		() => (preferences().activityPromptDismissed ? false : user.did),
		(did: string) => hasActivitySource(did),
	);

	const [sharing] = createResource(async () => {
		const res = await getPreferences(user.xrpc);
		return res.ok ? shareActivityOf(res.data.preferences) : true;
	});

	const enable = async () => {
		setBusy(true);
		const res = await writeShareActivity(
			user.atproto.agent,
			user.xrpc,
			user.did,
			true,
		);
		setBusy(false);

		if (!res.ok) {
			log.error("turning on activity sharing failed", { code: res.error.code });
			toast.error("Could not turn on activity sharing.");
			return;
		}

		setActivityPromptDismissed(true);
		toast.success("Your listening status is now shared.");
	};

	return (
		<Show when={available() === true && sharing() === false}>
			<hr class="w-full h-px border-none bg-border m-0" />
			<div class="flex flex-col gap-2 px-1">
				<div class="flex flex-row items-start gap-2">
					<span class="text-purple-400 mt-0.5">
						<ActivityIcon kind="listening" />
					</span>
					<span class="text-sm leading-5 flex-1">
						teal.fm records found. Share what you're listening to?
					</span>
					<button
						type="button"
						aria-label="Dismiss"
						class="text-muted-foreground hover:text-foreground cursor-pointer mt-0.5"
						onClick={() => setActivityPromptDismissed(true)}
					>
						<XIcon />
					</button>
				</div>
				<div class="flex flex-row gap-2">
					<Button size="sm" disabled={busy()} onClick={enable}>
						Enable
					</Button>
					<Button
						size="sm"
						variant="outline"
						onClick={() => {
							props.onRequestClose?.();
							settingsModal.openPage("status");
						}}
					>
						Settings
					</Button>
				</div>
			</div>
		</Show>
	);
};
