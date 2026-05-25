import { createMemo } from "solid-js";
import type { Channel } from "../../../atproto/xrpc/social/colibri/community/listChannels";
import { useCommunityContext } from "../../../contexts/Community";
import type { CategoryWithChannels } from "./Category";

/**
 * Reactive sidebar projection. Builds categories (with nested channels) in
 * the community's preferred order, plus any channels that aren't pinned to
 * a category.
 *
 * TODO: The Astro version of this also merged in optimistic state from
 * `useGlobalContext` (added/removed categories & channels, name overrides,
 * channel-order overrides). The client package doesn't have that context
 * yet, so for now this just projects whatever the AppView returned.
 */
export const useProcessedSidebar = () => {
	const community = useCommunityContext();

	return createMemo(
		(): {
			categories: Array<CategoryWithChannels>;
			uncategorized: Array<Channel>;
		} => {
			const categoryOrder = community().community.categoryOrder;
			const categoriesRaw = community().categories;
			const channels = community().channels;

			const channelsByCategory = new Map<string, Channel[]>();
			const uncategorized: Channel[] = [];

			for (const ch of channels) {
				if (!ch.category) {
					uncategorized.push(ch);
					continue;
				}
				const bucket = channelsByCategory.get(ch.category);
				if (bucket) bucket.push(ch);
				else channelsByCategory.set(ch.category, [ch]);
			}

			const withChannels: CategoryWithChannels[] = categoriesRaw.map((c) => ({
				...c,
				channels: channelsByCategory.get(c.uri) ?? [],
			}));

			const categories = withChannels.sort((a, b) => {
				const idxA = categoryOrder.indexOf(a.uri);
				const idxB = categoryOrder.indexOf(b.uri);
				if (idxA === -1 && idxB === -1) return 0;
				if (idxA === -1) return 1;
				if (idxB === -1) return -1;
				return idxA - idxB;
			});

			return { categories, uncategorized };
		},
	);
};
