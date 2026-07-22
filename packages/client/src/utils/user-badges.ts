import type { ActorData } from "@colibri-social/lib";
import { createResource } from "solid-js";
import { getLabelerBadges } from "../atproto/labeler-lookup";

const BADGE_PRECEDENCE = ["team", "play-store-tester"];
const BOT_BADGE = "bot";

const badgeRank = (val: string): number => {
	if (val === BOT_BADGE) return Number.POSITIVE_INFINITY;
	const idx = BADGE_PRECEDENCE.indexOf(val);
	return idx === -1 ? BADGE_PRECEDENCE.length : idx;
};

export const badgeText = (val: string): string =>
	val === BOT_BADGE ? "BOT" : val.replaceAll("-", " ").toUpperCase();

const BADGE_DESCRIPTIONS: Record<string, string> = {
	team: "Official Colibri Maintainer",
	"play-store-tester": "Helped test the Colibri App for the Play Store release",
	bot: "Self-declared to be automated",
};

export const badgeDescription = (val: string): string | undefined =>
	BADGE_DESCRIPTIONS[val];

export const useUserBadges = (user: () => ActorData) => {
	const [labels] = createResource(
		() => user().did,
		(did) => getLabelerBadges(did),
	);

	const sorted = () => {
		const vals = (labels() ?? []).map((label) => label.val);
		if (user().data.isBot) vals.push(BOT_BADGE);
		return [...new Set(vals)].sort((a, b) => badgeRank(a) - badgeRank(b));
	};

	const primary = () => sorted()[0];
	const secondary = () => sorted().slice(1);

	return { all: sorted, primary, secondary };
};
