import {
	type Component,
	createEffect,
	createSignal,
	onCleanup,
	onMount,
} from "solid-js";
import { toast } from "somoto";
import { useUserContext } from "../../../contexts/User";
import { useUserPreferences } from "../../../contexts/UserPreferences";
import {
	enablePushNotifications,
	getBackend,
	isWebRuntime,
} from "../../../notifications";
import { isPushSupported } from "../../../notifications/push-web";
import { claimBlockingDialog } from "../../../utils/blocking-dialog";
import { createLogger } from "../../../utils/logger";
import { Button } from "../../ui/Button";
import { ResponsiveDialog } from "../../ui/ResponsiveDialog";

const log = createLogger("notif/prompt");

export const NotificationPromptDialog: Component = () => {
	const user = useUserContext();
	const {
		preferences,
		setNativeNotifications,
		setNotificationPromptDismissed,
	} = useUserPreferences();
	const [open, setOpen] = createSignal(false);
	const [busy, setBusy] = createSignal(false);

	onMount(() => {
		void (async () => {
			if (!isWebRuntime()) return;
			if (preferences().notificationPromptDismissed) return;
			if (preferences().nativeNotifications) return;
			if (!isPushSupported()) return;
			if ((await getBackend().getPermission()) !== "default") {
				setNotificationPromptDismissed(true);
				return;
			}
			setOpen(true);
		})();
	});

	createEffect(() => {
		if (!open()) return;
		onCleanup(claimBlockingDialog());
	});

	const dismiss = () => {
		setNotificationPromptDismissed(true);
		setOpen(false);
	};

	const handleEnable = async () => {
		if (busy()) return;
		setBusy(true);
		try {
			const permission = await enablePushNotifications(
				(sub) => user.xrpc.social.colibri.notification.registerPush(sub),
				(endpoint, provider) =>
					user.xrpc.social.colibri.notification.unregisterPush(
						endpoint,
						provider,
					),
			);
			if (permission === "granted") {
				setNativeNotifications(true);
			} else {
				toast.error("Notification permission was not granted.");
			}
		} catch (err) {
			log.error("enabling notifications failed", { error: err });
			toast.error("Failed to enable notifications.");
		} finally {
			setBusy(false);
			dismiss();
		}
	};

	return (
		<ResponsiveDialog
			open={open()}
			onOpenChange={(next) => {
				if (!next && !busy()) dismiss();
			}}
			title="Enable notifications?"
		>
			<p class="text-muted-foreground text-sm m-0 max-w-100">
				Get notified about new messages, replies, and mentions, even when
				Colibri is closed. You can change this anytime in the notification
				settings.
			</p>
			<div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
				<Button variant="ghost" onClick={dismiss} disabled={busy()}>
					Not now
				</Button>
				<Button onClick={handleEnable} disabled={busy()}>
					Enable notifications
				</Button>
			</div>
		</ResponsiveDialog>
	);
};
