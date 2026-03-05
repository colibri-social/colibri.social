import { type Component, createMemo, For } from "solid-js";
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

			const globalChannelsForCommunity = globalContext.addedChannels.filter(
				(ch) => ch.community === props.community,
			);

			const globalChannelByRkey = new Map(
				globalChannelsForCommunity.map((ch) => [ch.rkey, ch]),
			);

			const serverCategories: Array<SidebarCategoryData> =
				props.data.categories.map((c) => {
					// Use the global context version if present (optimistic update wins).
					const override = globalCategoryByRkey.get(c.rkey);

					const channels: Array<SidebarChannelData> = c.channels
						.filter((ch) => !removedChannelRkeys.has(ch.rkey))
						.map((ch) => {
							// Use the global context version if present (optimistic update wins).
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
					.filter((c) => !serverCategoryRkeys.has(c.rkey))
					.map((c) => ({
						uri: "",
						rkey: c.rkey,
						name: c.name,
						channel_order: c.channelOrder,
						channels: [],
					}));

			const categories = [...serverCategories, ...optimisticCategories];

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
