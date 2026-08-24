import {
	closestCenter,
	DragDropProvider,
	type DragEvent,
	type Droppable,
	SortableProvider,
} from "@thisbeyond/solid-dnd";
import {
	batch,
	type Component,
	createEffect,
	createMemo,
	createSignal,
	For,
	Show,
	untrack,
} from "solid-js";
import { createStore } from "solid-js/store";
import PlusIcon from "~icons/ph/plus";
import { colibri } from "../../../atproto/lexicons";
import { spaceSkey } from "../../../atproto/space-ref";
import { clientForManagingApp } from "../../../atproto/xrpc";
import {
	useCommunityContext,
	usePermissions,
} from "../../../contexts/Community";
import type { Channel } from "../../../contexts/community-payload";
import { useUserContext } from "../../../contexts/User";
import { showError } from "../../../errors/show-error";
import { LongPressSensors } from "../../../utils/create-longpress-sensor";
import {
	animateToNewPositions,
	capturePositions,
	reorderList,
} from "../../../utils/drag";
import { createLogger } from "../../../utils/logger";
import { Button } from "../../ui/Button";
import {
	buildChannelOrder,
	type CategoryWithChannels,
	type ChannelDropTarget,
} from "./Category";
import { CategoryCreationModal } from "./CategoryCreationModal";
import { CategorySettingsModal } from "./CategorySettingsModal";
import { ChannelCreationModal } from "./ChannelCreationModal";
import { ChannelSettingsModal } from "./ChannelSettingsModal";
import { SortableCategory } from "./SortableCategory";
import { useProcessedSidebar } from "./useProcessedSidebar";

const log = createLogger("community");

