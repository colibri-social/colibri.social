import type { ProfileView } from "../atproto/views";
import type { LoggedInUser } from "./User";

export const profileViewOf = (user: LoggedInUser): ProfileView => ({
	did: user.did,
	handle: user.handle,
	displayName: user.displayName,
	description: user.description,
	avatar: user.avatar,
	banner: user.banner,
	isBot: user.isBot,
	syncBluesky: user.syncBluesky,
	theme: user.theme,
	preferredBadge: user.preferredBadge,
	presence: user.presence,
});
