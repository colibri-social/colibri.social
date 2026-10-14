import { createPermissionsContract } from "../permissions/permissions";

export const adminCategoryPermissions = createPermissionsContract(
	"adminCategoryPermissions",
	"category",
);
