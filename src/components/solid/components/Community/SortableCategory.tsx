import { createSortable, useDragDropContext } from "@thisbeyond/solid-dnd";
import type { Component } from "solid-js";
import type { SidebarCategoryData, SidebarChannelData } from "@/utils/sdk";
import { Category, type ChannelDropTarget } from "../Category/Category";

export const SortableCategory: Component<{
	category: SidebarCategoryData;
	community: string;
	channelOrder: string[];
	onChannelReorder: (categoryRkey: string, newOrder: string[]) => void;
	injectedChannels: SidebarChannelData[];
	dropTarget: ChannelDropTarget | null;
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
			<div style={{ "touch-action": "none" }} {...sortable.dragActivators}>
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
