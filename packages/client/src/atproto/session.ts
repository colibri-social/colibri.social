import { clearAll } from "./cache/store";

export const endSession = async (): Promise<void> => {
	localStorage.removeItem("sub");
	await clearAll();
	window.location.href = "/app/login";
};
