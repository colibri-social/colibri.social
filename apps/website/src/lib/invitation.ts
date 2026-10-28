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

export const getInvitationPreview = async (
	code: string,
): Promise<InvitationPreview | null> => {
	const url = new URL(
		"/xrpc/social.colibri.beta.community.getInvitation",
		DEFAULT_APPVIEW_URL,
	);
	url.searchParams.set("code", code);

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
