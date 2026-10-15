import {
	appActive,
	MessageToast,
	messageToastAnnouncement,
	toast,
} from "@colibri-social/ui";
import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { displayNameOf } from "../data/adapters/authors";
import { summarizeMessage } from "../data/channel-summary";
import { skeyOf } from "../data/ids";
import {
	notificationTarget,
	shouldAlertNotification,
} from "../data/notification-alerts";
import { spaceNotificationPrefs } from "../data/notifications";
import { useData } from "../data/store";
import type { Did, NotificationView, SpaceRef } from "../data/types";
import { openNotificationTarget } from "../screens/inbox/inbox-adapter";
import type { Navigator } from "./stack";

export const MESSAGE_TOAST_ID = "message-notification";
export const MESSAGE_TOAST_DURATION = 5000;

const isAppVisible = () =>
	typeof document !== "undefined" &&
	document.visibilityState === "visible" &&
	appActive();

export const MessageToastHost = (props: {
	stack: Pick<Navigator, "root" | "setRoot" | "push">;
}) => {
	const data = useData();
	const prefs = spaceNotificationPrefs(data);
	const handled = new Set<string>();
	const [shown, setShown] = createSignal<NotificationView>();

	const describe = (view: NotificationView) => {
		const community = data.spaceByKey(view.community);
		const space = community ? data.space(community) : undefined;
		const channelName =
			space?.channelBySlug(skeyOf(view.channel))?.name ?? skeyOf(view.channel);
		const threadName = view.thread
			? data
					.threadsOf(view.channel)
					.value()
					?.find((thread) => thread.space === view.thread)?.name
			: undefined;
		const root = props.stack.root();
		const sameSpace = root.tab === "spaces" && root.space === view.community;
		return {
			authorName: displayNameOf(
				view.author,
				space?.memberByDid(view.author.did as Did),
			),
			authorAvatar: view.author.avatar,
			authorSeed: view.author.did,
			location: view.thread
				? (threadName ?? `Thread in #${channelName}`)
				: `#${channelName}`,
			spaceName: sameSpace ? undefined : community?.name,
			text:
				(view.message ? summarizeMessage(view.message).text : "") ||
				"Sent a message",
		};
	};

	const open = (view: NotificationView) => {
		void data.notifications.markRead([view.id]).catch(() => {});
		openNotificationTarget(props.stack, data.jumps.request, view);
	};

	const show = (view: NotificationView) => {
		setShown(view);
		toast.custom(
			(id) => {
				const content = createMemo(() => describe(view));
				return (
					<MessageToast
						authorName={content().authorName}
						authorAvatar={content().authorAvatar}
						authorSeed={content().authorSeed}
						location={content().location}
						spaceName={content().spaceName}
						text={content().text}
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
				announce: messageToastAnnouncement(describe(view)),
				onDismiss: () => {
					if (shown() === view) setShown(undefined);
				},
			},
		);
	};

	onCleanup(
		data.source.subscribe((event) => {
			if (event.$type !== "notificationEvent") return;
			const view = event.notification;
			if (handled.has(view.id)) return;
			handled.add(view.id);
			const alert = shouldAlertNotification(view, {
				viewer: data.viewer.did,
				viewing: data.viewing(),
				visible: isAppVisible(),
				doNotDisturb:
					data.presenceOf(data.viewer.did as Did)?.onlineState === "dnd",
				spaceMuted: prefs.isMuted(view.community),
				spaceLevel: prefs.level(view.community),
				channelMuted: data.isMuted(view.channel as SpaceRef),
				now: Date.now(),
			});
			if (alert) show(view);
		}),
	);

	createEffect(() => {
		const current = shown();
		if (current && data.viewing() === notificationTarget(current)) {
			toast.dismiss(MESSAGE_TOAST_ID);
		}
	});

	onCleanup(() => toast.dismiss(MESSAGE_TOAST_ID));

	return null;
};
