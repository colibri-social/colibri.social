import type { ActorData } from "@colibri-social/lib";

export const displayableNameFn = (user: ActorData) =>
	(user.data.displayName === user.handle ? undefined : user.data.displayName) ||
	user.handle?.replaceAll("at://", "") ||
	user.did;
