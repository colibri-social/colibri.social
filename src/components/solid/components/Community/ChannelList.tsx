import { type Component, createMemo, For } from "solid-js";
import type { SidebarData } from "@/utils/sdk";
import type { CategoryData, ChannelData } from "@/utils/sdk";
import { Plus } from "../../icons/Plus";
import { Button } from "../../shadcn-solid/Button";
import { useGlobalContext } from "../../contexts/GlobalContext/index";
import { Category } from "../Category/Category";
import { CategoryCreationModal } from "./CategoryCreationModal";

/**
 * A list of channels displayed on the sidebar.
 */
export const ChannelList: Component<{
	data: SidebarData;
	community: string;
}> = (props) => {
	const [globalContext] = useGlobalContext();

	/**
	 * Merges the server-fetched sidebar data with any optimistically added
	 * categories and channels from the global context, then builds the final
	 * list of categories (each with their channels attached) and any channels
	 * that have no category.
	 */
	const processed = createMemo(() => {
		const serverCategoryRkeys = new Set(
			props.data.categories.map((c) => c.rkey),
		);

		const serverCategories = props.data.categories.map((c) => {
			const categoryData: CategoryData = {
				rkey: c.rkey,
				name: c.name,
				channelOrder: c.channel_order,
				community: props.community,
			};

			const channels: Array<ChannelData> = c.channels.map((ch) => ({
				rkey: ch.rkey,
				name: ch.name,
				type: ch.channel_type,
				category: c.rkey,
				community: props.community,
			}));

			return { ...categoryData, channels };
		});

		const optimisticCategories = globalContext.categories
			.filter(
				(c) =>
					c.community === props.community && !serverCategoryRkeys.has(c.rkey),
			)
			.map((c) => ({ ...c, channels: [] as Array<ChannelData> }));

		const categories = [...serverCategories, ...optimisticCategories];

		const serverChannelRkeys = new Set([
			...props.data.categories.flatMap((c) => c.channels.map((ch) => ch.rkey)),
			...props.data.uncategorized.map((ch) => ch.rkey),
		]);

		const uncategorized: Array<ChannelData> = props.data.uncategorized.map(
			(ch) => ({
				rkey: ch.rkey,
				name: ch.name,
				type: ch.channel_type,
				category: "",
				community: props.community,
			}),
		);

		const optimisticChannels = globalContext.channels.filter(
			(c) => c.community === props.community && !serverChannelRkeys.has(c.rkey),
		);

		for (const channel of optimisticChannels) {
			const category = categories.find((c) => c.rkey === channel.category);
			if (category) {
				category.channels.push(channel);
			} else {
				uncategorized.push(channel);
			}
		}

		return { categories, uncategorized };
	});

	return (
		<nav class="w-full h-full flex flex-col">
			<For each={processed().uncategorized}>
				{(channel) => <div>{channel.name}</div>}
			</For>
			<For each={processed().categories}>
				{(category) => (
					<Category category={category} community={props.community} />
				)}
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
