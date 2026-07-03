// import { actions } from "astro:actions"; // TODO: replace with the new XrpcClient persistence layer.
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
	createMemo,
	createSignal,
	For,
	Show,
} from "solid-js";
import { createStore } from "solid-js/store";
import PlusIcon from "~icons/ph/plus";
import type { Channel } from "../../../atproto/xrpc/social/colibri/community/listChannels";
import {
	useCommunityContext,
	usePermissions,
} from "../../../contexts/Community";
import { useUserContext } from "../../../contexts/User";
import { LongPressSensors } from "../../../utils/create-longpress-sensor";
import {
	animateToNewPositions,
	capturePositions,
	reorderList,
} from "../../../utils/drag";
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

export const ChannelList: Component<{
	onCategoryReorder?: (categories: CategoryWithChannels[]) => void;
}> = (props) => {
	const community = useCommunityContext();
	const processed = useProcessedSidebar();
	const user = useUserContext();
	const {
		canCreateCategory: _canCreateCategory,
		canUpdateCategory: _canUpdateCategory,
	} = usePermissions();
	const canCreateCategory = () => _canCreateCategory(user.did);
	const canUpdateCategory = () => _canUpdateCategory(user.did);

	const [committedOrder, setCommittedOrder] = createSignal<
		CategoryWithChannels[] | null
	>(null);

	let dragBaseOrder: CategoryWithChannels[] | null = null;

	const sortedCategories = () => {
		const current = committedOrder();
		if (current) {
			const byUri = new Map(processed().categories.map((c) => [c.uri, c]));
			return current.map((c) => byUri.get(c.uri) ?? c);
		}
		return processed().categories;
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

	createMemo(() => {
		const allOrders = Object.entries(channelOrders as Record<string, string[]>);
		for (const cat of sortedCategories()) {
			const current = channelOrders[cat.uri];
			if (!current) {
				setChannelOrders(cat.uri, buildChannelOrder(cat));
			} else {
				const allOtherUris = new Set(
					allOrders.filter(([k]) => k !== cat.uri).flatMap(([, v]) => v),
				);
				const newUris = cat.channels
					.filter(
						(ch) => !current.includes(ch.uri) && !allOtherUris.has(ch.uri),
					)
					.map((ch) => ch.uri);
				if (newUris.length > 0) {
					setChannelOrders(cat.uri, [...current, ...newUris]);
				}
			}
		}
	});

	const handleChannelReorder = (categoryUri: string, newOrder: string[]) => {
		setChannelOrders(categoryUri, newOrder);
		user.xrpc.social.colibri.community
			.reorderChannels(categoryUri, newOrder)
			.catch(() => {});
	};

	const getChannelCategory = (
		channelId: string | number,
	): string | undefined => {
		const id = String(channelId);
		for (const [catUri, order] of Object.entries(channelOrders)) {
			if (order.includes(id)) return catUri;
		}
		return undefined;
	};

	const findChannelData = (uri: string): Channel | undefined => {
		for (const cat of sortedCategories()) {
			const ch = cat.channels.find((c) => c.uri === uri);
			if (ch) return ch;
		}
		for (const channels of Object.values(movedChannels)) {
			const ch = channels.find((c) => c.uri === uri);
			if (ch) return ch;
		}
		return undefined;
	};

	let draggedChannelId: string | undefined;
	let draggedChannelSourceCat: string | undefined;

	const categoryEls = new Map<string, HTMLElement>();
	const categoryTops = new Map<string, number>();

	const categoryUriSet = createMemo(
		() => new Set(sortedCategories().map((c) => c.uri)),
	);

	const [channelDropTarget, setChannelDropTarget] =
		createSignal<ChannelDropTarget | null>(null);

	const isCategoryId = (id: string | number) =>
		categoryUriSet().has(String(id));

	const collisionDetector = (
		draggable: Parameters<typeof closestCenter>[0],
		droppables: Parameters<typeof closestCenter>[1],
		context: Parameters<typeof closestCenter>[2],
	): Droppable | null => {
		const catUris = categoryUriSet();

		if (catUris.has(String(draggable.id))) {
			return closestCenter(
				draggable,
				droppables.filter((d) => catUris.has(String(d.id))),
				context,
			);
		}

		const cy = draggable.transformed.center.y;
		let targetCatUri: string | undefined;
		for (const [catUri, el] of categoryEls) {
			const rect = el.getBoundingClientRect();
			if (cy >= rect.top && cy <= rect.bottom) {
				targetCatUri = catUri;
				break;
			}
		}

		if (targetCatUri) {
			const catChannelIds = channelOrders[targetCatUri] ?? [];
			const channelsInCat = droppables.filter((d) =>
				catChannelIds.includes(String(d.id)),
			);
			if (channelsInCat.length === 0) {
				return droppables.find((d) => String(d.id) === targetCatUri) ?? null;
			}
			const closest = closestCenter(draggable, channelsInCat, context);
			if (!closest)
				return droppables.find((d) => String(d.id) === targetCatUri) ?? null;

			if (draggedChannelSourceCat && draggedChannelSourceCat !== targetCatUri) {
				const isLast =
					catChannelIds.indexOf(String(closest.id)) ===
					catChannelIds.length - 1;
				if (
					isLast &&
					draggable.transformed.center.y > closest.transformed.center.y
				) {
					return droppables.find((d) => String(d.id) === targetCatUri) ?? null;
				}
			}

			return closest;
		}

		return closestCenter(
			draggable,
			droppables.filter((d) => !catUris.has(String(d.id))),
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
			list.findIndex((c) => c.uri === fromId),
			list.findIndex((c) => c.uri === toId),
		);

	const onDragStart = ({ draggable }: DragEvent) => {
		if (!canUpdateCategory()) return;

		if (isCategoryId(draggable.id)) {
			dragBaseOrder = sortedCategories();
			setDraggedCategory(dragBaseOrder.find((c) => c.uri === draggable.id));
		} else {
			draggedChannelId = String(draggable.id);
			draggedChannelSourceCat = getChannelCategory(draggable.id);
		}
	};

	const onDragOver = ({ draggable, droppable }: DragEvent) => {
		if (!draggable || !droppable || !canUpdateCategory()) return;

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
			categoryUri: hoverCat,
			insertBeforeUri: isCatDrop ? null : droppableId,
		});
	};

	const onDragEnd = ({ draggable, droppable }: DragEvent) => {
		if (!canUpdateCategory()) return;

		setChannelDropTarget(null);

		if (!draggable || isCategoryId(draggable.id)) {
			const final = draggingOrder();
			dragBaseOrder = null;
			setDraggingOrder(null);
			setDraggedCategory(undefined);

			if (!droppable || !final || draggable?.id === droppable.id) return;

			setCommittedOrder(final);
			user.xrpc.social.colibri.community
				.reorderCategories(
					community().community.uri,
					final.map((c) => c.uri),
				)
				.catch(() => {});
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
				(prev ?? []).filter((ch) => ch.uri !== channelId),
			);
			if (channelData) {
				setMovedChannels(destCat, (prev) => [...(prev ?? []), channelData]);
			}
		});

		user.xrpc.social.colibri.community
			.reorderChannels(sourceCat, srcOrder)
			.catch(() => {});
		user.xrpc.social.colibri.community
			.reorderChannels(destCat, destOrder)
			.catch(() => {});
	};

	const visibleCategories = () => draggingOrder() ?? sortedCategories();

	const [settingsChannelUri, setSettingsChannelUri] = createSignal<
		string | null
	>(null);
	const [channelSettingsOpen, setChannelSettingsOpen] = createSignal(false);
	const settingsChannel = createMemo(() => {
		const uri = settingsChannelUri();
		return uri ? (findChannelData(uri) ?? null) : null;
	});
	const openChannelSettings = (uri: string) => {
		setSettingsChannelUri(uri);
		setChannelSettingsOpen(true);
	};

	const [settingsCategoryUri, setSettingsCategoryUri] = createSignal<
		string | null
	>(null);
	const [categorySettingsOpen, setCategorySettingsOpen] = createSignal(false);
	const settingsCategory = createMemo(() => {
		const uri = settingsCategoryUri();
		return uri ? (sortedCategories().find((c) => c.uri === uri) ?? null) : null;
	});
	const openCategorySettings = (uri: string) => {
		setSettingsCategoryUri(uri);
		setCategorySettingsOpen(true);
	};

	const [creationCategoryUri, setCreationCategoryUri] = createSignal<
		string | null
	>(null);
	const [channelCreationOpen, setChannelCreationOpen] = createSignal(false);
	const openChannelCreation = (uri: string) => {
		setCreationCategoryUri(uri);
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
			<nav class="w-full h-full flex flex-col overflow-auto pb-4">
				<SortableProvider ids={visibleCategories().map((c) => c.uri)}>
					<For each={visibleCategories()}>
						{(category) => (
							<div
								class="relative"
								ref={(node) => categoryEls.set(category.uri, node)}
							>
								<SortableCategory
									category={category}
									communityUri={community().community.uri}
									channelOrder={
										channelOrders[category.uri] ?? buildChannelOrder(category)
									}
									onChannelReorder={handleChannelReorder}
									injectedChannels={movedChannels[category.uri] ?? []}
									dropTarget={
										channelDropTarget()?.categoryUri === category.uri
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
				<Show when={creationCategoryUri()}>
					{(uri) => (
						<ChannelCreationModal
							category={uri()}
							community={community().community.uri}
							open={channelCreationOpen}
							setOpen={setChannelCreationOpen}
						/>
					)}
				</Show>
				<Show when={canCreateCategory()}>
					<CategoryCreationModal community={community().community.uri}>
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
