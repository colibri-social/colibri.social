import {
	FALLBACK_BADGE_DEFINITIONS,
	SupportColibriSettings,
	type SupporterLink,
	type SupportTier,
	TEAM_BADGE_DEFINITION,
	toast,
	UserBadge,
} from "@colibri-social/ui";
import { createResource } from "solid-js";
import { displayNameOf } from "../../../data/adapters/authors";
import { useData } from "../../../data/store";
import {
	fetchSupporterAccount,
	formatVerifiedAt,
} from "../../../data/supporter-link";
import type { Platform } from "../../../screen/platform";

const badgeOf = (identifier: string, size: "xs" | "sm" = "sm") => (
	<UserBadge
		definition={
			FALLBACK_BADGE_DEFINITIONS.find(
				(entry) => entry.identifier === identifier,
			) ?? TEAM_BADGE_DEFINITION
		}
		size={size}
	/>
);

const CHECKOUT = "https://opencollective.com/colibri-social";

export const SUPPORT_TIERS: SupportTier[] = [
	{
		id: "backer-five",
		badge: badgeOf("backer-five"),
		price: "$5",
		cadence: "/ month",
		blurb: "Keep the lights on and wear a badge for it on your profile.",
		href: `${CHECKOUT}/contribute/backers-100302/checkout?interval=month&amount=5&name=&legalName=&email=`,
	},
	{
		id: "sponsor-twenty-five",
		badge: badgeOf("sponsor-twenty-five"),
		price: "$25",
		cadence: "/ month",
		blurb: "Seriously move the needle on development.",
		href: `${CHECKOUT}/contribute/sponsor-100710/checkout?interval=month&amount=25&name=&legalName=&email=`,
		highlight: true,
	},
	{
		id: "donator",
		badge: badgeOf("donator"),
		price: "Custom",
		cadence: "one-time",
		blurb: "Chip in any amount, whenever you like.",
		href: `${CHECKOUT}/donate?interval=oneTime&amount=20&name=&legalName=&email=`,
	},
];

export const LINKING_UNAVAILABLE =
	"Connecting your Open Collective account isn't available in this version of Colibri yet.";

export default function SupportPage(_props: { platform: Platform }) {
	const data = useData();
	const [account, { refetch }] = createResource(
		() => data.viewer.did,
		(did) => fetchSupporterAccount(did).catch(() => null),
	);
	const link = (): SupporterLink => {
		if (account.loading && account() === undefined) return { state: "loading" };
		const current = account();
		if (!current) return { state: "none" };
		return {
			state: "connected",
			account: current.account,
			verifiedAt: formatVerifiedAt(current.verifiedAt),
		};
	};
	const unavailable = () => toast.info(LINKING_UNAVAILABLE);
	return (
		<SupportColibriSettings
			link={link()}
			busy={account.loading}
			onConnect={unavailable}
			onDisconnect={unavailable}
			onRefresh={() => void refetch()}
			tiers={SUPPORT_TIERS}
			preview={{
				name: displayNameOf(data.viewer),
				seed: data.viewer.did,
				avatar: data.viewer.avatar,
				badge: badgeOf("sponsor-twenty-five", "xs"),
			}}
		/>
	);
}
