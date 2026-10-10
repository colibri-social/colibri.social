export type InviteSummary = {
	code: string;
	url: string;
	creator: { handle: string; avatar?: string };
	uses: number;
	maxUses?: number;
	expiresAt?: string;
};

export type InviteState = "active" | "expired" | "used-up";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const inviteState = (invite: InviteSummary, now: Date): InviteState => {
	if (invite.expiresAt && Date.parse(invite.expiresAt) <= now.getTime())
		return "expired";
	if (invite.maxUses !== undefined && invite.uses >= invite.maxUses)
		return "used-up";
	return "active";
};

export const inviteStateLabel: Record<InviteState, string> = {
	active: "Active",
	expired: "Expired",
	"used-up": "Used up",
};

const relative = (ms: number, locale?: string) => {
	const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
	const size = Math.abs(ms);
	if (size < HOUR) return format.format(Math.round(ms / MINUTE), "minute");
	if (size < DAY) return format.format(Math.round(ms / HOUR), "hour");
	return format.format(Math.round(ms / DAY), "day");
};

export const formatInviteExpiry = (
	invite: InviteSummary,
	now: Date,
	locale?: string,
) => {
	if (!invite.expiresAt) return "Never";
	const left = Date.parse(invite.expiresAt) - now.getTime();
	if (Number.isNaN(left)) return "Never";
	return relative(left, locale);
};

export const formatInviteUses = (invite: InviteSummary) =>
	invite.maxUses === undefined
		? `${invite.uses}`
		: `${invite.uses} / ${invite.maxUses}`;

export const describeInviteUses = (invite: InviteSummary) => {
	const used = `${invite.uses} ${invite.uses === 1 ? "use" : "uses"}`;
	return invite.maxUses === undefined
		? `${used}, no limit`
		: `${invite.uses} of ${invite.maxUses} uses`;
};

export const inviteUsesRatio = (invite: InviteSummary) =>
	invite.maxUses ? Math.min(1, invite.uses / invite.maxUses) : 0;

export const inviteExpiryLabel = (
	invite: InviteSummary,
	now: Date,
	prefix = false,
	locale?: string,
) => {
	const text = formatInviteExpiry(invite, now, locale);
	if (!invite.expiresAt) return prefix ? "Never expires" : text;
	if (Date.parse(invite.expiresAt) <= now.getTime()) return `Expired ${text}`;
	return prefix ? `Expires ${text}` : text;
};
