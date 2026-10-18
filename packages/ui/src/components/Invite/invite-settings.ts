export type InviteOption = { value: string; label: string };

export type InviteExpiry = "never" | "30m" | "1h" | "6h" | "12h" | "1d" | "7d";

export type InviteMaxUses =
	| "unlimited"
	| "1"
	| "5"
	| "10"
	| "25"
	| "50"
	| "100";

export type InviteSettingsValue = {
	expiry: InviteExpiry;
	maxUses: InviteMaxUses;
};

export type InviteRequest = {
	expiresAt?: string;
	maxUses?: number;
};

export const DEFAULT_INVITE_SETTINGS: InviteSettingsValue = {
	expiry: "7d",
	maxUses: "unlimited",
};

export const INVITE_EXPIRY_OPTIONS: InviteOption[] = [
	{ value: "30m", label: "30 minutes" },
	{ value: "1h", label: "1 hour" },
	{ value: "6h", label: "6 hours" },
	{ value: "12h", label: "12 hours" },
	{ value: "1d", label: "1 day" },
	{ value: "7d", label: "7 days" },
	{ value: "never", label: "Never" },
];

export const INVITE_MAX_USES_OPTIONS: InviteOption[] = [
	{ value: "unlimited", label: "No limit" },
	{ value: "1", label: "1 use" },
	{ value: "5", label: "5 uses" },
	{ value: "10", label: "10 uses" },
	{ value: "25", label: "25 uses" },
	{ value: "50", label: "50 uses" },
	{ value: "100", label: "100 uses" },
];

const EXPIRY_MS: Record<Exclude<InviteExpiry, "never">, number> = {
	"30m": 30 * 60_000,
	"1h": 60 * 60_000,
	"6h": 6 * 60 * 60_000,
	"12h": 12 * 60 * 60_000,
	"1d": 24 * 60 * 60_000,
	"7d": 7 * 24 * 60 * 60_000,
};

export const inviteRequestFrom = (
	value: InviteSettingsValue,
	now: Date = new Date(),
): InviteRequest => {
	const request: InviteRequest = {};
	if (value.expiry !== "never") {
		request.expiresAt = new Date(
			now.getTime() + EXPIRY_MS[value.expiry],
		).toISOString();
	}
	if (value.maxUses !== "unlimited") request.maxUses = Number(value.maxUses);
	return request;
};

export type SpaceJoinMode = "open" | "approval";

export const INVITE_ACCESS_COPY: Record<SpaceJoinMode, string> = {
	open: "Anyone with an active link can join this Space.",
	approval:
		"People with an active link can request to join this Space. A member with the Manage approvals permission reviews each join request.",
};
