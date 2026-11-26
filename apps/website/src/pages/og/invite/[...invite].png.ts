import type { APIRoute } from "astro";
import {
	getInvitationPreview,
	invitePath,
	parseInvite,
} from "@/lib/invitation";
import { remoteImage } from "@/lib/og/render";
import { respondOg, TTL } from "@/lib/og/respond";
import { inviteFallbackTemplate, inviteTemplate } from "@/lib/og/templates";

export const GET: APIRoute = ({ params }) => {
	const target = parseInvite(params.invite);
	return respondOg(
		`invite:${target ? invitePath(target) : ""}`,
		TTL.live,
		async () => {
			const preview = target ? await getInvitationPreview(target) : null;
			if (!preview?.active) return null;
			const [picture, banner] = await Promise.all([
				preview.picture ? remoteImage(preview.picture, 320, 320) : null,
				preview.banner ? remoteImage(preview.banner, 1200, 250) : null,
			]);
			return inviteTemplate({
				name: preview.name,
				picture,
				banner,
				memberCount: preview.memberCount,
				inviterHandle: preview.inviterHandle,
			});
		},
		inviteFallbackTemplate,
	);
};
