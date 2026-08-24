import { createMemo } from "solid-js";
import type { CategoryView, ChannelView } from "../../../atproto/views";
import { useCommunityContext } from "../../../contexts/Community";

export const useProcessedSidebar = () => {
	const community = useCommunityContext();

	return createMemo(
		(): {
			categories: Array<CategoryView>;
			uncategorized: Array<ChannelView>;
		} => ({
			categories: community().categories,
			uncategorized: community().channels.filter(
				(channel) => !channel.category,
			),
		}),
	);
};
