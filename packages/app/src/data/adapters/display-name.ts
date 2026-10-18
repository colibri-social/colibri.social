import type { MemberView, ProfileView } from "../types";

export const displayNameOf = (
	profile: Pick<ProfileView, "displayName" | "handle"> | undefined,
	member?: Pick<MemberView, "nickname">,
) =>
	member?.nickname?.trim() ||
	profile?.displayName?.trim() ||
	profile?.handle ||
	"Unknown user";
