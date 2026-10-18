import { ConfirmDialog, toast } from "@colibri-social/ui";
import { createSignal } from "solid-js";
import type { DeviceNotifications } from "../native/notifications/device";
import type { OsNotifier } from "../native/notifications/index";

export const NOTIFICATION_PROMPT_COPY = {
	title: "Turn on notifications?",
	description:
		"Colibri can let you know about new messages, replies and mentions while it's in the background. You can change this anytime in Settings.",
	confirm: "Turn on",
	cancel: "Not now",
	denied:
		"Notifications are off. You can turn them on later in your device settings.",
} as const;

export const NotificationPrompt = (props: {
	device: DeviceNotifications;
	notifier: () => Promise<OsNotifier>;
}) => {
	const [supported, setSupported] = createSignal(false);
	void props.notifier().then((notifier) => {
		setSupported(notifier.kind !== "none");
	});

	const open = () =>
		supported() &&
		!props.device.answered() &&
		!props.device.enabled() &&
		props.device.permission() === "default";

	return (
		<ConfirmDialog
			open={open()}
			onOpenChange={(next) => {
				if (!next) props.device.dismissPrompt();
			}}
			title={NOTIFICATION_PROMPT_COPY.title}
			description={NOTIFICATION_PROMPT_COPY.description}
			confirmLabel={NOTIFICATION_PROMPT_COPY.confirm}
			cancelLabel={NOTIFICATION_PROMPT_COPY.cancel}
			onConfirm={async () => {
				const result = await props.device.request();
				if (result === "denied") toast(NOTIFICATION_PROMPT_COPY.denied);
			}}
		/>
	);
};
