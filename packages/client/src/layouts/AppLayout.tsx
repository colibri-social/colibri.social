import { A, useLocation, useNavigate } from "@solidjs/router";
import {
	closestCenter,
	createSortable,
	DragDropProvider,
	type DragEvent,
	DragOverlay,
	SortableProvider,
	useDragDropContext,
} from "@thisbeyond/solid-dnd";
import {
	createEffect,
	createSignal,
	For,
	on,
	onCleanup,
	onMount,
	type ParentComponent,
	Show,
} from "solid-js";
import { toast } from "somoto";
import GearIcon from "~icons/ph/gear";
import HouseIcon from "~icons/ph/house";
import { evictCommunity } from "../atproto/cache/community-evict";
import { tombstoneCommunity } from "../atproto/cache/community-tombstone";
import { communityKey, namespace } from "../atproto/cache/keys";
import { linkErrorMessage, readLinkOutcome } from "../atproto/labeler-link";
import { writeCommunityOrder } from "../atproto/notificationPreference";
import { creationInFlight } from "../atproto/pending-community";
import { resumeQuietly } from "../atproto/resume-community-creation";
import { frameIs } from "../atproto/sync-frames";
import type { CommunityView } from "../atproto/views";
import { AppBadge } from "../components/app/AppBadge";
import { AppReconnectingIndicator } from "../components/app/AppReconnectingIndicator";
import { CommunityCreationModal } from "../components/app/CommunityCreationModal";
import { CommunityAvatar as SharedCommunityAvatar } from "../components/app/community/CommunityAvatar";
import { CommunityContextMenu } from "../components/app/community/CommunityContextMenu";
import { PENDING_INVITE_KEY } from "../components/app/community/invite-storage";
import { MessageSnapshotWriter } from "../components/app/MessageSnapshotWriter";
import { NativeNotifications } from "../components/app/NativeNotifications";
import { NotificationPromptDialog } from "../components/app/onboarding/NotificationPromptDialog";
import { ReleaseNotesModal } from "../components/app/ReleaseNotes";
import { UserSettingsModal } from "../components/app/settings";
import { TitleBar } from "../components/app/titlebar";
import { VoiceOverlay } from "../components/app/VoiceOverlay";
import { Plus } from "../components/icons/Plus";
import {
	Tooltip,
	TooltipContent,
	TooltipPortal,
	TooltipTrigger,
} from "../components/ui/Tooltip";
import { GifFavoritesContextProvider } from "../contexts/GifFavorites";
import { MutesContextProvider } from "../contexts/Mutes";
import {
	NotificationsContextProvider,
	useNotifications,
} from "../contexts/Notifications";
import {
	SettingsModalContextProvider,
	useSettingsModalContext,
} from "../contexts/SettingsModal";
import { useSocketContext } from "../contexts/Socket";
import { useUserContext } from "../contexts/User";
import { useViewport } from "../contexts/Viewport";
import { isTauriRuntime } from "../notifications/environment";
import { trackAppShellMounted } from "../utils/app-shell";
import { getAppViewDid } from "../utils/appview";
import { LongPressSensors } from "../utils/create-longpress-sensor";
import {
	animateToNewPositions,
	capturePositions,
	reorderList,
} from "../utils/drag";
import { animateKeyboardTransition } from "../utils/keyboard-animation";
import { createLogger } from "../utils/logger";
import { createMobilePane } from "../utils/mobile-pane";
import { hasNativeKeyboardInsetSync, isDesktopNative } from "../utils/platform";
import { createNativeTitleSync } from "../utils/shell-title";
import { shellHeightForInset } from "../utils/visual-viewport";

const log = createLogger("layout");

const CommunityAvatar = (props: { item: CommunityView; class?: string }) => (
	<Tooltip placement="right">
		<TooltipTrigger class="cursor-pointer">
			<SharedCommunityAvatar community={props.item} class={props.class} />
		</TooltipTrigger>
		<TooltipPortal>
			<TooltipContent class="text-base font-medium">
				{props.item.name}
			</TooltipContent>
		</TooltipPortal>
	</Tooltip>
);

