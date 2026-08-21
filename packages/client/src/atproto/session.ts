import { clearAppBadge } from "../utils/badge";
import { clearUserScoped } from "./cache/store";
import { beginSignOut } from "./session-health";

const LOGIN_PATH = "/app/login";

let ending = false;

export const endSession = async (): Promise<void> => {
	if (ending) return;
	ending = true;

	beginSignOut();
	await clearAppBadge();
	localStorage.removeItem("sub");
	await clearUserScoped();

	if (window.location.pathname === LOGIN_PATH) {
		ending = false;
		return;
	}

	window.location.replace(LOGIN_PATH);
};
