import { clearUserScoped } from "./cache/store";

export const endSession = async (): Promise<void> => {
	localStorage.removeItem("sub");
	await clearUserScoped();
	window.location.replace("/app/login");
};
