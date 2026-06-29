import { logoUrl as ColibriLogo } from "@colibri-social/assets";
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
	createSignal,
	For,
	Match,
	onCleanup,
	onMount,
	type ParentComponent,
	Show,
	Switch,
} from "solid-js";
import { toast } from "somoto";
import GearIcon from "~icons/ph/gear";
import HouseIcon from "~icons/ph/house";
import { communityUriToUrlCompatible } from "../atproto/community-uri-to-url-compatible";
import { putRecord } from "../atproto/pds";
import { resolveBlob } from "../atproto/resolve-blob";
import { CommunityCreationModal } from "../components/app/CommunityCreationModal";
import { CommunityContextMenu } from "../components/app/community/CommunityContextMenu";
import { NativeNotifications } from "../components/app/NativeNotifications";
import { UserSettingsModal } from "../components/app/settings";
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
import { useSocketContext } from "../contexts/Socket";
import { useUserContext } from "../contexts/User";
import { UserPreferencesContextProvider } from "../contexts/UserPreferences";
import {
	animateToNewPositions,
	capturePositions,
	reorderList,
} from "../utils/drag";
import { SoundsContextProvider } from "../contexts/Sounds";
import { LongPressSensors } from "../utils/create-longpress-sensor";
import { createMobilePane } from "../utils/mobile-pane";
import { createViewportMetrics } from "../utils/visual-viewport";

const CommunityAvatar = (props: { item: Community; class?: string }) => {
	const communityDid = props.item.uri.split("/")[2];
	return (
		<Tooltip placement="right">
			<TooltipTrigger class="cursor-pointer">
				<Switch>
					<Match when={props.item.picture}>
						<img
							src={resolveBlob(communityDid, props.item.picture)}
							alt={props.item.name}
							class={`w-10 h-10 rounded-md pointer-events-none select-none object-cover ${props.class ?? ""}`}
						/>
					</Match>
					<Match when={!props.item.picture}>
						<div class="w-10 h-10 flex items-center justify-center">
							<span class="font-bold">
								{props.item.name
									.split(" ")
									.map((x) => x.substring(0, 1))
									.join("")
									.substring(0, 3)}
							</span>
						</div>
					</Match>
				</Switch>
			</TooltipTrigger>
			<TooltipPortal>
				<TooltipContent class="text-base font-medium">
					{props.item.name}
				</TooltipContent>
			</TooltipPortal>
		</Tooltip>
	);
};

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
						<span class="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-white border-2 border-card pointer-events-none select-none z-20" />
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
					href={`/app/c/${communityUriToUrlCompatible(props.item.uri)}`}
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
	const [_userSettingsOpen, _setUserSettingsOpen] = createSignal(false);
	const user = useUserContext();
	const socket = useSocketContext();
	const navigate = useNavigate();
	const location = useLocation();
	const { isMobile, currentPane } = createMobilePane();
	const viewport = createViewportMetrics();

	const shellHeight = () =>
		isMobile() && viewport.height() !== undefined
			? `${viewport.height()}px`
			: undefined;

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
			console.error("[AppLayout] Failed to save community order", err);
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

	return (
		<div
			class="flex flex-col w-screen bg-card"
			classList={{
				"h-[100dvh]": isMobile() && shellHeight() === undefined,
				"h-screen": !isMobile(),
			}}
			style={{
				...(shellHeight() ? { height: shellHeight() } : {}),
				...(isMobile() && viewport.offsetTop() > 0
					? { transform: `translateY(${viewport.offsetTop()}px)` }
					: {}),
			}}
		>
			<NativeNotifications />
			<div
				class="flex w-full h-10 min-h-10 justify-between"
				classList={{ hidden: isMobile() }}
			>
				<div class="flex w-full h-full pl-2 items-center gap-2">
					<img
						src={ColibriLogo}
						width={32}
						height={32}
						alt="Colibri Social logo"
					/>
					<span class="font-black text-lg bg-clip-text text-transparent bg-[linear-gradient(69deg,#090615_-145.97%,#31226D_-87.27%,#6C5AA6_-26.22%,#AE99CB_30.13%,#E0DEEC_75.92%)]">
						colibri.social
					</span>
				</div>
			</div>
			<div
				class="flex w-full"
				classList={{
					"h-full": isMobile(),
					"h-[calc(100%-40px)]": !isMobile(),
				}}
			>
				<aside
					class="flex flex-col h-full w-14 p-2 pb-3 bg-card"
					classList={{
						"absolute left-0 top-0 z-40 transition-transform duration-200 ease-out motion-reduce:transition-none":
							isMobile(),
						"-translate-x-full": isMobile() && currentPane() !== "nav",
					}}
				>
					<nav class="w-full h-full flex flex-col gap-2 max-h-[calc(100%-3.25rem-1px)] mb-3.25">
						<div class="w-[calc(100%+0.5rem)] h-full flex flex-col no-scrollbar gap-2 overflow-y-auto overflow-x-clip px-1 -mx-1">
							<A
								href="/app"
								class="min-w-10 flex min-h-10 rounded-md bg-muted hover:bg-primary hover:text-primary-foreground items-center justify-center cursor-pointer"
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
					<UserSettingsModal>
						<div class="w-10 flex h-10 rounded-md bg-muted hover:bg-primary hover:text-primary-foreground items-center justify-center cursor-pointer">
							<div class="block w-fit h-fit">
								<GearIcon />
							</div>
						</div>
					</UserSettingsModal>
				</aside>
				<main class="w-full h-full">{props.children}</main>
			</div>
		</div>
	);
};

const AppLayoutWithPreferences: ParentComponent = (props) => (
	<UserPreferencesContextProvider>
		<SoundsContextProvider>
			<MutesContextProvider>
				<GifFavoritesContextProvider>
					<NotificationsContextProvider>
						<AppLayout>{props.children}</AppLayout>
					</NotificationsContextProvider>
				</GifFavoritesContextProvider>
			</MutesContextProvider>
		</SoundsContextProvider>
	</UserPreferencesContextProvider>
);

export default AppLayoutWithPreferences;
