import { actions } from "astro:actions";
import {
	closestCenter,
	DragDropProvider,
	DragDropSensors,
	type DragEvent,
	type Droppable,
	SortableProvider,
} from "@thisbeyond/solid-dnd";
import { batch, type Component, createMemo, createSignal, For } from "solid-js";
import { createStore } from "solid-js/store";
import type {
	SidebarCategoryData,
	SidebarChannelData,
	SidebarData,
} from "@/utils/sdk";
import { Plus } from "../../icons/Plus";
import { Button } from "../../shadcn-solid/Button";
import {
	animateToNewPositions,
	capturePositions,
	reorderList,
} from "../../utils/drag";
import {
	buildChannelOrder,
	type ChannelDropTarget,
} from "../Category/Category";
import { CategoryCreationModal } from "./CategoryCreationModal";
import { SortableCategory } from "./SortableCategory";
import { useProcessedSidebar } from "./useProcessedSidebar";

export const ChannelList: Component<{
	data: SidebarData;
	community: string;
	onCategoryReorder?: (categories: SidebarCategoryData[]) => void;
	categoryOrder: Array<string>;
}> = (props) => {
	const processed = useProcessedSidebar(props);

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
	const [_draggedCategory, setDraggedCategory] = createSignal<
		SidebarCategoryData | undefined
	>(undefined);

	const [channelOrders, setChannelOrders] = createStore<
		Record<string, string[]>
	>({});

	const [movedChannels, setMovedChannels] = createStore<
		Record<string, SidebarChannelData[]>
	>({});

	createMemo(() => {
		const allOrders = Object.entries(channelOrders as Record<string, string[]>);
		for (const cat of sortedCategories()) {
			const current = channelOrders[cat.rkey];
			if (!current) {
				setChannelOrders(cat.rkey, buildChannelOrder(cat));
			} else {
				const allOtherRkeys = new Set(
					allOrders.filter(([k]) => k !== cat.rkey).flatMap(([, v]) => v),
				);
				const newRkeys = cat.channels
					.filter(
						(ch) => !current.includes(ch.rkey) && !allOtherRkeys.has(ch.rkey),
					)
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

	const getChannelCategory = (
		channelId: string | number,
	): string | undefined => {
		const id = String(channelId);
		for (const [catRkey, order] of Object.entries(channelOrders)) {
			if (order.includes(id)) return catRkey;
		}
		return undefined;
	};

	const findChannelData = (rkey: string): SidebarChannelData | undefined => {
		for (const cat of sortedCategories()) {
			const ch = cat.channels.find((c) => c.rkey === rkey);
			if (ch) return ch;
		}
		for (const channels of Object.values(movedChannels)) {
			const ch = channels.find((c) => c.rkey === rkey);
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
		list: SidebarCategoryData[],
		fromId: string | number,
		toId: string | number,
	): SidebarCategoryData[] =>
		reorderList(
			list,
			list.findIndex((c) => c.rkey === fromId),
			list.findIndex((c) => c.rkey === toId),
		);

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
			setDraggingOrder(
				reorderCategories(dragBaseOrder, draggable.id, droppable.id),
			);
			queueMicrotask(() => animateToNewPositions(categoryEls, categoryTops));
			return;
		}

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
			setMovedChannels(sourceCat, (prev) =>
				(prev ?? []).filter((ch) => ch.rkey !== channelId),
			);
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
