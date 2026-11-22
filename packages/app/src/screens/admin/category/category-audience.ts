import type { Audience } from "../channel/audience";

export const isRestricted = (audience: Audience | undefined) =>
	!!audience && (audience.roles.length > 0 || audience.members.length > 0);
