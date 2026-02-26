import { type Component, createMemo, For } from "solid-js";
import type { CommunityInfo } from "@/pages/api/v1/community/[community]";
import type { ChannelData } from "@/utils/sdk";
import { Plus } from "../../icons/Plus";
import { Button } from "../../shadcn-solid/Button";
import { Category } from "../Category/Category";
import { CategoryCreationModal } from "./CategoryCreationModal";

/**
 * A list of channels displayed on the sidebar.
 */
export const ChannelList: Component<{
	data: CommunityInfo;
	community: string;
}> = (props) => {
	/**
	 * The processed and sorted categories containing their channels.
	 * @todo Channels without a category are not handled yet.
	 */
	const processed = createMemo(() => {
		const categories = props.data.categories.map((category) => ({
			...category,
			channels: [] as Array<ChannelData>,
		}));

		const channelsWithoutCategory: Array<ChannelData> = [];

		for (const channel of props.data.channels) {
			const category = categories.find(
				(category) => category.rkey === channel.category,
			);

			if (category) {
				category.channels.push(channel);
				continue;
			}

			channelsWithoutCategory.push(channel);
		}

		return { categories, channelsWithoutCategory };
	});

	return (
		<nav class="w-full h-full flex flex-col">
			<For each={processed().channelsWithoutCategory}>
				{(channel) => <div>{channel.name}</div>}
			</For>
			<For each={processed().categories}>
				{(category) => <Category category={category} />}
			</For>
			<CategoryCreationModal community={props.community}>
				<Button size="sm" class="w-[calc(100%-2rem)] mx-4 mt-4" variant="ghost">
					<Plus />
					<span>Add new category</span>
				</Button>
			</CategoryCreationModal>
		</nav>
	);
};
