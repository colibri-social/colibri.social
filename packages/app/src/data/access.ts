import type { social } from "@colibri-social/lexicons";
import type { CommunityView, Did, MemberView } from "./types";

export type InvitationView = social.colibri.beta.community.defs.InvitationView;
export type ApplicationView =
	social.colibri.beta.community.defs.ApplicationView;
export type BannedActorView =
	social.colibri.beta.community.defs.BannedActorView;

export type InvitationPreview = {
	invitation: InvitationView;
	community: CommunityView;
};

export type JoinStatus = "joined" | "pending";

export type JoinResult = { status: JoinStatus; member?: MemberView };

export type AccessSubjectInput = { community: Did; subject: Did };

export type CreateInvitationInput = {
	community: Did;
	maxUses?: number;
	expiresAt?: string;
};

export type AccessEvent = {
	$type: "accessEvent";
	community: Did;
	kind: "applications" | "bans" | "invitations";
};

export class AccessError extends Error {
	constructor(
		readonly code:
			| "InvitationNotFound"
			| "AlreadyMember"
			| "Banned"
			| "Forbidden"
			| "ApplicationNotFound"
			| "NotBanned",
	) {
		super(code);
		this.name = "AccessError";
	}
}

export type AccessSource = {
	listApplications: (input: {
		community: Did;
		includeDismissed?: boolean;
	}) => Promise<ApplicationView[]>;
	approveApplication: (input: AccessSubjectInput) => Promise<MemberView>;
	dismissApplication: (input: AccessSubjectInput) => Promise<void>;
	undismissApplication: (input: AccessSubjectInput) => Promise<void>;
	listBans: (community: Did) => Promise<BannedActorView[]>;
	unban: (input: AccessSubjectInput & { reason?: string }) => Promise<void>;
	listInvitations: (community: Did) => Promise<InvitationView[]>;
	createInvitation: (input: CreateInvitationInput) => Promise<InvitationView>;
	deleteInvitation: (input: { community: Did; code: string }) => Promise<void>;
	getInvitation: (code: string) => Promise<InvitationPreview>;
	joinCommunity: (input: {
		community: Did;
		invitation?: string;
	}) => Promise<JoinResult>;
};

export const inviteUrl = (code: string, origin = location.origin) =>
	`${origin}/invite/${encodeURIComponent(code)}`;
