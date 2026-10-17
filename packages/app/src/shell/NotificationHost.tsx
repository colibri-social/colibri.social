import {
	appActive,
	MessageToast,
	messageToastAnnouncement,
	toast,
} from "@colibri-social/ui";
import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import {
	notificationTarget,
	shouldAlertNotification,
} from "../data/notification-alerts";
import { describeNotification } from "../data/notification-content";
import {
	createNotificationSoundPlayer,
	type NotificationSound,
} from "../data/notification-sounds";
import { spaceNotificationPrefs } from "../data/notifications";
import { useData } from "../data/store";
import type { Did, NotificationView, SpaceRef } from "../data/types";
import { documentVisible } from "../data/visibility";
import {
	type DeviceNotifications,
	deviceNotifications,
} from "../native/notifications/device";
import {
	type OsActivation,
	type OsNotifier,
	osNotifier,
} from "../native/notifications/index";
import { openNotificationTarget } from "../screens/inbox/inbox-adapter";
import { NotificationPrompt } from "./NotificationPrompt";
import type { Navigator } from "./stack";

export const MESSAGE_TOAST_ID = "message-notification";
export const MESSAGE_TOAST_DURATION = 5000;

const isAppVisible = () => documentVisible() && appActive();

const communityOfRef = (ref: string) =>
	ref.slice("at://".length, ref.indexOf("/space/"));

export const NotificationHost = (props: {
	stack: Pick<Navigator, "root" | "setRoot" | "push">;
	notifier?: () => Promise<OsNotifier>;
	device?: DeviceNotifications;
	play?: (sound: NotificationSound) => void;
}) => {
	const data = useData();
	const prefs = spaceNotificationPrefs(data);
	const device = props.device ?? deviceNotifications();
	const notifier = props.notifier ?? osNotifier;
	const play = props.play ?? createNotificationSoundPlayer();
	const handled = new Set<string>();
	const [shown, setShown] = createSignal<NotificationView>();
	let disposed = false;

	onCleanup(device.watch());

	const content = (view: NotificationView) => {
		const described = describeNotification(data, view);
		const root = props.stack.root();
		const sameSpace = root.tab === "spaces" && root.space === view.community;
		return {
			...described,
			spaceName: sameSpace ? undefined : described.spaceName,
		};
	};

	const open = (view: NotificationView) => {
		void data.notifications.markRead([view.id]).catch(() => {});
		openNotificationTarget(props.stack, data.jumps.request, view);
	};

	const showToast = (view: NotificationView) => {
		setShown(view);
		toast.custom(
			(id) => {
				const current = createMemo(() => content(view));
				return (
					<MessageToast
						authorName={current().authorName}
						authorAvatar={current().authorAvatar}
						authorSeed={current().authorSeed}
						location={current().location}
						spaceName={current().spaceName}
						text={current().text}
						onOpen={() => {
							toast.dismiss(id);
							open(view);
						}}
					/>
				);
			},
			{
				id: MESSAGE_TOAST_ID,
				duration: MESSAGE_TOAST_DURATION,
				announce: messageToastAnnouncement(content(view)),
				onDismiss: () => {
					if (shown() === view) setShown(undefined);
				},
			},
		);
	};

	const showOs = (view: NotificationView) => {
		const described = describeNotification(data, view);
		void notifier().then((target) =>
			target.show({
				title: described.authorName,
				subtitle: described.subtitle,
				body: described.text,
				channel: view.channel,
				...(view.thread ? { thread: view.thread } : {}),
				...(view.message?.rkey ? { rkey: view.message.rkey } : {}),
				...(view.author.avatar ? { avatar: view.author.avatar } : {}),
				authorDid: view.author.did,
			}),
		);
	};

	const dismissOs = (target: string | undefined) => {
		void notifier().then((current) =>
			target ? current.dismiss(target) : current.clearAll(),
		);
	};

	const activate = (activation: OsActivation) => {
		const match = data.notifications
			.items()
			.find(
				(view) =>
					view.channel === activation.channel &&
					view.thread === activation.thread &&
					(!activation.rkey || view.message?.rkey === activation.rkey),
			);
		if (match) void data.notifications.markRead([match.id]).catch(() => {});
		openNotificationTarget(props.stack, data.jumps.request, {
			community: communityOfRef(activation.channel) as Did,
			channel: activation.channel as SpaceRef,
			...(activation.thread ? { thread: activation.thread as SpaceRef } : {}),
			...(activation.rkey ? { message: { rkey: activation.rkey } } : {}),
		});
	};

	let stopActivation: (() => void) | undefined;
	void notifier().then((current) => {
		if (!disposed) stopActivation = current.onActivation(activate);
	});

	onCleanup(
		data.source.subscribe((event) => {
			if (event.$type === "seenEvent") {
				if (!event.channel) dismissOs(undefined);
				return;
			}
			if (event.$type !== "notificationEvent") return;
			const view = event.notification;
			if (handled.has(view.id)) return;
			handled.add(view.id);
			const visible = isAppVisible();
			const alert = shouldAlertNotification(view, {
				viewer: data.viewer.did,
				viewing: data.viewing(),
				visible,
				doNotDisturb:
					data.presenceOf(data.viewer.did as Did)?.onlineState === "dnd",
				spaceMuted: prefs.isMuted(view.community),
				spaceLevel: prefs.level(view.community),
				channelMuted: data.isMuted(view.channel as SpaceRef),
				threadMuted: view.thread
					? data.isMuted(view.thread as SpaceRef)
					: false,
				now: Date.now(),
			});
			if (!alert) return;
			play("ping");
			if (visible) showToast(view);
			else if (device.active()) showOs(view);
		}),
	);

	createEffect(() => {
		const viewing = data.viewing();
		if (viewing && isAppVisible()) dismissOs(viewing);
	});

	createEffect(() => {
		const current = shown();
		if (current && data.viewing() === notificationTarget(current)) {
			toast.dismiss(MESSAGE_TOAST_ID);
		}
	});

	onCleanup(() => {
		disposed = true;
		stopActivation?.();
		toast.dismiss(MESSAGE_TOAST_ID);
	});

	return <NotificationPrompt device={device} notifier={notifier} />;
};
