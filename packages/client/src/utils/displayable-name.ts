import type { ProfileView } from "../atproto/views";

export const displayableNameFn = (
	user: Pick<ProfileView, "displayName">,
	nickname?: string,
): string => nickname || user.displayName;
