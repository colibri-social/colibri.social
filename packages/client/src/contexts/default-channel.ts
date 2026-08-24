import { SPACE_TYPES } from "../atproto/lexicons";
import type { CategoryView, ChannelView } from "../atproto/views";

export type DefaultChannelSource = {
	categories: ReadonlyArray<CategoryView>;
	channels: ReadonlyArray<ChannelView>;
};

export const isOpenableChannel = (channel: ChannelView): boolean =>
	channel.viewer.canRead && channel.type === SPACE_TYPES.channelText;

export const pickDefaultChannel = (
	source: DefaultChannelSource,
): ChannelView | undefined => {
	for (const category of source.categories) {
		const openable = category.channels.find(isOpenableChannel);
		if (openable) return openable;
	}

	return source.channels.find(isOpenableChannel);
};
