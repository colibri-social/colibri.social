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
			const categoryCache = new Map<string, SidebarCategoryData>();

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

			const globalChannelsForCommunity = globalContext.addedChannels
				.filter((ch) => ch.community === props.community)
				.map((ch) => ({
					...ch,
					voice_members:
						globalContext.knownVoiceChannelStates.find(
							(x) => x.channel_rkey === ch.rkey,
						) ?? [],
					channel_type: ch.type,
					category_rkey: ch.category,
				})) as Array<SidebarChannelData>;

			const globalChannelByRkey = new Map(
				globalChannelsForCommunity.map((ch) => [ch.rkey, ch]),
			);

			const buildChannel = (
				ch:
					| SidebarChannelData
					| { rkey: string; uri?: string; name?: string; type?: string },
				categoryRkey: string | null,
			): SidebarChannelData => {
				const globalCh = globalChannelByRkey.get(ch.rkey);
				if (globalCh) {
					return {
						uri: (ch as SidebarChannelData).uri ?? globalCh.uri ?? "",
						rkey: globalCh.rkey,
						name: globalCh.name,
						description: (ch as SidebarChannelData).description ?? "",
						channel_type: globalCh.channel_type,
						category_rkey: categoryRkey,
						voice_members: globalCh.voice_members,
					};
				}

				return ch as SidebarChannelData;
			};

			const serverCategories: Array<SidebarCategoryData> = props.data.categories
				.filter((c) => !removedCategoryRkeys.has(c.rkey))
				.map((c) => {
					const override = globalCategoryByRkey.get(c.rkey);

					const channels: Array<SidebarChannelData> = c.channels
						.filter((ch) => !removedChannelRkeys.has(ch.rkey))
						.map((ch) => buildChannel(ch, c.rkey));

					let cached = categoryCache.get(c.rkey);
					if (!cached) {
						cached = {
							uri: c.uri,
							rkey: c.rkey,
							name: override?.name ?? c.name,
							channel_order: override?.channelOrder ?? c.channel_order,
							channels,
						};
						categoryCache.set(c.rkey, cached);
					} else {
						cached.uri = c.uri;
						cached.name = override?.name ?? c.name;
						cached.channel_order = override?.channelOrder ?? c.channel_order;
						cached.channels = channels;
					}
					return cached;
				});

			const optimisticCategories: Array<SidebarCategoryData> =
				globalCategoriesForCommunity
					.filter(
						(c) =>
							!serverCategoryRkeys.has(c.rkey) &&
							!removedCategoryRkeys.has(c.rkey),
					)
					.map((c) => {
						let cached = categoryCache.get(c.rkey);
						if (!cached) {
							cached = {
								uri: "",
								rkey: c.rkey,
								name: c.name,
								channel_order: c.channelOrder,
								channels: [],
							};
							categoryCache.set(c.rkey, cached);
						} else {
							cached.uri = "";
							cached.name = c.name;
							cached.channel_order = c.channelOrder;
							cached.channels = cached.channels ?? [];
						}
						return cached;
					});

			const unsortedCategories = [...serverCategories, ...optimisticCategories];

			const categories = unsortedCategories.sort((a, b) => {
				const idxA = props.categoryOrder.indexOf(a.rkey);
				const idxB = props.categoryOrder.indexOf(b.rkey);
				if (idxA === -1 && idxB === -1) return 0;
				if (idxA === -1) return 1;
				if (idxB === -1) return -1;
				return idxA - idxB;
			});

			const serverChannelRkeys = new Set([
				...props.data.categories.flatMap((c) =>
					c.channels.map((ch) => ch.rkey),
				),
				...props.data.uncategorized.map((ch) => ch.rkey),
			]);

			const uncategorized: Array<SidebarChannelData> = props.data.uncategorized
				.filter((ch) => !removedChannelRkeys.has(ch.rkey))
				.map((ch) => buildChannel(ch, null));

			const optimisticChannels = globalChannelsForCommunity.filter(
				(ch) =>
					!serverChannelRkeys.has(ch.rkey) && !removedChannelRkeys.has(ch.rkey),
			);

			for (const ch of optimisticChannels) {
				const category = categories.find((c) => c.rkey === ch.category_rkey);
				if (category) {
					category.channels = category.channels ?? [];
					category.channels.push(ch);
				} else {
					uncategorized.push(ch);
				}
			}

			return { categories, uncategorized };
		},
	);
};
