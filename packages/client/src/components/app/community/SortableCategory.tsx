import { createSortable, useDragDropContext } from "@thisbeyond/solid-dnd";
import type { Component } from "solid-js";
import type { Channel } from "../../../atproto/xrpc/social/colibri/community/listChannels";
import {
	Category,
	type CategoryWithChannels,
	type ChannelDropTarget,
} from "./Category";

export const SortableCategory: Component<{
	category: CategoryWithChannels;
	communityUri: string;
	channelOrder: string[];
	onChannelReorder: (categoryUri: string, newOrder: string[]) => void;
	injectedChannels: Channel[];
	dropTarget: ChannelDropTarget | null;
}> = (props) => {
	const sortable = createSortable(props.category.uri);
	const [, { onDragStart, onDragEnd: onDndDragEnd }] = useDragDropContext()!;

	let el: HTMLDivElement | undefined;

	onDragStart(({ draggable }) => {
		if (draggable.id === props.category.uri) {
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
					communityUri={props.communityUri}
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
