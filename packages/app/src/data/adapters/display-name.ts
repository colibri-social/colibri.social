import type { MemberView, ProfileView } from "../types";

export const displayNameOf = (
	profile: Pick<ProfileView, "displayName" | "handle"> | undefined,
	member?: Pick<MemberView, "nickname">,
) =>
	member?.nickname?.trim() ||
	profile?.displayName?.trim() ||
	profile?.handle ||
	"Unknown user";

export const summaryAuthor = (
	profile: ProfileView | undefined,
	member: MemberView | undefined,
): { name: string; avatarSrc?: string } => {
	const actor = profile?.bridge ? profile : (member?.actor ?? profile);

	if (!actor) return { name: "Someone" };

	return {
		name: displayNameOf(actor, profile?.bridge ? undefined : member),
		...(actor.avatar ? { avatarSrc: actor.avatar } : {}),
	};
};
