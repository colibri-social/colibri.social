import {
	closestCenter,
	createSortable,
	DragDropProvider,
	DragDropSensors,
	type DragEvent,
	type Droppable,
	SortableProvider,
	useDragDropContext,
} from "@thisbeyond/solid-dnd";
import { batch, type Component, createMemo, createSignal, For } from "solid-js";
import { createStore } from "solid-js/store";
import type {
	SidebarCategoryData,
	SidebarChannelData,
	SidebarData,
} from "@/utils/sdk";
import { useGlobalContext } from "../../contexts/GlobalContext/index";
import { Plus } from "../../icons/Plus";
import { Button } from "../../shadcn-solid/Button";
import { Category, buildChannelOrder } from "../Category/Category";
import { CategoryCreationModal } from "./CategoryCreationModal";
import { actions } from "astro:actions";

const capturePositions = (
	els: Map<string, HTMLElement>,
	tops: Map<string, number>,
) => {
	for (const [rkey, el] of els) {
		tops.set(rkey, el.getBoundingClientRect().top);
	}
};

const animateToNewPositions = (
	els: Map<string, HTMLElement>,
	tops: Map<string, number>,
) => {
	for (const [rkey, el] of els) {
		const oldTop = tops.get(rkey);
		if (oldTop === undefined) continue;
		const newTop = el.getBoundingClientRect().top;
		const delta = oldTop - newTop;
		if (delta === 0) continue;
		el.animate(
			[
				{ transform: `translateY(${delta}px)` },
				{ transform: "translateY(0px)" },
			],
			{ duration: 150, easing: "ease" },
		);
	}
};

const SortableCategory: Component<{
	category: SidebarCategoryData;
	community: string;
	draggedCategory: SidebarCategoryData | undefined;
	channelOrder: string[];
	onChannelReorder: (categoryRkey: string, newOrder: string[]) => void;
	injectedChannels: SidebarChannelData[];
	dropTarget: { catRkey: string; insertBeforeId: string | null } | null;
}> = (props) => {
	const sortable = createSortable(props.category.rkey);
	const [, { onDragStart, onDragEnd: onDndDragEnd }] = useDragDropContext()!;

	let el: HTMLDivElement | undefined;

	onDragStart(({ draggable }) => {
		if (draggable.id === props.category.rkey) {
			el?.style.removeProperty("transition");
		} else {
			el?.style.setProperty("transition", "transform 200ms ease");
		}
	});

	onDndDragEnd(() => {
		el?.style.removeProperty("transition");
	});

	return (
		<div
			ref={(node) => {
				el = node;
				sortable.ref(node);
			}}
		>
			<div
				style={{
					"touch-action": "none",
				}}
				{...sortable.dragActivators}
			>
				<Category
					category={props.category}
					community={props.community}
					activeDraggable={sortable.isActiveDraggable}
					channelOrder={props.channelOrder}
					onChannelReorder={props.onChannelReorder}
					injectedChannels={props.injectedChannels}
					dropTarget={props.dropTarget}
				/>
			</div>
		</div>
	);
};

