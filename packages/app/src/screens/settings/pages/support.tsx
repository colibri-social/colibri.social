import { classifyThrown, createLogger } from "@colibri-social/lib";
import {
	FALLBACK_BADGE_DEFINITIONS,
	SupportColibriSettings,
	type SupporterLink,
	type SupportTier,
	TEAM_BADGE_DEFINITION,
	toast,
	UserBadge,
} from "@colibri-social/ui";
import { createResource, createSignal } from "solid-js";
import { isNativeShell } from "../../../auth/native";
import { displayNameOf } from "../../../data/adapters/authors";
import { useBadges } from "../../../data/badges";
import { useData } from "../../../data/store";
import {
	fetchSupporterAccount,
	formatVerifiedAt,
	supporterLinkVersion,
} from "../../../data/supporter-link";
import { openExternalUrl } from "../../../native/open-external";
import type { Platform } from "../../../screen/platform";

const log = createLogger("badges");

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
	"Linking Open Collective isn't available in this version of Colibri.";

export default function SupportPage(_props: { platform: Platform }) {
	const data = useData();
	const badges = useBadges();
	const [working, setWorking] = createSignal(false);
	const [account, { refetch, mutate }] = createResource(
		() => ({ did: data.viewer.did, version: supporterLinkVersion() }),
		({ did }) => fetchSupporterAccount(did).catch(() => null),
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
	const connect = async () => {
		const transport = data.source.supporterLink;
		if (!transport) {
			toast.info(LINKING_UNAVAILABLE);
			return;
		}
		setWorking(true);
		const id = toast.loading("Opening Open Collective...");
		try {
			const url = await transport.start();
			if (isNativeShell()) {
				toast.success("Finish up in your browser, then come back here.", {
					id,
				});
				openExternalUrl(url);
			} else {
				toast.dismiss(id);
				window.location.assign(url);
			}
		} catch (error) {
			log.error("starting the Open Collective link failed", {
				code: classifyThrown(error).code,
			});
			toast.error("Couldn't open Open Collective. Try again.", { id });
		} finally {
			setWorking(false);
		}
	};
	const disconnect = async () => {
		const transport = data.source.supporterLink;
		if (!transport) {
			toast.info(LINKING_UNAVAILABLE);
			return;
		}
		setWorking(true);
		const id = toast.loading("Disconnecting...");
		try {
			const result = await transport.unlink();
			badges.invalidate(data.viewer.did);
			mutate(null);
			toast.success(
				result.negatedLabelVals.length > 0
					? "Disconnected. Your supporter badge is gone."
					: "Disconnected.",
				{ id },
			);
		} catch (error) {
			log.error("unlinking the Open Collective account failed", {
				code: classifyThrown(error).code,
			});
			toast.error("Couldn't disconnect. Try again.", { id });
		} finally {
			setWorking(false);
		}
	};
	const refresh = () => {
		badges.invalidate(data.viewer.did);
		void refetch();
	};
	return (
		<SupportColibriSettings
			link={link()}
			busy={account.loading || working()}
			onConnect={() => void connect()}
			onDisconnect={() => void disconnect()}
			onRefresh={refresh}
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
