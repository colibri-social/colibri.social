import {
	MessageToast,
	messageToastAnnouncement,
	toast,
} from "@colibri-social/ui";
import {
	createEffect,
	createMemo,
	createRoot,
	createSignal,
	onCleanup,
} from "solid-js";
import { useLiveStatus } from "../data/live-context";
import {
	notificationTarget,
	shouldAlertNotification,
} from "../data/notification-alerts";
import { describeNotification } from "../data/notification-content";
import {
	createNotificationSoundPlayer,
	type NotificationSound,
} from "../data/notification-sounds";
import { isUnread, spaceNotificationPrefs } from "../data/notifications";
import { useData } from "../data/store";
import type { Did, NotificationView, SpaceRef } from "../data/types";
import { appVisible } from "../data/visibility";
import { voice } from "../data/voice";
import {
	type DeviceNotifications,
	deviceNotifications,
} from "../native/notifications/device";
import {
	type OsActivation,
	type OsNotifier,
	osNotifier,
} from "../native/notifications/index";
import {
	currentPush,
	installMarkReadDrain,
	listenForPushActivations,
	type Push,
	pushActivations,
} from "../native/push/index";
import type { MarkReadTarget } from "../native/push/mark-read";
import { openNotificationTarget } from "../screens/inbox/inbox-adapter";
import { useOptionalDesktopShell } from "./desktop/context";
import { NotificationPrompt } from "./NotificationPrompt";
import type { Navigator } from "./stack";

export const MESSAGE_TOAST_ID = "message-notification";
export const MESSAGE_TOAST_DURATION = 5000;

const communityOfRef = (ref: string) =>
	ref.slice("at://".length, ref.indexOf("/space/"));

export const NotificationHost = (props: {
	stack: Pick<Navigator, "root" | "setRoot" | "push">;
	notifier?: () => Promise<OsNotifier>;
	device?: DeviceNotifications;
	play?: (sound: NotificationSound) => void;
	push?: Push;
	listenForPush?: () => () => void;
}) => {
	const data = useData();
	const desktop = useOptionalDesktopShell();
	const prefs = spaceNotificationPrefs(data);
	const device = props.device ?? deviceNotifications();
	const notifier = props.notifier ?? osNotifier;
	const play = props.play ?? createNotificationSoundPlayer();
	const push = () => props.push ?? currentPush();
	const liveStatus = useLiveStatus();
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
		openNotificationTarget(
			props.stack,
			data.jumps.request,
			view,
			desktop?.setVoiceChatOpen,
		);
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
		void push()?.dismiss(target);
	};

	const waiting = new Set<() => void>();
	const markActivated = (activation: OsActivation) => {
		const matches = (view: NotificationView) =>
			view.channel === activation.channel &&
			view.thread === activation.thread &&
			(!activation.rkey || view.message?.rkey === activation.rkey);
		const markMatch = () => {
			const match = data.notifications.items().find(matches);
			if (match) void data.notifications.markRead([match.id]).catch(() => {});
			return !!match;
		};
		if (markMatch()) return;
		if (activation.rkey) {
			void data.source
				.markRead(
					(activation.thread ?? activation.channel) as SpaceRef,
					activation.rkey,
				)
				.catch(() => {});
		}
		if (data.notifications.status() !== "loading") return;
		createRoot((dispose) => {
			const stop = () => {
				waiting.delete(stop);
				dispose();
			};
			waiting.add(stop);
			createEffect(() => {
				if (markMatch() || data.notifications.status() !== "loading") stop();
			});
		});
	};

	const activate = (activation: OsActivation) => {
		markActivated(activation);
		openNotificationTarget(
			props.stack,
			data.jumps.request,
			{
				community: communityOfRef(activation.channel) as Did,
				channel: activation.channel as SpaceRef,
				...(activation.thread ? { thread: activation.thread as SpaceRef } : {}),
				...(activation.rkey ? { message: { rkey: activation.rkey } } : {}),
			},
			desktop?.setVoiceChatOpen,
		);
	};

	const markReadFromNotification = async (target: MarkReadTarget) => {
		await data.source.markRead(target.space as SpaceRef, target.rkey);
		await data.source.flushReadCursors?.();
		const ids = data.notifications
			.items()
			.filter(
				(view) =>
					(view.thread ?? view.channel) === target.space && isUnread(view),
			)
			.map((view) => view.id);
		if (ids.length) await data.notifications.markRead(ids);
	};

	onCleanup(pushActivations.subscribe(activate));
	onCleanup((props.listenForPush ?? listenForPushActivations)());
	onCleanup(installMarkReadDrain(markReadFromNotification));

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
			const visible = appVisible();
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
				voiceChannel: voice.current()?.channel,
				now: Date.now(),
			});
			if (!alert) return;
			if (visible) {
				play("ping");
				showToast(view);
				return;
			}
			if (push()?.active()) return;
			play("ping");
			if (device.active()) showOs(view);
		}),
	);

	createEffect(() => {
		push()?.setLive(liveStatus?.status() === "open" && appVisible());
	});

	createEffect(() => {
		const viewing = data.viewing();
		if (viewing && appVisible()) dismissOs(viewing);
	});

	createEffect(() => {
		const current = shown();
		if (current && data.viewing() === notificationTarget(current)) {
			toast.dismiss(MESSAGE_TOAST_ID);
		}
	});

	onCleanup(() => {
		disposed = true;
		for (const stop of [...waiting]) stop();
		stopActivation?.();
		push()?.setLive(false);
		toast.dismiss(MESSAGE_TOAST_ID);
	});

	return <NotificationPrompt device={device} notifier={notifier} />;
};
