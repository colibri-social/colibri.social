import { type Component, createSignal, Show } from "solid-js";
import { toast } from "somoto";
import {
	noteActivitySharing,
	suggestActivity,
} from "../../../atproto/activity-suggestion";
import { writeShareActivity } from "../../../atproto/notificationPreference";
import { useUserContext } from "../../../contexts/User";
import { useUserPreferences } from "../../../contexts/UserPreferences";
import { createLogger } from "../../../utils/logger";
import { Button } from "../../ui/Button";
import { TEAL_MARK_SRC } from "./teal-mark";

const log = createLogger("activity-opt-in");

const Separator: Component = () => (
	<hr class="w-full h-px border-none bg-border m-0" />
);

export const ActivityOptInPrompt: Component = () => {
	const user = useUserContext();
	const { preferences, setActivityPromptDismissed } = useUserPreferences();
	const [busy, setBusy] = createSignal(false);
	const [hidden, setHidden] = createSignal(false);

	const offer = () =>
		!hidden() && !preferences().activityPromptDismissed && suggestActivity();

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
			toast.error("Could not turn on song presence.");
			return;
		}

		noteActivitySharing(true);
		setActivityPromptDismissed(true);
		toast.success("Others can see what you're listening to now.");
	};

	const hide = () => {
		setActivityPromptDismissed(true);
		setHidden(true);
	};

	return (
		<>
			<Show when={hidden()}>
				<Separator />
				<span class="text-xs text-muted-foreground leading-4 px-1">
					You can enable this at any time via Settings &gt; Status.
				</span>
			</Show>
			<Show when={offer()}>
				<Separator />
				<div class="flex flex-col gap-2 px-1">
					<div class="flex flex-row gap-3">
						<img
							src={TEAL_MARK_SRC}
							alt="teal.fm"
							width={64}
							height={64}
							class="size-16 shrink-0 rounded-sm bg-muted object-cover"
						/>
						<div class="flex flex-col min-w-0 gap-0.5">
							<span class="text-sm font-bold leading-5">
								Enable song presence
							</span>
							<span class="text-xs text-muted-foreground leading-4">
								Let others see what you're listening to via teal.fm
							</span>
						</div>
					</div>
					<div class="flex flex-row gap-2">
						<Button size="sm" class="flex-1" disabled={busy()} onClick={enable}>
							Enable
						</Button>
						<Button size="sm" variant="outline" class="flex-1" onClick={hide}>
							Hide
						</Button>
					</div>
				</div>
			</Show>
		</>
	);
};
