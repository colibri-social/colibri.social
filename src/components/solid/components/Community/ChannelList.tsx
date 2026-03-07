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
import { type Component, createMemo, createSignal, For } from "solid-js";
import type {
	SidebarCategoryData,
	SidebarChannelData,
	SidebarData,
} from "@/utils/sdk";
import { useGlobalContext } from "../../contexts/GlobalContext/index";
import { Plus } from "../../icons/Plus";
import { Button } from "../../shadcn-solid/Button";
import { Category } from "../Category/Category";
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

	const categoryEls = new Map<string, HTMLElement>();
	const categoryTops = new Map<string, number>();

	// Set of category rkeys — used to distinguish category drags from channel drags.
	const categoryRkeySet = createMemo(
		() => new Set(sortedCategories().map((c) => c.rkey)),
	);

	const isCategoryDrag = (id: string | number) =>
		categoryRkeySet().has(String(id));

	// Collision detector: categories only collide with categories, channels only
	// with channels. This prevents a channel drag from snapping to a category.
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
		if (!isCategoryDrag(draggable.id)) return;
		dragBaseOrder = sortedCategories();
		setDraggedCategory(dragBaseOrder.find((c) => c.rkey === draggable.id));
	};

	const onDragOver = ({ draggable, droppable }: DragEvent) => {
		if (!draggable || !droppable) return;
		if (!isCategoryDrag(draggable.id) || !dragBaseOrder) return;
		capturePositions(categoryEls, categoryTops);
		setDraggingOrder(reorder(dragBaseOrder, draggable.id, droppable.id));
		queueMicrotask(() => animateToNewPositions(categoryEls, categoryTops));
	};

	const onDragEnd = ({ draggable, droppable }: DragEvent) => {
		// Channel drags are handled inside each Category component.
		if (!draggable || !isCategoryDrag(draggable.id)) {
			dragBaseOrder = null;
			setDraggingOrder(null);
			setDraggedCategory(undefined);
			return;
		}

		const final = draggingOrder();
		dragBaseOrder = null;
		setDraggingOrder(null);
		setDraggedCategory(undefined);

		if (!droppable || !final) return;
		if (draggable.id === droppable.id) return;

		setCommittedOrder(final);

		actions.editCategoryOrder({
			community: props.community,
			categoryOrder: final.map((c) => c.rkey),
		});

		props.onCategoryReorder?.(final);
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
			{/*<DragOverlay>
				{(draggable) => {
					const cat = draggable
						? visibleCategories().find((c) => c.rkey === draggable.id)
						: undefined;
					return (
						<Show when={cat}>
							{(resolved) => (
								<div class="px-4 py-2 bg-card border border-border rounded-sm shadow-lg opacity-90 text-sm font-medium">
									{resolved().name}
								</div>
							)}
						</Show>
					);
				}}
			</DragOverlay>*/}
		</DragDropProvider>
	);
};
