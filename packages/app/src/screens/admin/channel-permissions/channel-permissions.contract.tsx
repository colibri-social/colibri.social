import { createPermissionsContract } from "../permissions/permissions";

export const adminChannelPermissions = createPermissionsContract(
	"adminChannelPermissions",
	"channel",
);
