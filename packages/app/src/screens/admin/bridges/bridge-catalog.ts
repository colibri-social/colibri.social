import type {
	BridgeHistoryDepth,
	ConnectedBridge,
	FeaturedBridge,
} from "@colibri-social/ui";
import type {
	BridgeLink,
	BridgeRegistrationView,
	Datetime,
} from "../../../data/types";

export const BRIDGES_DESCRIPTION =
	"Bridges sync Colibri channels with other platforms. Read more in our";

export const BRIDGES_BETA_NOTICE = {
	title: "Bridges are in beta",
	description:
		"Relaying messages between two platforms is going to stay free, but additional features may require payment in the future.",
} as const;

export const BRIDGE_DOCS_URL =
	"https://colibri.social/docs/users/bridges/pairing/";

const PLATFORM_NAMES: Record<string, string> = {
	discord: "Discord",
	irc: "IRC",
	matrix: "Matrix",
	slack: "Slack",
	telegram: "Telegram",
	xmpp: "XMPP",
};

export const platformName = (platform: string) =>
	platform.length === 0
		? "another service"
		: (PLATFORM_NAMES[platform.toLowerCase()] ??
			`${platform[0]?.toUpperCase()}${platform.slice(1)}`);

export const FEATURED_BRIDGES: FeaturedBridge[] = [
	{
		id: "discord",
		name: "Discord",
		verified: true,
		author: "Colibri Social",
		features: [
			{ label: "Bi-directional messages", support: "full" },
			{ label: "Bi-directional message moderation", support: "full" },
			{ label: "Import earlier messages", support: "full" },
		],
	},
];

export type PairingGuide = {
	invite: { title: string; detail: string; label: string; href: string };
	code: { title: string; detail: string };
	enter: string;
};

export const PAIRING_GUIDES: Record<string, PairingGuide> = {
	discord: {
		invite: {
			title: "Add the Colibri bot",
			detail:
				"To get started, add the Colibri bot to your server with the link below. You need the Manage Server permission.",
			label: "Add the Colibri bot",
			href: "https://discord.com/oauth2/authorize?client_id=1552595021247684679",
		},
		code: {
			title: "Get a pairing code",
			detail:
				"Next, run /colibri connect in your server and copy the eight-character code. It works once and expires after 10 minutes.",
		},
		enter:
			"Enter the pairing code below and connect it to your Discord server.",
	},
};

export const toConnectedBridge = (
	registration: BridgeRegistrationView,
): ConnectedBridge => {
	const featured = FEATURED_BRIDGES.find(
		(entry) => entry.id === registration.platform,
	);
	return {
		id: registration.id,
		featuredId: featured?.id,
		name: featured?.name ?? platformName(registration.platform),
		verified: featured?.verified,
		service: registration.bridgeHandle ?? registration.bridge,
		bridgedWith: registration.remoteSpaceName,
	};
};

const DAY_MS = 86_400_000;

type TimedDepth = Exclude<BridgeHistoryDepth, "none" | "all">;

const DEPTH_DAYS: Record<TimedDepth, number> = {
	day: 1,
	week: 7,
	month: 30,
};

export const historyRequest = (
	depth: BridgeHistoryDepth,
	now: Date,
): BridgeLink["backfill"] => {
	if (depth === "none") return undefined;

	const requestedAt = now.toISOString() as Datetime;

	if (depth === "all") return { requestedAt };

	const since = new Date(now.getTime() - DEPTH_DAYS[depth] * DAY_MS);

	return { requestedAt, since: since.toISOString() as Datetime };
};

export const historyDepth = (
	backfill: NonNullable<BridgeLink["backfill"]>,
): BridgeHistoryDepth => {
	if (!backfill.since) return "all";

	const days =
		(Date.parse(backfill.requestedAt) - Date.parse(backfill.since)) / DAY_MS;
	const depths = Object.keys(DEPTH_DAYS) as TimedDepth[];

	return depths.reduce((nearest, depth) =>
		Math.abs(DEPTH_DAYS[depth] - days) < Math.abs(DEPTH_DAYS[nearest] - days)
			? depth
			: nearest,
	);
};

export const historyPercent = (status: {
	state: string;
	from: string;
	until: string;
	reached?: string;
}) => {
	if (status.state === "done") return 100;
	const from = Date.parse(status.from);
	const until = Date.parse(status.until);
	if (!(until > from)) return 100;
	if (!status.reached) return 0;
	const share = (Date.parse(status.reached) - from) / (until - from);
	return Math.round(Math.min(1, Math.max(0, share)) * 100);
};
