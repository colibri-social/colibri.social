import type { Category } from "../atproto/xrpc/social/colibri/community/listCategories";
import type { Channel } from "../atproto/xrpc/social/colibri/community/listChannels";

export const ambiguousCategoryName = (
	channel: Pick<Channel, "uri" | "name" | "category">,
	channels: Array<Pick<Channel, "uri" | "name">>,
	categories: Array<Pick<Category, "uri" | "name">>,
): string | undefined => {
	if (!channel.category) return undefined;

	const name = channel.name.toLowerCase();
	const collides = channels.some(
		(other) => other.uri !== channel.uri && other.name.toLowerCase() === name,
	);
	if (!collides) return undefined;

	return categories.find((category) => category.uri === channel.category)?.name;
};