export const ChannelList: Component<{
	data: SidebarData;
	community: string;
	onCategoryReorder?: (categories: SidebarCategoryData[]) => void;
	categoryOrder: Array<string>;
}> = (props) => {
	const [globalContext] = useGlobalContext();

	/**
	 * Merges the server-fetched sidebar data with any optimistically added
	 * categories and channels from the global context, then builds the final
	 * list of categories (each with their channels attached) and any channels
	 * that have no category.
	 */
	const processed = createMemo(
		(): {
			categories: Array<SidebarCategoryData>;
			uncategorized: Array<SidebarChannelData>;
		} => {
			const serverCategoryRkeys = new Set(
				props.data.categories.map((c) => c.rkey),
			);

			const globalCategoriesForCommunity = globalContext.categories.filter(
				(c) => c.community === props.community,
			);
			const globalCategoryByRkey = new Map(
				globalCategoriesForCommunity.map((c) => [c.rkey, c]),
			);

			const removedChannelRkeys = new Set(globalContext.removedChannels);
			const removedCategoryRkeys = new Set(globalContext.removedCategories);

			const globalChannelsForCommunity = globalContext.addedChannels.filter(
				(ch) => ch.community === props.community,
			);

			const globalChannelByRkey = new Map(
				globalChannelsForCommunity.map((ch) => [ch.rkey, ch]),
			);

			const serverCategories: Array<SidebarCategoryData> = props.data.categories
				.filter((c) => !removedCategoryRkeys.has(c.rkey))
				.map((c) => {
					const override = globalCategoryByRkey.get(c.rkey);

					const channels: Array<SidebarChannelData> = c.channels
						.filter((ch) => !removedChannelRkeys.has(ch.rkey))
						.map((ch) => {
							const globalCh = globalChannelByRkey.get(ch.rkey);
							if (globalCh) {
								return {
									uri: ch.uri,
									rkey: globalCh.rkey,
									name: globalCh.name,
									description: ch.description,
									channel_type: globalCh.type,
									category_rkey: c.rkey,
								};
							}
							return ch;
						});

					return {
						uri: c.uri,
						rkey: c.rkey,
						name: override?.name ?? c.name,
						channel_order: override?.channelOrder ?? c.channel_order,
						channels,
					};
				});

			const optimisticCategories: Array<SidebarCategoryData> =
				globalCategoriesForCommunity
					.filter(
						(c) =>
							!serverCategoryRkeys.has(c.rkey) &&
							!removedCategoryRkeys.has(c.rkey),
					)
					.map((c) => ({
						uri: "",
						rkey: c.rkey,
						name: c.name,
						channel_order: c.channelOrder,
						channels: [],
					}));

			const unsortedCategories = [...serverCategories, ...optimisticCategories];

			const categories = unsortedCategories.sort(
				(a, b) =>
					props.categoryOrder?.indexOf(a.rkey) -
					props.categoryOrder?.indexOf(b.rkey),
			);

			const serverChannelRkeys = new Set([
				...props.data.categories.flatMap((c) =>
					c.channels.map((ch) => ch.rkey),
				),
				...props.data.uncategorized.map((ch) => ch.rkey),
			]);

			const uncategorized: Array<SidebarChannelData> = props.data.uncategorized
				.filter((ch) => !removedChannelRkeys.has(ch.rkey))
				.map((ch) => {
					const globalCh = globalChannelByRkey.get(ch.rkey);
					if (globalCh) {
						return {
							uri: ch.uri,
							rkey: globalCh.rkey,
							name: globalCh.name,
							description: ch.description,
							channel_type: globalCh.type,
							category_rkey: null,
						};
					}
					return ch;
				});

			// Append net-new optimistic channels into their category or uncategorized.
			const optimisticChannels = globalChannelsForCommunity.filter(
				(ch) =>
					!serverChannelRkeys.has(ch.rkey) && !removedChannelRkeys.has(ch.rkey),
			);

			for (const ch of optimisticChannels) {
				const sidebarChannel: SidebarChannelData = {
					uri: ch.uri || "",
					rkey: ch.rkey,
					name: ch.name,
					description: "",
					channel_type: ch.type,
					category_rkey: ch.category || null,
				};

				const category = categories.find((c) => c.rkey === ch.category);
				if (category) {
					category.channels.push(sidebarChannel);
				} else {
					uncategorized.push(sidebarChannel);
				}
			}

			return { categories, uncategorized };
		},
	);

	const [committedOrder, setCommittedOrder] = createSignal<
		SidebarCategoryData[] | null
	>(null);

	let dragBaseOrder: SidebarCategoryData[] | null = null;

	const sortedCategories = () => {
		const current = committedOrder();
		if (current) {
			const byRkey = new Map(processed().categories.map((c) => [c.rkey, c]));
			return current.map((c) => byRkey.get(c.rkey) ?? c);
		}
		return processed().categories;
	};

	const [draggingOrder, setDraggingOrder] = createSignal<
		SidebarCategoryData[] | null
	>(null);
	const [draggedCategory, setDraggedCategory] = createSignal<
		SidebarCategoryData | undefined
	>(undefined);

	const [channelOrders, setChannelOrders] = createStore<
		Record<string, string[]>
	>({});

	// Channels that have been moved cross-category, keyed by destination category rkey.
	const [movedChannels, setMovedChannels] = createStore<
		Record<string, SidebarChannelData[]>
	>({});

	// Seed channelOrders for any category not yet tracked, and append new channels
	// to categories that already have an order (handles optimistic channel creation).
	// IMPORTANT: Only add a channel to a category if it's not already tracked in
	// another category's order — prevents re-adding channels moved cross-category
	// (which are still present in the old category's server data until the server confirms).
	createMemo(() => {
		const allOrders = Object.entries(channelOrders as Record<string, string[]>);
		for (const cat of sortedCategories()) {
			const current = channelOrders[cat.rkey];
			if (!current) {
				setChannelOrders(cat.rkey, buildChannelOrder(cat));
			} else {
				const allOtherRkeys = new Set(
					allOrders
						.filter(([k]) => k !== cat.rkey)
						.flatMap(([, v]) => v),
				);
				const newRkeys = cat.channels
					.filter((ch) => !current.includes(ch.rkey) && !allOtherRkeys.has(ch.rkey))
					.map((ch) => ch.rkey);
				if (newRkeys.length > 0) {
					setChannelOrders(cat.rkey, [...current, ...newRkeys]);
				}
			}
		}
	});

	const handleChannelReorder = (categoryRkey: string, newOrder: string[]) => {
		setChannelOrders(categoryRkey, newOrder);
		actions.reorderChannels({
			channelRkey: "",
			sourceCategoryRkey: categoryRkey,
			sourceChannelOrder: newOrder,
			destCategoryRkey: categoryRkey,
			destChannelOrder: newOrder,
		});
	};
	const getChannelCategory = (channelId: string | number): string | undefined => {
		const id = String(channelId);
		for (const [catRkey, order] of Object.entries(channelOrders)) {
			if (order.includes(id)) return catRkey;
		}
		return undefined;
	};

	// Find channel data anywhere in the sidebar (searches server data for all categories).
	const findChannelData = (rkey: string): SidebarChannelData | undefined => {
		for (const cat of sortedCategories()) {
			const ch = cat.channels.find((c) => c.rkey === rkey);
			if (ch) return ch;
		}
		// Also check movedChannels in case it was already moved once.
		for (const channels of Object.values(movedChannels)) {
			const ch = channels.find((c) => c.rkey === rkey);
			if (ch) return ch;
		}
		return undefined;
	};

	// Drag state for channel moves.
	let draggedChannelId: string | undefined;
	let draggedChannelSourceCat: string | undefined;

	const categoryEls = new Map<string, HTMLElement>();
	const categoryTops = new Map<string, number>();

	const categoryRkeySet = createMemo(
		() => new Set(sortedCategories().map((c) => c.rkey)),
	);

	// Signal tracking the cross-category insertion point for visual feedback.
	const [channelDropTarget, setChannelDropTarget] = createSignal<{
		catRkey: string;
		insertBeforeId: string | null; // null = append to end
	} | null>(null);

	const isCategoryId = (id: string | number) =>
		categoryRkeySet().has(String(id));

	// For channel drags: use bounding-rect lookup on categoryEls to find the
	// category the cursor is actually over, then find the closest channel within it.
	// Falls back to closest channel globally if cursor is outside all categories.
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

		// Determine which category the draggable center is over via bounding rects.
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
			// Empty category: return the category sortable as the droppable.
			if (channelsInCat.length === 0) {
				return (
					droppables.find((d) => String(d.id) === targetCatRkey) ?? null
				);
			}
			const closest = closestCenter(draggable, channelsInCat, context);
			if (!closest) return droppables.find((d) => String(d.id) === targetCatRkey) ?? null;

			// When dragging from a different category: if cursor is below the last
			// channel's center, treat as an append-to-end drop (return the category container).
			if (draggedChannelSourceCat && draggedChannelSourceCat !== targetCatRkey) {
				const isLast = catChannelIds.indexOf(String(closest.id)) === catChannelIds.length - 1;
				if (isLast && draggable.transformed.center.y > closest.transformed.center.y) {
					return droppables.find((d) => String(d.id) === targetCatRkey) ?? null;
				}
			}

			return closest;
		}

		// Cursor outside all categories — fall back to closest channel anywhere.
		return closestCenter(
			draggable,
			droppables.filter((d) => !catRkeys.has(String(d.id))),
			context,
		);
	};

	const reorder = (
		list: SidebarCategoryData[],
		fromId: string | number,
		toId: string | number,
	): SidebarCategoryData[] => {
		const from = list.findIndex((c) => c.rkey === fromId);
		const to = list.findIndex((c) => c.rkey === toId);
		if (from === -1 || to === -1 || from === to) return list;
		const next = list.slice();
		next.splice(to, 0, ...next.splice(from, 1));
		return next;
	};

	const onDragStart = ({ draggable }: DragEvent) => {
		if (isCategoryId(draggable.id)) {
			dragBaseOrder = sortedCategories();
			setDraggedCategory(dragBaseOrder.find((c) => c.rkey === draggable.id));
		} else {
			draggedChannelId = String(draggable.id);
			draggedChannelSourceCat = getChannelCategory(draggable.id);
		}
	};

	const onDragOver = ({ draggable, droppable }: DragEvent) => {
		if (!draggable || !droppable) return;

		if (isCategoryId(draggable.id)) {
			if (!dragBaseOrder) return;
			capturePositions(categoryEls, categoryTops);
			setDraggingOrder(reorder(dragBaseOrder, draggable.id, droppable.id));
			queueMicrotask(() => animateToNewPositions(categoryEls, categoryTops));
			return;
		}

		// Track cross-category insertion point for visual feedback.
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
			catRkey: hoverCat,
			insertBeforeId: isCatDrop ? null : droppableId,
		});
	};

	const onDragEnd = ({ draggable, droppable }: DragEvent) => {
		setChannelDropTarget(null);

		if (!draggable || isCategoryId(draggable.id)) {
			// Category drag end.
			const final = draggingOrder();
			dragBaseOrder = null;
			setDraggingOrder(null);
			setDraggedCategory(undefined);

			if (!droppable || !final || draggable?.id === droppable.id) return;

			setCommittedOrder(final);
			actions.editCategoryOrder({
				community: props.community,
				categoryOrder: final.map((c) => c.rkey),
			});
			props.onCategoryReorder?.(final);
			return;
		}

		// Channel drag end — within-category reorders are handled by Category's own
		// onDragEnd subscription via onChannelReorder. Here we only handle cross-category.
		const channelId = draggedChannelId;
		const sourceCat = draggedChannelSourceCat;
		draggedChannelId = undefined;
		draggedChannelSourceCat = undefined;

		if (!channelId || !sourceCat || !droppable) return;

		const droppableId = String(droppable.id);
		const isCatDrop = isCategoryId(droppableId);
		const destCat = isCatDrop
			? droppableId
			: (getChannelCategory(droppableId) ?? sourceCat);

		if (destCat === sourceCat) return; // within-category: handled by Category's subscription

		// Cross-category drop: commit now (drag is over, safe to remount components).
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
			// Remove from source category's injected channels (if it was previously injected).
			setMovedChannels(sourceCat, (prev) =>
				(prev ?? []).filter((ch) => ch.rkey !== channelId),
			);
			// Add to destination category's injected channels so it renders there.
			if (channelData) {
				setMovedChannels(destCat, (prev) => [...(prev ?? []), channelData]);
			}
		});

		actions.reorderChannels({
			channelRkey: channelId,
			sourceCategoryRkey: sourceCat,
			sourceChannelOrder: srcOrder,
			destCategoryRkey: destCat,
			destChannelOrder: destOrder,
		});
	};

	const visibleCategories = () => draggingOrder() ?? sortedCategories();

	return (
		<DragDropProvider
			onDragStart={onDragStart}
			onDragOver={onDragOver}
			onDragEnd={onDragEnd}
			collisionDetector={collisionDetector}
		>
			<DragDropSensors />
			<nav class="w-full h-full flex flex-col">
				<SortableProvider ids={visibleCategories().map((c) => c.rkey)}>
					<For each={visibleCategories()}>
						{(category) => (
							<div
								class="relative"
								ref={(node) => categoryEls.set(category.rkey, node)}
							>
								<SortableCategory
									category={category}
									community={props.community}
									draggedCategory={draggedCategory()}
									channelOrder={
										channelOrders[category.rkey] ?? buildChannelOrder(category)
									}
									onChannelReorder={handleChannelReorder}
									injectedChannels={movedChannels[category.rkey] ?? []}
									dropTarget={
										channelDropTarget()?.catRkey === category.rkey
											? channelDropTarget()
											: null
									}
								/>
							</div>
						)}
					</For>
				</SortableProvider>
				<CategoryCreationModal community={props.community}>
					<Button
						size="sm"
						class="w-[calc(100%-2rem)] mx-4 mt-4"
						variant="ghost"
					>
						<Plus />
						<span>Add new category</span>
					</Button>
				</CategoryCreationModal>
			</nav>
		</DragDropProvider>
	);
};