const SortableCommunity = (props: {
	item: CommunityView;
	draggedItem: CommunityView | undefined;
}) => {
	const sortable = createSortable(props.item.did);
	const [, { onDragStart, onDragEnd: onDndDragEnd }] = useDragDropContext()!;
	const notifications = useNotifications();

	const pingCount = () => notifications.pingsForCommunity(props.item.did);
	const hasUnread = () => notifications.hasUnreadInCommunity(props.item.did);

	let didDrag = false;
	let el: HTMLDivElement | undefined;

	onDragStart(({ draggable }) => {
		if (draggable.id === props.item.did) {
			didDrag = true;
			el?.style.removeProperty("transition");
		} else {
			el?.style.setProperty("transition", "transform 200ms ease");
		}
	});

	onDndDragEnd(() => {
		el?.style.removeProperty("transition");
		didDrag = false;
	});

	const handleClick = (e: MouseEvent) => {
		if (didDrag) {
			e.preventDefault();
		}
	};

	return (
		<div
			ref={(node) => {
				el = node;
				sortable.ref(node);
			}}
			class="relative"
			classList={{ "opacity-50": sortable.isActiveDraggable }}
			style={{ "touch-action": "pan-y" }}
			{...sortable.dragActivators}
		>
			<Show
				when={pingCount() > 0}
				fallback={
					<Show when={hasUnread()}>
						<span class="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-foreground border-2 border-card pointer-events-none select-none z-20" />
					</Show>
				}
			>
				<span class="absolute -top-1 -right-1 min-w-4.5 h-4.5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center pointer-events-none select-none z-20">
					{pingCount() > 9 ? "9+" : pingCount()}
				</span>
			</Show>
			<Show when={sortable.isActiveDroppable && props.draggedItem}>
				{(resolved) => (
					<div class="absolute inset-0 rounded-md flex items-center justify-center opacity-40 pointer-events-none z-10">
						<CommunityAvatar item={resolved()} />
					</div>
				)}
			</Show>
			<CommunityContextMenu community={props.item}>
				<A
					href={`/app/c/${props.item.did}`}
					class="w-10 h-10 rounded-md bg-muted flex items-center justify-center outline-2 -outline-offset-2 outline-transparent hover:outline-foreground/50 transition-all duration-150"
					activeClass="outline-foreground!"
					onClick={handleClick}
					draggable={false}
				>
					<CommunityAvatar item={props.item} />
				</A>
			</CommunityContextMenu>
		</div>
	);
};

const CommunitySidebar = (props: {
	communities: CommunityView[];
	draggedItem: CommunityView | undefined;
	onItemRef: (rkey: string, el: HTMLElement) => void;
}) => {
	return (
		<>
			<LongPressSensors />
			<SortableProvider ids={props.communities.map((c) => c.did)}>
				<For each={props.communities}>
					{(item) => (
						<div
							class="relative"
							ref={(node) => props.onItemRef(item.did, node)}
						>
							<SortableCommunity item={item} draggedItem={props.draggedItem} />
						</div>
					)}
				</For>
			</SortableProvider>
			<DragOverlay>
				{(draggable) => {
					const item = draggable
						? props.communities.find((c) => c.did === draggable.id)
						: undefined;
					return (
						<Show when={item}>
							{(resolved) => (
								<div class="w-10 h-10 rounded-md bg-muted flex items-center justify-center opacity-90 shadow-lg">
									<CommunityAvatar item={resolved()} />
								</div>
							)}
						</Show>
					);
				}}
			</DragOverlay>
		</>
	);
};

