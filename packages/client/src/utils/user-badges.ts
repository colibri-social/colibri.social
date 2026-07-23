import type { ActorData } from "@colibri-social/lib";
import { createResource } from "solid-js";
import { getLabelerBadges } from "../atproto/labeler-lookup";

const BADGE_PRECEDENCE = [
	"team",
	"play-store-tester",
	"sponsor-twenty-five",
	"backer-five",
	"donator",
];
const BOT_BADGE = "bot";

const badgeRank = (val: string): number => {
	if (val === BOT_BADGE) return Number.POSITIVE_INFINITY;
	const idx = BADGE_PRECEDENCE.indexOf(val);
	return idx === -1 ? BADGE_PRECEDENCE.length : idx;
};

const BADGE_DISPLAY_NAMES: Record<string, string> = {
	"backer-five": "$5 BACKER",
	"sponsor-twenty-five": "$25 SPONSOR",
};

export const badgeText = (val: string): string =>
	BADGE_DISPLAY_NAMES[val] ??
	(val === BOT_BADGE ? "BOT" : val.replaceAll("-", " ").toUpperCase());

const BADGE_DESCRIPTIONS: Record<string, string> = {
	team: "Official Colibri Maintainer",
	"play-store-tester": "Helped test the Colibri App for the Play Store release",
	bot: "Self-declared to be automated",
	"backer-five": "Backs Colibri with a $5 monthly donation",
	"sponsor-twenty-five": "Sponsors Colibri with a $25 monthly donation",
	donator: "Made a donation to support Colibri",
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

	const primary = () => {
		const list = sorted();
		const pref = user().data.preferredBadge;
		return pref && list.includes(pref) ? pref : list[0];
	};
	const secondary = () => sorted().slice(1);

	return { all: sorted, primary, secondary };
};
