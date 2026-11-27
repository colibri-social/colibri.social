import { DEFAULT_APPVIEW_URL } from "@colibri-social/lib";
import { resolveHandle } from "@/lib/handle";

const REQUEST_TIMEOUT_MS = 3000;

export type InvitationPreview = {
	name: string;
	description?: string;
	picture?: string;
	banner?: string;
	memberCount?: number;
	active: boolean;
	inviterHandle?: string;
};

type GetInvitationResponse = {
	invitation: { active: boolean; expiresAt?: string; createdBy: string };
	community: {
		name: string;
		description?: string;
		picture?: string;
		banner?: string;
		memberCount?: number;
	};
};

export type InviteTarget = { code: string; community?: string };

export const parseInvite = (path: string | undefined): InviteTarget | null => {
	const parts = (path ?? "").split("/").filter(Boolean);

	if (parts.length === 1 && parts[0]) return { code: parts[0] };

	const [community, code] = parts;

	if (parts.length !== 2 || !community?.startsWith("did:") || !code)
		return null;

	return { code, community };
};

export const invitePath = ({ code, community }: InviteTarget): string =>
	community
		? `${encodeURIComponent(community)}/${encodeURIComponent(code)}`
		: encodeURIComponent(code);

export const getInvitationPreview = async ({
	code,
	community,
}: InviteTarget): Promise<InvitationPreview | null> => {
	const url = new URL(
		"/xrpc/social.colibri.beta.community.getInvitation",
		DEFAULT_APPVIEW_URL,
	);
	url.searchParams.set("code", code);

	if (community) url.searchParams.set("community", community);

	try {
		const res = await fetch(url, {
			headers: { accept: "application/json" },
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		});
		if (!res.ok) return null;
		const { invitation, community } =
			(await res.json()) as GetInvitationResponse;
		const expired =
			invitation.expiresAt !== undefined &&
			new Date(invitation.expiresAt).getTime() < Date.now();
		const inviterHandle = await resolveHandle(invitation.createdBy);
		return {
			name: community.name,
			description: community.description,
			picture: community.picture,
			banner: community.banner,
			memberCount: community.memberCount,
			active: invitation.active && !expired,
			inviterHandle: inviterHandle ?? undefined,
		};
	} catch {
		return null;
	}
};