const AppLayout: ParentComponent = (props) => {
	const settingsModal = useSettingsModalContext();
	const user = useUserContext();
	const socket = useSocketContext();
	const navigate = useNavigate();
	const location = useLocation();
	const { isMobile, railTranslate, navProgress, isDragging } =
		createMobilePane();
	const viewport = useViewport();

	const desktopShell = isDesktopNative();
	const needsShellInsets = () =>
		!desktopShell && (isMobile() || isTauriRuntime());

	createNativeTitleSync();
	trackAppShellMounted();

	const shellHeight = () =>
		needsShellInsets() && viewport.height() !== undefined
			? `${viewport.height()}px`
			: undefined;

	let shellEl: HTMLDivElement | undefined;
	let shellAnimation: Animation | undefined;

	const safeAreaBottom = () =>
		Number.parseFloat(
			getComputedStyle(document.documentElement).getPropertyValue(
				"--safe-area-bottom",
			),
		) || 0;

	createEffect(
		on(
			() => viewport.keyboardTransition(),
			(transition) => {
				if (!needsShellInsets()) return;

				const el = shellEl;
				if (!transition || !el || transition.samples.length < 2) return;

				const safeBottom = safeAreaBottom();

				shellAnimation?.cancel();
				shellAnimation = animateKeyboardTransition(el, transition, (inset) => ({
					height: `${shellHeightForInset(inset)}px`,
					paddingBottom: `${Math.max(0, safeBottom - inset)}px`,
				}));
			},
			{ defer: true },
		),
	);

	onCleanup(() => shellAnimation?.cancel());

	onMount(() => {
		let pending: string | null = null;
		try {
			pending = localStorage.getItem(PENDING_INVITE_KEY);
		} catch {}
		if (pending && !location.pathname.startsWith("/app/invite/")) {
			navigate(`/app/invite/${pending}`, { replace: true });
		}
	});

	createEffect(() => {
		const outcome = readLinkOutcome(
			new URLSearchParams(location.search),
			user.did,
		);
		if (!outcome) return;

		navigate(location.pathname, { replace: true });

		settingsModal.openPage("support");

		if (outcome.status === "linked") {
			toast.success(
				outcome.account
					? `Linked @${outcome.account}. Your badge is on its way.`
					: "Open Collective account linked.",
			);
		} else {
			toast.error(linkErrorMessage(outcome.reason));
		}
	});

	createEffect(() => {
		const dids = user.communities.map((c) => c.did);
		if (dids.length === 0) return;
		const release = socket.subscribe({ communities: dids });
		onCleanup(release);
	});

	const finishPendingCreation = async () => {
		if (creationInFlight()) return;

		const outcome = await resumeQuietly(
			user.xrpc,
			namespace(getAppViewDid(), user.did),
		);

		if (outcome.kind === "done") {
			await user.refetchCommunities();
			toast(`${outcome.community.name} is ready.`, {
				action: {
					label: "Open",
					onClick: () => navigate(`/app/c/${outcome.community.did}`),
				},
			});
			return;
		}

		if (outcome.kind === "abandoned") {
			toast(`${outcome.name} was never finished. You can create it again.`);
		}
	};

	onMount(() => void finishPendingCreation());

	let hadSocket = socket.connected();
	createEffect(() => {
		const isConnected = socket.connected();
		const reconnected = isConnected && !hadSocket;
		hadSocket = isConnected;
		if (reconnected) void finishPendingCreation();
	});

	const leaveCommunity = (community: string) => {
		const name = user.communities.find((c) => c.did === community)?.name;
		evictCommunity(namespace(getAppViewDid(), user.did), community);
		user.dropCommunity(community);
		if (location.pathname.startsWith(`/app/c/${community}`)) {
			navigate("/app");
		}
		toast(
			name
				? `You're no longer a member of ${name}.`
				: "You're no longer a member of that community.",
		);
	};

	onMount(() => {
		const cleanup = socket.onEvent((event) => {
			if (
				frameIs(event, "memberEvent") &&
				event.event === "join" &&
				event.member?.actor.did === user.did
			) {
				user.refetchCommunities();
			} else if (
				frameIs(event, "memberEvent") &&
				event.event === "leave" &&
				event.subject === user.did
			) {
				leaveCommunity(event.community);
			} else if (frameIs(event, "communityEvent") && event.event === "delete") {
				const ns = namespace(getAppViewDid(), user.did);
				tombstoneCommunity(communityKey(ns, event.community));
				evictCommunity(ns, event.community);
				if (location.pathname.startsWith(`/app/c/${event.community}`)) {
					navigate("/app");
				}
				user.refetchCommunities();
			}
		});
		onCleanup(cleanup);
	});

	onMount(() => {
		const suppressNativeMenuWhileOpen = (event: MouseEvent) => {
			const menuMounted = document.querySelector(
				"[data-slot='context-menu-content'],[data-slot='context-menu-sub-content']",
			);
			if (!menuMounted) return;

			const target = event.target as Element | null;
			if (target?.closest("[data-slot='context-menu-trigger']")) return;

			event.preventDefault();
		};
		document.addEventListener("contextmenu", suppressNativeMenuWhileOpen, {
			capture: true,
		});
		onCleanup(() =>
			document.removeEventListener("contextmenu", suppressNativeMenuWhileOpen, {
				capture: true,
			}),
		);
	});

	// Locally-committed sidebar order. Held in a signal (rather than mutating the
	// shared `user` resource) so a reorder doesn't churn every consumer of
	// `user.communities` — mirrors the category/channel reorder in ChannelList.
	const [committedOrder, setCommittedOrder] = createSignal<
		CommunityView[] | null
	>(null);

	const sortedCommunities = (): CommunityView[] => {
		const order = committedOrder();
		if (!order) return user.communities;
		const byDid = new Map(user.communities.map((c) => [c.did, c]));
		const ordered = order
			.map((c) => byDid.get(c.did))
			.filter((c): c is CommunityView => c !== undefined);
		const seen = new Set(ordered.map((c) => c.did));
		return [...ordered, ...user.communities.filter((c) => !seen.has(c.did))];
	};

	const firstCommunity = sortedCommunities()[0];
	if (window.location.pathname === "/app" && firstCommunity) {
		navigate(`/app/c/${firstCommunity.did}`, { replace: true });
	}

	const [draggingOrder, setDraggingOrder] = createSignal<
		CommunityView[] | null
	>(null);
	const [draggedItem, setDraggedItem] = createSignal<CommunityView | undefined>(
		undefined,
	);

	const itemEls = new Map<string, HTMLElement>();
	const itemTops = new Map<string, number>();

	const reorder = (
		communities: CommunityView[],
		fromId: string | number,
		toId: string | number,
	) =>
		reorderList(
			communities,
			communities.findIndex((c) => c.did === fromId),
			communities.findIndex((c) => c.did === toId),
		);

	const onDragStart = ({ draggable }: DragEvent) => {
		setDraggedItem(user.communities.find((c) => c.did === draggable.id));
	};

	const onDragOver = ({ draggable, droppable }: DragEvent) => {
		if (!draggable || !droppable) return;
		capturePositions(itemEls, itemTops);
		setDraggingOrder(reorder(sortedCommunities(), draggable.id, droppable.id));
		queueMicrotask(() => animateToNewPositions(itemEls, itemTops));
	};

	const persistCommunityOrder = async (
		order: CommunityView[],
		previous: CommunityView[] | null,
	) => {
		const res = await writeCommunityOrder(
			user.atproto.agent,
			user.xrpc,
			user.did,
			order.map((c) => c.did),
		);

		if (!res.ok) {
			log.error("saving the community order failed", { code: res.error.code });
			toast.error("Failed to save community order.");
			setCommittedOrder(previous);
		}
	};

	onMount(() => {
		const cleanup = socket.onEvent((event) => {
			if (!frameIs(event, "preferencesEvent")) return;
			const byDid = new Map(user.communities.map((c) => [c.did, c]));
			const ordered = event.preferences.communityOrder
				.map((did) => byDid.get(did))
				.filter((c): c is CommunityView => c !== undefined);
			setCommittedOrder(ordered.length === 0 ? null : ordered);
		});
		onCleanup(cleanup);
	});

	const onDragEnd = ({ draggable, droppable }: DragEvent) => {
		const finalOrder = draggingOrder();

		setDraggingOrder(null);
		setDraggedItem(undefined);

		if (!draggable || !droppable || !finalOrder) return;
		if (draggable.id === droppable.id) return;

		const previous = committedOrder();
		setCommittedOrder(finalOrder);

		void persistCommunityOrder(finalOrder, previous);
	};

	const isInHome = () => location.pathname === "/app";

	return (
		<div
			ref={shellEl}
			class="flex flex-col w-full bg-card relative"
			classList={{
				"h-[100dvh]": needsShellInsets() && shellHeight() === undefined,
				"h-screen": !needsShellInsets(),
				"pt-[var(--safe-area-top)]": needsShellInsets(),
				"transition-[height,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]":
					needsShellInsets() && !hasNativeKeyboardInsetSync(),
			}}
			style={{
				...(shellHeight() ? { height: shellHeight() } : {}),
				...(needsShellInsets()
					? {
							"padding-bottom": `max(0px, calc(var(--safe-area-bottom) - ${viewport.keyboardInset()}px))`,
						}
					: {}),
				...(needsShellInsets() && viewport.offsetTop() > 0
					? { transform: `translateY(${viewport.offsetTop()}px)` }
					: {}),
			}}
		>
			<Show when={needsShellInsets() && isMobile()}>
				<div
					aria-hidden="true"
					class="absolute inset-x-0 top-0 h-[var(--safe-area-top)] bg-background pointer-events-none z-50"
					style={{ opacity: 1 - navProgress() }}
					classList={{
						"transition-opacity duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] motion-reduce:transition-none":
							!isDragging(),
					}}
				/>
			</Show>
			<NativeNotifications />
			<AppBadge />
			<NotificationPromptDialog />
			<TitleBar />
			<div class="flex w-full relative h-[calc(100%-var(--titlebar-height))]">
				<aside
					class="flex flex-col h-full w-14 p-2 pb-3 bg-card"
					style={{ transform: railTranslate() }}
					classList={{
						"absolute left-0 top-0 z-40 will-change-pane": isMobile(),
						"transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] motion-reduce:transition-none":
							isMobile() && !isDragging(),
					}}
				>
					<nav
						class="w-full h-full flex flex-col gap-2 mb-3.25"
						classList={{
							"max-h-[calc(100%-3.25rem-1px)]": isInHome(),
						}}
					>
						<div class="w-[calc(100%+0.5rem)] h-full flex flex-col no-scrollbar gap-2 overflow-y-auto overflow-x-clip px-1 -mx-1">
							<A
								href="/app"
								class="min-w-10 flex min-h-10 rounded-md bg-muted hover:bg-primary hover:text-primary-foreground items-center justify-center cursor-pointer"
								classList={{
									"bg-primary": isInHome(),
								}}
							>
								<HouseIcon />
							</A>
							<hr class="m-0 border-muted" />
							<DragDropProvider
								onDragStart={onDragStart}
								onDragOver={onDragOver}
								onDragEnd={onDragEnd}
								collisionDetector={closestCenter}
							>
								<CommunitySidebar
									communities={draggingOrder() ?? sortedCommunities()}
									draggedItem={draggedItem()}
									onItemRef={(rkey, el) => itemEls.set(rkey, el)}
								/>
							</DragDropProvider>
							<CommunityCreationModal>
								<button
									type="button"
									class="w-10 flex h-10 rounded-md bg-muted hover:bg-primary hover:text-primary-foreground items-center justify-center cursor-pointer"
								>
									<Plus className="w-4 h-4" />
								</button>
							</CommunityCreationModal>
						</div>
					</nav>
					<Show when={isInHome()}>
						<UserSettingsModal
							open={settingsModal.open}
							setOpen={settingsModal.setOpen}
							page={settingsModal.page}
							onPageConsumed={() => settingsModal.setPage(undefined)}
						>
							<div class="w-10 flex h-10 rounded-md bg-muted hover:bg-primary hover:text-primary-foreground items-center justify-center cursor-pointer">
								<div class="block w-fit h-fit">
									<GearIcon />
								</div>
							</div>
						</UserSettingsModal>
					</Show>
				</aside>
				<main class="w-full h-full">{props.children}</main>
			</div>
			<VoiceOverlay />
			<AppReconnectingIndicator />
			<ReleaseNotesModal />
			<MessageSnapshotWriter />
		</div>
	);
};

const AppLayoutWithPreferences: ParentComponent = (props) => (
	<MutesContextProvider>
		<GifFavoritesContextProvider>
			<NotificationsContextProvider>
				<SettingsModalContextProvider>
					<AppLayout>{props.children}</AppLayout>
				</SettingsModalContextProvider>
			</NotificationsContextProvider>
		</GifFavoritesContextProvider>
	</MutesContextProvider>
);

export default AppLayoutWithPreferences;
