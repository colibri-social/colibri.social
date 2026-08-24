import type { CategoryView, ChannelView } from "../atproto/views";

export const ambiguousCategoryName = (
	channel: Pick<ChannelView, "space" | "name" | "category">,
	channels: Array<Pick<ChannelView, "space" | "name">>,
	categories: Array<Pick<CategoryView, "rkey" | "name">>,
): string | undefined => {
	if (!channel.category) return undefined;

	const name = channel.name.toLowerCase();
	const collides = channels.some(
		(other) =>
			other.space !== channel.space && other.name.toLowerCase() === name,
	);
	if (!collides) return undefined;

	return categories.find((category) => category.rkey === channel.category)
		?.name;
};
