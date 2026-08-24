import { createSortable, useDragDropContext } from "@thisbeyond/solid-dnd";
import type { Component } from "solid-js";
import { usePermissions } from "../../../contexts/Community";
import type { Channel } from "../../../contexts/community-payload";
import { useUserContext } from "../../../contexts/User";
import {
	Category,
	type CategoryWithChannels,
	type ChannelDropTarget,
} from "./Category";

export const SortableCategory: Component<{
	category: CategoryWithChannels;
	communityDid: string;
	channelOrder: string[];
	onChannelReorder: (categoryRkey: string, newOrder: string[]) => void;
	injectedChannels: Channel[];
	dropTarget: ChannelDropTarget | null;
	onOpenChannelSettings: (channelSpace: string) => void;
	onOpenCategorySettings: (categoryRkey: string) => void;
	onOpenChannelCreation: (categoryRkey: string) => void;
}> = (props) => {
	const sortable = createSortable(props.category.rkey);
	const [, { onDragStart, onDragEnd: onDndDragEnd }] = useDragDropContext()!;
	const user = useUserContext();
	const { canUpdateCategory: _canUpdateCategory } = usePermissions();
	const canManage = () => _canUpdateCategory(user.did);

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
				style={{ "touch-action": "pan-y" }}
				{...(canManage() ? sortable.dragActivators : {})}
			>
				<Category
					category={props.category}
					communityDid={props.communityDid}
					activeDraggable={sortable.isActiveDraggable}
					channelOrder={props.channelOrder}
					onChannelReorder={props.onChannelReorder}
					injectedChannels={props.injectedChannels}
					dropTarget={props.dropTarget}
					onOpenChannelSettings={props.onOpenChannelSettings}
					onOpenCategorySettings={props.onOpenCategorySettings}
					onOpenChannelCreation={props.onOpenChannelCreation}
				/>
			</div>
		</div>
	);
};
