import { clearAppBadge } from "../utils/badge";
import { clearUserScoped } from "./cache/store";
import { beginSignOut } from "./session-health";

export const endSession = async (): Promise<void> => {
	beginSignOut();
	await clearAppBadge();
	localStorage.removeItem("sub");
	await clearUserScoped();
	window.location.replace("/app/login");
};
