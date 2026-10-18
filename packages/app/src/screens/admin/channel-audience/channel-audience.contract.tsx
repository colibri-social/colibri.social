import { createAudienceContract } from "../permissions/permissions";

export const adminChannelAudience = createAudienceContract(
	"adminChannelAudience",
	"channel",
);