export const ChannelList: Component<{
	onCategoryReorder?: (categories: CategoryWithChannels[]) => void;
}> = (props) => {
	const community = useCommunityContext();
	const processed = useProcessedSidebar();
	const user = useUserContext();
	const {
		canCreateCategory: _canCreateCategory,
		canUpdateCategory: _canUpdateCategory,
		canUpdateChannel: _canUpdateChannel,
	} = usePermissions();
	const canCreateCategory = () => _canCreateCategory(user.did);
	const canUpdateCategory = () => _canUpdateCategory(user.did);
	const canUpdateChannel = () => _canUpdateChannel(user.did);

	const client = () =>
		clientForManagingApp(user.atproto.agent, community().community.managingApp);

	const [committedOrder, setCommittedOrder] = createSignal<
		CategoryWithChannels[] | null
	>(null);

	let dragBaseOrder: CategoryWithChannels[] | null = null;

	const sortedCategories = () => {
		const current = committedOrder();
		if (!current) return processed().categories;
		const byRkey = new Map(processed().categories.map((c) => [c.rkey, c]));
		const ordered = current
			.map((c) => byRkey.get(c.rkey))
			.filter((c): c is CategoryWithChannels => c !== undefined);
		const seen = new Set(ordered.map((c) => c.rkey));
		return [
			...ordered,
			...processed().categories.filter((c) => !seen.has(c.rkey)),
		];
	};

	const [draggingOrder, setDraggingOrder] = createSignal<
		CategoryWithChannels[] | null
	>(null);
	const [_draggedCategory, setDraggedCategory] = createSignal<
		CategoryWithChannels | undefined
	>(undefined);

	const [channelOrders, setChannelOrders] = createStore<
		Record<string, string[]>
	>({});

	const [movedChannels, setMovedChannels] = createStore<
		Record<string, Channel[]>
	>({});

	const [pendingOrders, setPendingOrders] = createStore<
		Record<string, string[] | undefined>
	>({});

	const [dragActive, setDragActive] = createSignal(false);

	const sameOrder = (a: string[] | undefined, b: string[]) =>
		!!a &&
		a.length === b.length &&
		a.every((space, index) => space === b[index]);

	createEffect(() => {
		const categories = sortedCategories();
		if (dragActive()) return;

		batch(() => {
			const known = new Set<string>();
			for (const category of categories) {
				known.add(category.rkey);
				const serverOrder = buildChannelOrder(category);
				const pending = pendingOrders[category.rkey];
				if (pending) {
					if (!sameOrder(pending, serverOrder)) continue;
					setPendingOrders(category.rkey, undefined);
				}
				if (
					!sameOrder(
						untrack(() => channelOrders[category.rkey]),
						serverOrder,
					)
				) {
					setChannelOrders(category.rkey, serverOrder);
				}
				const injected = untrack(() => movedChannels[category.rkey]);
				if (injected?.length) {
					const settled = new Set(category.channels.map((ch) => ch.space));
					const stillPending = injected.filter((ch) => !settled.has(ch.space));
					if (stillPending.length !== injected.length) {
						setMovedChannels(category.rkey, stillPending);
					}
				}
			}
			for (const rkey of untrack(() => Object.keys(channelOrders))) {
				if (known.has(rkey)) continue;
				setChannelOrders(rkey, undefined as unknown as string[]);
				setPendingOrders(rkey, undefined);
				setMovedChannels(rkey, undefined as unknown as Channel[]);
			}
		});
	});

	const handleChannelReorder = (categoryRkey: string, newOrder: string[]) => {
		batch(() => {
			setChannelOrders(categoryRkey, newOrder);
			setPendingOrders(categoryRkey, newOrder);
		});
		void client()
			.call(colibri.channel.reorder.main, {
				body: {
					community: community().community.did,
					category: categoryRkey,
					channels: newOrder.map((space) => spaceSkey(space) ?? space),
				},
			})
			.then((res) => {
				if (res.ok) return;
				log.error("reordering channels failed", { code: res.error.code });
				showError(res.error, {
					fallbackTitle: "Failed to save the channel order.",
				});
				setPendingOrders(categoryRkey, undefined);
			});
	};

	const getChannelCategory = (
		channelId: string | number,
	): string | undefined => {
		const id = String(channelId);
		for (const [catRkey, order] of Object.entries(channelOrders)) {
			if (order.includes(id)) return catRkey;
		}
		return undefined;
	};

	const findChannelData = (space: string): Channel | undefined => {
		for (const cat of sortedCategories()) {
			const ch = cat.channels.find((c) => c.space === space);
			if (ch) return ch;
		}
		for (const channels of Object.values(movedChannels)) {
			const ch = channels.find((c) => c.space === space);
			if (ch) return ch;
		}
		return undefined;
	};

	let draggedChannelId: string | undefined;
	let draggedChannelSourceCat: string | undefined;

	const categoryEls = new Map<string, HTMLElement>();
	const categoryTops = new Map<string, number>();

	const categoryRkeySet = createMemo(
		() => new Set(sortedCategories().map((c) => c.rkey)),
	);

	const [channelDropTarget, setChannelDropTarget] =
		createSignal<ChannelDropTarget | null>(null);

	const isCategoryId = (id: string | number) =>
		categoryRkeySet().has(String(id));

	const collisionDetector = (
		draggable: Parameters<typeof closestCenter>[0],
		droppables: Parameters<typeof closestCenter>[1],
		context: Parameters<typeof closestCenter>[2],
	): Droppable | null => {
		const catRkeys = categoryRkeySet();

		if (catRkeys.has(String(draggable.id))) {
			return closestCenter(
				draggable,
				droppables.filter((d) => catRkeys.has(String(d.id))),
				context,
			);
		}

		const cy = draggable.transformed.center.y;
		let targetCatRkey: string | undefined;
		for (const [catRkey, el] of categoryEls) {
			const rect = el.getBoundingClientRect();
			if (cy >= rect.top && cy <= rect.bottom) {
				targetCatRkey = catRkey;
				break;
			}
		}

		if (targetCatRkey) {
			const catChannelIds = channelOrders[targetCatRkey] ?? [];
			const channelsInCat = droppables.filter((d) =>
				catChannelIds.includes(String(d.id)),
			);
			if (channelsInCat.length === 0) {
				return droppables.find((d) => String(d.id) === targetCatRkey) ?? null;
			}
			const closest = closestCenter(draggable, channelsInCat, context);
			if (!closest)
				return droppables.find((d) => String(d.id) === targetCatRkey) ?? null;

			if (
				draggedChannelSourceCat &&
				draggedChannelSourceCat !== targetCatRkey
			) {
				const isLast =
					catChannelIds.indexOf(String(closest.id)) ===
					catChannelIds.length - 1;
				if (
					isLast &&
					draggable.transformed.center.y > closest.transformed.center.y
				) {
					return droppables.find((d) => String(d.id) === targetCatRkey) ?? null;
				}
			}

			return closest;
		}

		return closestCenter(
			draggable,
			droppables.filter((d) => !catRkeys.has(String(d.id))),
			context,
		);
	};

	const reorderCategories = (
		list: CategoryWithChannels[],
		fromId: string | number,
		toId: string | number,
	): CategoryWithChannels[] =>
		reorderList(
			list,
			list.findIndex((c) => c.rkey === fromId),
			list.findIndex((c) => c.rkey === toId),
		);

	const onDragStart = ({ draggable }: DragEvent) => {
		setDragActive(true);

		if (isCategoryId(draggable.id)) {
			if (!canUpdateCategory()) return;
			dragBaseOrder = sortedCategories();
			setDraggedCategory(dragBaseOrder.find((c) => c.rkey === draggable.id));
		} else {
			if (!canUpdateChannel()) return;
			draggedChannelId = String(draggable.id);
			draggedChannelSourceCat = getChannelCategory(draggable.id);
		}
	};

	const onDragOver = ({ draggable, droppable }: DragEvent) => {
		if (!draggable || !droppable) return;

		if (isCategoryId(draggable.id)) {
			if (!canUpdateCategory()) return;
			if (!dragBaseOrder) return;
			capturePositions(categoryEls, categoryTops);
			setDraggingOrder(
				reorderCategories(dragBaseOrder, draggable.id, droppable.id),
			);
			queueMicrotask(() => animateToNewPositions(categoryEls, categoryTops));
			return;
		}

		if (!canUpdateChannel()) return;

		const droppableId = String(droppable.id);
		const isCatDrop = isCategoryId(droppableId);
		const hoverCat = isCatDrop
			? droppableId
			: (getChannelCategory(droppableId) ?? draggedChannelSourceCat);

		if (!hoverCat || hoverCat === draggedChannelSourceCat) {
			setChannelDropTarget(null);
			return;
		}

		setChannelDropTarget({
			categoryRkey: hoverCat,
			insertBeforeSpace: isCatDrop ? null : droppableId,
		});
	};

	const persistCategoryOrder = async (
		final: CategoryWithChannels[],
		previous: CategoryWithChannels[] | null,
	) => {
		const res = await client().call(colibri.community.reorderCategories.main, {
			body: {
				community: community().community.did,
				categories: final.map((c) => c.rkey),
			},
		});
		if (res.ok) return;
		log.error("reordering categories failed", { code: res.error.code });
		showError(res.error, {
			fallbackTitle: "Failed to save the category order.",
		});
		setCommittedOrder(previous);
	};

	const persistChannelMove = async (
		channelSpace: string,
		sourceCat: string,
		destCat: string,
		destOrder: string[],
	) => {
		const rollback = () =>
			batch(() => {
				setPendingOrders(sourceCat, undefined);
				setPendingOrders(destCat, undefined);
				setMovedChannels(destCat, (prev) =>
					(prev ?? []).filter((ch) => ch.space !== channelSpace),
				);
			});

		const moved = await client().call(colibri.channel.update.main, {
			body: { channel: channelSpace, category: destCat },
		});
		if (!moved.ok) {
			log.error("moving a channel failed", { code: moved.error.code });
			showError(moved.error, { fallbackTitle: "Failed to move the channel." });
			rollback();
			return;
		}

		const reordered = await client().call(colibri.channel.reorder.main, {
			body: {
				community: community().community.did,
				category: destCat,
				channels: destOrder.map((space) => spaceSkey(space) ?? space),
			},
		});
		if (!reordered.ok) {
			log.error("reordering channels after a move failed", {
				code: reordered.error.code,
			});
			showError(reordered.error, {
				fallbackTitle: "Failed to save the channel order.",
			});
			rollback();
		}
	};

	const onDragEnd = ({ draggable, droppable }: DragEvent) => {
		try {
			setChannelDropTarget(null);

			if (!draggable || isCategoryId(draggable.id)) {
				const final = draggingOrder();
				dragBaseOrder = null;
				setDraggingOrder(null);
				setDraggedCategory(undefined);

				if (!canUpdateCategory()) return;
				if (!droppable || !final || draggable?.id === droppable.id) return;

				const previous = committedOrder();
				setCommittedOrder(final);
				void persistCategoryOrder(final, previous);
				props.onCategoryReorder?.(final);
				return;
			}

			const channelId = draggedChannelId;
			const sourceCat = draggedChannelSourceCat;
			draggedChannelId = undefined;
			draggedChannelSourceCat = undefined;

			if (!canUpdateChannel()) return;
			if (!channelId || !sourceCat || !droppable) return;

			const droppableId = String(droppable.id);
			const isCatDrop = isCategoryId(droppableId);
			const destCat = isCatDrop
				? droppableId
				: (getChannelCategory(droppableId) ?? sourceCat);

			if (destCat === sourceCat) return;

			const srcOrder = (channelOrders[sourceCat] ?? []).filter(
				(id) => id !== channelId,
			);

			const destOrderBefore = channelOrders[destCat] ?? [];
			let insertAt = isCatDrop
				? destOrderBefore.length
				: destOrderBefore.indexOf(droppableId);
			if (insertAt === -1) insertAt = destOrderBefore.length;

			const destOrder = [
				...destOrderBefore.slice(0, insertAt),
				channelId,
				...destOrderBefore.slice(insertAt),
			];

			const channelData = findChannelData(channelId);

			batch(() => {
				setChannelOrders(sourceCat, srcOrder);
				setChannelOrders(destCat, destOrder);
				setPendingOrders(sourceCat, srcOrder);
				setPendingOrders(destCat, destOrder);
				setMovedChannels(sourceCat, (prev) =>
					(prev ?? []).filter((ch) => ch.space !== channelId),
				);
				if (channelData) {
					setMovedChannels(destCat, (prev) => [...(prev ?? []), channelData]);
				}
			});

			void persistChannelMove(channelId, sourceCat, destCat, destOrder);
		} finally {
			setDragActive(false);
		}
	};

	const visibleCategories = () => draggingOrder() ?? sortedCategories();

	const [settingsChannelSpace, setSettingsChannelSpace] = createSignal<
		string | null
	>(null);
	const [channelSettingsOpen, setChannelSettingsOpen] = createSignal(false);
	const settingsChannel = createMemo(() => {
		const space = settingsChannelSpace();
		return space ? (findChannelData(space) ?? null) : null;
	});
	const openChannelSettings = (space: string) => {
		setSettingsChannelSpace(space);
		setChannelSettingsOpen(true);
	};

	const [settingsCategoryRkey, setSettingsCategoryRkey] = createSignal<
		string | null
	>(null);
	const [categorySettingsOpen, setCategorySettingsOpen] = createSignal(false);
	const settingsCategory = createMemo(() => {
		const rkey = settingsCategoryRkey();
		return rkey
			? (sortedCategories().find((c) => c.rkey === rkey) ?? null)
			: null;
	});
	const openCategorySettings = (rkey: string) => {
		setSettingsCategoryRkey(rkey);
		setCategorySettingsOpen(true);
	};

	const [creationCategoryRkey, setCreationCategoryRkey] = createSignal<
		string | null
	>(null);
	const [channelCreationOpen, setChannelCreationOpen] = createSignal(false);
	const openChannelCreation = (rkey: string) => {
		setCreationCategoryRkey(rkey);
		setChannelCreationOpen(true);
	};

	return (
		<DragDropProvider
			onDragStart={onDragStart}
			onDragOver={onDragOver}
			onDragEnd={onDragEnd}
			collisionDetector={collisionDetector}
		>
			<LongPressSensors />
			<nav class="w-full h-full flex flex-col overflow-y-auto overflow-x-clip pb-4">
				<SortableProvider ids={visibleCategories().map((c) => c.rkey)}>
					<For each={visibleCategories()}>
						{(category) => (
							<div
								class="relative"
								ref={(node) => categoryEls.set(category.rkey, node)}
							>
								<SortableCategory
									category={category}
									communityDid={community().community.did}
									channelOrder={
										channelOrders[category.rkey] ?? buildChannelOrder(category)
									}
									onChannelReorder={handleChannelReorder}
									injectedChannels={movedChannels[category.rkey] ?? []}
									dropTarget={
										channelDropTarget()?.categoryRkey === category.rkey
											? channelDropTarget()
											: null
									}
									onOpenChannelSettings={openChannelSettings}
									onOpenCategorySettings={openCategorySettings}
									onOpenChannelCreation={openChannelCreation}
								/>
							</div>
						)}
					</For>
				</SortableProvider>
				<Show when={settingsChannel()}>
					{(channel) => (
						<ChannelSettingsModal
							channel={channel()}
							open={channelSettingsOpen}
							setOpen={setChannelSettingsOpen}
						/>
					)}
				</Show>
				<Show when={settingsCategory()}>
					{(category) => (
						<CategorySettingsModal
							category={category()}
							open={categorySettingsOpen}
							setOpen={setCategorySettingsOpen}
						/>
					)}
				</Show>
				<Show when={creationCategoryRkey()}>
					{(rkey) => (
						<ChannelCreationModal
							category={rkey()}
							community={community().community.did}
							open={channelCreationOpen}
							setOpen={setChannelCreationOpen}
						/>
					)}
				</Show>
				<Show when={canCreateCategory()}>
					<CategoryCreationModal community={community().community.did}>
						<Button
							size="sm"
							class="w-[calc(100%-2rem)] mx-4 mt-4"
							variant="ghost"
						>
							<PlusIcon width={12} height={12} />
							<span>Add new category</span>
						</Button>
					</CategoryCreationModal>
				</Show>
			</nav>
		</DragDropProvider>
	);
};
