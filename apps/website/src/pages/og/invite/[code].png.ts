import type { APIRoute } from "astro";
import { getInvitationPreview } from "@/lib/invitation";
import { remoteImage } from "@/lib/og/render";
import { respondOg, TTL } from "@/lib/og/respond";
import { inviteFallbackTemplate, inviteTemplate } from "@/lib/og/templates";

export const GET: APIRoute = ({ params }) => {
	const code = params.code ?? "";
	return respondOg(
		`invite:${code}`,
		TTL.live,
		async () => {
			const preview = code ? await getInvitationPreview(code) : null;
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
