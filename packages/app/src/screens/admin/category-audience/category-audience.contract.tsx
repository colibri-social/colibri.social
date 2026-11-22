import { createAudienceContract } from "../permissions/permissions";

export const adminCategoryAudience = createAudienceContract(
	"adminCategoryAudience",
	"category",
);
