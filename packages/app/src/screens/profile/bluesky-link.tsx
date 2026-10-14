import {
	BlueskyClientLogo,
	isBlueskyClientLogoId,
	type ProfileHeaderLink,
} from "@colibri-social/ui";
import { ArrowRightUpIcon } from "@solar-icons/solid/linear/arrow-right-up";
import {
	blueskyClient,
	buildBskyProfileUrl,
	type ResolvedBlueskyClient,
} from "../../data/bluesky-client";

export const blueskyProfileLink = (
	client: ResolvedBlueskyClient,
	did: string,
): ProfileHeaderLink => ({
	label: `View on ${client.name}`,
	href: buildBskyProfileUrl(client, did),
	icon: isBlueskyClientLogoId(client.id) ? (
		<BlueskyClientLogo client={client.id} />
	) : (
		<ArrowRightUpIcon />
	),
	tint: client.accentColor || undefined,
});

export const blueskyProfileLinks = (did: string): ProfileHeaderLink[] => [
	blueskyProfileLink(blueskyClient(), did),
];
