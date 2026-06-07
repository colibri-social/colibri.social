import {
	type Component,
	createSignal,
	For,
	onCleanup,
	onMount,
	Show,
} from "solid-js";
import BellIcon from "~icons/ph/bell";
import BellRingingIcon from "~icons/ph/bell-ringing-fill";
import { useSocketContext } from "../../contexts/Socket";
import { useUserContext } from "../../contexts/User";
import {
	Popover,
	PopoverContent,
	PopoverPortal,
	PopoverTrigger,
} from "../ui/Popover";

type Notification = {
	id: number;
	kind: string;
	messageUri: string;
	authorDid: string;
	channelUri: string;
	indexedAt: string;
	seenAt?: string;
	message?: {
		text: string;
		createdAt: string;
	};
};

export const NotificationBell: Component = () => {
	const user = useUserContext();
	const socket = useSocketContext();

	const [unreadCount, setUnreadCount] = createSignal(0);
	const [notifications, setNotifications] = createSignal<Notification[]>([]);
	const [open, setOpen] = createSignal(false);
	const [loading, setLoading] = createSignal(false);

	onMount(async () => {
		try {
			const res = await user.xrpc.social.colibri.notification.getUnreadCount();
			if (res) setUnreadCount(res.count);
		} catch {
			// Non-fatal
		}

		const cleanup = socket.onEvent((event) => {
			if (event.type === "notification_event" && event.data) {
				setUnreadCount((n) => n + 1);
			}
		});
		onCleanup(cleanup);
	});

	const handleOpenChange = async (isOpen: boolean) => {
		setOpen(isOpen);
		if (!isOpen) return;

		setLoading(true);
		try {
			const res = await user.xrpc.social.colibri.notification.listNotifications(
				20,
				undefined,
			);
			if (res) setNotifications(res.notifications as Notification[]);
			await user.xrpc.social.colibri.notification.updateSeen();
			setUnreadCount(0);
		} catch {
			// Non-fatal
		} finally {
			setLoading(false);
		}
	};

	const relativeTime = (iso: string): string => {
		const diff = Date.now() - new Date(iso).getTime();
		const m = Math.floor(diff / 60000);
		if (m < 1) return "just now";
		if (m < 60) return `${m}m ago`;
		const h = Math.floor(m / 60);
		if (h < 24) return `${h}h ago`;
		return `${Math.floor(h / 24)}d ago`;
	};

	const kindLabel = (kind: string): string =>
		kind === "reply" ? "replied to you" : "mentioned you";

	return (
		<Popover
			open={open()}
			onOpenChange={handleOpenChange}
			placement="bottom-end"
		>
			<PopoverTrigger
				as="button"
				type="button"
				class="relative w-8 h-8 flex items-center justify-center rounded-sm hover:bg-muted cursor-pointer text-muted-foreground hover:text-foreground"
			>
				<Show when={unreadCount() > 0} fallback={<BellIcon />}>
					<BellRingingIcon class="text-primary" />
					<span class="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center select-none">
						{unreadCount() > 99 ? "99+" : unreadCount()}
					</span>
				</Show>
			</PopoverTrigger>
			<PopoverPortal>
				<PopoverContent class="w-80 p-0 overflow-hidden">
					<div class="flex items-center justify-between px-3 py-2 border-b border-border">
						<span class="font-semibold text-sm">Notifications</span>
					</div>
					<div class="max-h-96 overflow-y-auto">
						<Show when={loading()}>
							<div class="py-6 text-center text-sm text-muted-foreground">
								Loading…
							</div>
						</Show>
						<Show when={!loading() && notifications()?.length === 0}>
							<div class="py-6 text-center text-sm text-muted-foreground">
								No notifications yet.
							</div>
						</Show>
						<Show when={!loading() && notifications()?.length > 0}>
							<For each={notifications()}>
								{(n) => (
									<a
										href={`/app/c/${n.channelUri.replace("at://", "")}`}
										class="flex flex-col px-3 py-2 border-b border-border last:border-b-0 hover:bg-muted/50"
									>
										<div class="flex items-center justify-between gap-2">
											<span class="text-xs text-muted-foreground font-medium uppercase tracking-wide">
												{kindLabel(n.kind)}
											</span>
											<span class="text-xs text-muted-foreground shrink-0">
												{relativeTime(n.indexedAt)}
											</span>
										</div>
										<Show when={n.message?.text}>
											{(text) => (
												<p class="text-sm mt-0.5 line-clamp-2 text-foreground">
													{text()}
												</p>
											)}
										</Show>
									</a>
								)}
							</For>
						</Show>
					</div>
				</PopoverContent>
			</PopoverPortal>
		</Popover>
	);
};
