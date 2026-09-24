import type { BridgedReactor, ReactionView } from "../atproto/views";

const sameReactor = (a: BridgedReactor, b: BridgedReactor): boolean =>
	a.registration === b.registration && a.remoteId === b.remoteId;

export const foldBridgedReaction = (
	reactions: readonly ReactionView[],
	emoji: string,
	reactor: BridgedReactor,
	adding: boolean,
): ReactionView[] => {
	const existing = reactions.find((reaction) => reaction.emoji === emoji);
	const held = existing?.bridgedReactors ?? [];
	const present = held.some((entry) => sameReactor(entry, reactor));

	if (adding) {
		if (present) return [...reactions];
		if (!existing) {
			return [
				...reactions,
				{ emoji, count: 1, reactors: [], bridgedReactors: [reactor] },
			];
		}
		return reactions.map((reaction) =>
			reaction === existing
				? {
						...reaction,
						count: reaction.count + 1,
						bridgedReactors: [...held, reactor],
					}
				: reaction,
		);
	}

	if (!existing || !present) return [...reactions];
	return reactions
		.map((reaction) =>
			reaction === existing
				? {
						...reaction,
						count: reaction.count - 1,
						bridgedReactors: held.filter(
							(entry) => !sameReactor(entry, reactor),
						),
					}
				: reaction,
		)
		.filter((reaction) => reaction.count > 0);
};
