import { createMemo } from "solid-js";
import type {
	SidebarCategoryData,
	SidebarChannelData,
	SidebarData,
} from "@/utils/sdk";
import { useGlobalContext } from "../../contexts/GlobalContext";

/**
 * Merges server sidebar data with optimistic global context updates,
 * returning a reactive memo of sorted categories (with channels) and uncategorized channels.
 */
export const useProcessedSidebar = (props: {
	data: SidebarData;
	community: string;
	categoryOrder: string[];
}) => {
	const [globalContext] = useGlobalContext();

	return createMemo(
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
};
