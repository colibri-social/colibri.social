import type { Community } from "@colibri-social/lib";
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
import LockSimpleIcon from "~icons/ph/lock-simple";
import { evictCommunity } from "../atproto/cache/community-evict";
import { namespace } from "../atproto/cache/keys";
import { communityUriToUrlCompatible } from "../atproto/community-uri-to-url-compatible";
import { putRecord } from "../atproto/pds";
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
import { classifyThrown } from "../errors/classify";
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

const CommunityAvatar = (props: { item: Community; class?: string }) => (
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
	item: Community;
	draggedItem: Community | undefined;
}) => {
	const sortable = createSortable(props.item.uri);
	const [, { onDragStart, onDragEnd: onDndDragEnd }] = useDragDropContext()!;
	const notifications = useNotifications();

	const communityDid = () => props.item.uri.split("/")[2];
	const pingCount = () => notifications.pingsForCommunity(communityDid());
	const hasUnread = () => notifications.hasUnreadInCommunity(communityDid());

	let didDrag = false;
	let el: HTMLDivElement | undefined;

	onDragStart(({ draggable }) => {
		if (draggable.id === props.item.uri) {
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
			<Show when={props.item.isLegacy}>
				<span
					class="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-card border-2 border-card flex items-center justify-center text-muted-foreground pointer-events-none select-none z-20"
					title="Legacy community — awaiting migration"
				>
					<LockSimpleIcon class="w-2.5 h-2.5" />
				</span>
			</Show>
			<CommunityContextMenu community={props.item}>
				<A
					href={`/app/c/${communityUriToUrlCompatible(props.item.uri)}`}
					class="w-10 h-10 rounded-md bg-muted flex items-center justify-center outline-2 -outline-offset-2 outline-transparent hover:outline-foreground/50 transition-all duration-150"
					classList={{ "opacity-60": props.item.isLegacy }}
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
	communities: Community[];
	draggedItem: Community | undefined;
	onItemRef: (rkey: string, el: HTMLElement) => void;
}) => {
	return (
		<>
			<LongPressSensors />
			<SortableProvider ids={props.communities.map((c) => c.uri)}>
				<For each={props.communities}>
					{(item) => (
						<div
							class="relative"
							ref={(node) => props.onItemRef(item.uri, node)}
						>
							<SortableCommunity item={item} draggedItem={props.draggedItem} />
						</div>
					)}
				</For>
			</SortableProvider>
			<DragOverlay>
				{(draggable) => {
					const item = draggable
						? props.communities.find((c) => c.uri === draggable.id)
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

	onMount(() => {
		const cleanup = socket.onEvent((event) => {
			if (
				event.type === "member_event" &&
				event.data?.event === "join" &&
				event.data.member?.did === user.did
			) {
				user.refetchCommunities();
			} else if (
				event.type === "community_event" &&
				event.data?.event === "delete"
			) {
				evictCommunity(namespace(getAppViewDid(), user.did), event.data.uri);
				const segment = communityUriToUrlCompatible(event.data.uri);
				if (location.pathname.startsWith(`/app/c/${segment}`)) {
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
	const [committedOrder, setCommittedOrder] = createSignal<Community[] | null>(
		null,
	);

	const sortedCommunities = () => {
		const order = committedOrder();
		if (!order) return user.communities;
		// Map the committed order back onto the live community objects, then append
		// any communities that arrived since (e.g. a freshly joined one).
		const byUri = new Map(user.communities.map((c) => [c.uri, c]));
		const ordered = order
			.map((c) => byUri.get(c.uri))
			.filter((c): c is Community => c !== undefined);
		const seen = new Set(ordered.map((c) => c.uri));
		return [...ordered, ...user.communities.filter((c) => !seen.has(c.uri))];
	};

	if (window.location.pathname === "/app" && user.communities.length > 0) {
		navigate(
			`/app/c/${communityUriToUrlCompatible(sortedCommunities()[0].uri)}`,
			{ replace: true },
		);
	}

	const [draggingOrder, setDraggingOrder] = createSignal<Community[] | null>(
		null,
	);
	const [draggedItem, setDraggedItem] = createSignal<Community | undefined>(
		undefined,
	);

	const itemEls = new Map<string, HTMLElement>();
	const itemTops = new Map<string, number>();

	const reorder = (
		communities: Community[],
		fromId: string | number,
		toId: string | number,
	) =>
		reorderList(
			communities,
			communities.findIndex((c) => c.uri === fromId),
			communities.findIndex((c) => c.uri === toId),
		);

	const onDragStart = ({ draggable }: DragEvent) => {
		setDraggedItem(user.communities.find((c) => c.uri === draggable.id));
	};

	const onDragOver = ({ draggable, droppable }: DragEvent) => {
		if (!draggable || !droppable) return;
		capturePositions(itemEls, itemTops);
		setDraggingOrder(reorder(sortedCommunities(), draggable.id, droppable.id));
		queueMicrotask(() => animateToNewPositions(itemEls, itemTops));
	};

	const persistCommunityOrder = async (
		order: Community[],
		previous: Community[] | null,
	) => {
		try {
			const { agent } = user.atproto;
			const repo = user.did;

			let record: Record<string, unknown> = { status: "", communities: [] };
			try {
				const res = await agent.com.atproto.repo.getRecord({
					repo,
					collection: "social.colibri.actor.data",
					rkey: "self",
				});
				record = (res.data.value as Record<string, unknown>) ?? record;
			} catch {
				// No actor.data record yet
			}

			// Persist the full sidebar order as community DIDs. The AppView reads
			// this back in `listCommunities` to restore the order on next load, so
			// every community must be included — owned ones too, otherwise they
			// couldn't be reordered relative to the rest.
			record.communities = order.map((c) => c.uri.split("/")[2]);

			await putRecord(agent, repo, "social.colibri.actor.data", "self", record);
		} catch (err) {
			log.error("saving the community order failed", {
				code: classifyThrown(err).code,
			});
			toast.error("Failed to save community order.");
			setCommittedOrder(previous);
		}
	};

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
					style={{ translate: railTranslate() }}
					classList={{
						"absolute left-0 top-0 z-40 will-change-pane": isMobile(),
						"transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] motion-reduce:transition-none":
							isMobile() && !isDragging(),
					}}
				>
					<nav class="w-full h-full flex flex-col gap-2 max-h-[calc(100%-3.25rem-1px)] mb-3.25">
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
					<UserSettingsModal
						open={settingsModal.open}
						setOpen={settingsModal.setOpen}
					>
						<div class="w-10 flex h-10 rounded-md bg-muted hover:bg-primary hover:text-primary-foreground items-center justify-center cursor-pointer">
							<div class="block w-fit h-fit">
								<GearIcon />
							</div>
						</div>
					</UserSettingsModal>
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
