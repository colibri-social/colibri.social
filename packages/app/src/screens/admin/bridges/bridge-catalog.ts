import type { ConnectedBridge, FeaturedBridge } from "@colibri-social/ui";
import type {
	BridgeLink,
	BridgeRegistrationView,
	Datetime,
} from "../../../data/types";

export const BRIDGES_DESCRIPTION =
	"Bridges sync Colibri channels with other platforms. Read more in our";

export const BRIDGE_DOCS_URL =
	"https://spaces.colibri.social/docs/bridges/pairing/";

const PLATFORM_NAMES: Record<string, string> = {
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
		id: "matrix",
		name: "Matrix",
		verified: true,
		author: "Colibri Social",
		features: [
			{ label: "Bi-directional messages", support: "full" },
			{ label: "Bi-directional message moderation", support: "full" },
			{ label: "Import earlier messages", support: "full" },
		],
	},
	{
		id: "telegram",
		name: "Telegram",
		author: "@telegram-bridge.example.social",
		features: [
			{ label: "Bi-directional messages", support: "full" },
			{ label: "Message moderation", support: "partial" },
			{ label: "Import earlier messages", support: "none" },
		],
	},
	{
		id: "irc",
		name: "IRC",
		author: "@irc-relay.example.net",
		features: [
			{ label: "Bi-directional messages", support: "full" },
			{ label: "Can't moderate messages sent from IRC", support: "none" },
		],
	},
];

export type PairingGuide = {
	invite: { title: string; detail: string; label: string; href: string };
	code: { title: string; detail: string };
	enter: string;
};

export const PAIRING_GUIDES: Record<string, PairingGuide> = {
	matrix: {
		invite: {
			title: "Invite the Colibri bridge",
			detail:
				"To get started, invite @colibri:matrix-bridge.colibri.social to your Matrix space with the link below.",
			label: "Invite the Colibri bridge",
			href: "https://matrix.to/#/@colibri:matrix-bridge.colibri.social",
		},
		code: {
			title: "Get a pairing code",
			detail:
				"Next, send !colibri pair in any room of your Matrix space and copy the pairing code it gives you.",
		},
		enter: "Enter the pairing code below and connect it to your Matrix space.",
	},
	telegram: {
		invite: {
			title: "Add the bridge bot",
			detail:
				"To get started, add the bridge bot to your Telegram group as an admin with the link below.",
			label: "Add the bridge bot",
			href: "https://t.me/colibri_bridge_bot?startgroup=pair",
		},
		code: {
			title: "Get a pairing code",
			detail:
				"Next, send /pair in your group chat and copy the pairing code the bot replies with.",
		},
		enter:
			"Enter the pairing code below and connect it to your Telegram group.",
	},
	irc: {
		invite: {
			title: "Invite the relay",
			detail:
				"To get started, invite the relay bot to your IRC channel. The setup guide below has the commands.",
			label: "Open the relay setup guide",
			href: "https://irc-relay.example.net/setup",
		},
		code: {
			title: "Get a pairing code",
			detail:
				"Next, send !pair in your channel and copy the code the relay bot replies with.",
		},
		enter: "Enter the pairing code below and connect it to your IRC channel.",
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

export const HISTORY_DEPTHS = [
	{ value: "none", label: "Don't import" },
	{ value: "day", label: "Last day" },
	{ value: "week", label: "Last 7 days" },
	{ value: "month", label: "Last 30 days" },
	{ value: "all", label: "All history" },
] as const;

export type HistoryDepth = (typeof HISTORY_DEPTHS)[number]["value"];

const DEPTH_DAYS: Record<Exclude<HistoryDepth, "none" | "all">, number> = {
	day: 1,
	week: 7,
	month: 30,
};

export const historyRequest = (
	depth: HistoryDepth,
	now: Date,
): BridgeLink["backfill"] => {
	if (depth === "none") return undefined;
	const requestedAt = now.toISOString() as Datetime;
	if (depth === "all") return { requestedAt };
	const since = new Date(now.getTime() - DEPTH_DAYS[depth] * 86_400_000);
	return { requestedAt, since: since.toISOString() as Datetime };
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
