import { slugForEmoji } from "./emoji-data";

type ReactionGroup = { emoji: string };

const sortKey = (emoji: string): string => slugForEmoji(emoji) ?? emoji;

export const compareReactionGroups = (
	a: ReactionGroup,
	b: ReactionGroup,
): number => {
	const keyA = sortKey(a.emoji);
	const keyB = sortKey(b.emoji);
	if (keyA !== keyB) return keyA < keyB ? -1 : 1;
	if (a.emoji === b.emoji) return 0;
	return a.emoji < b.emoji ? -1 : 1;
};

export const sortReactionGroups = <T extends ReactionGroup>(
	groups: readonly T[],
): Array<T> => [...groups].sort(compareReactionGroups);
