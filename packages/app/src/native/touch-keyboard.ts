import type { NativeTouchKeyboardRestart } from "@colibri-social/ui";
import { currentReleasePlatform } from "../data/release-notes";

type WindowBridge = { restartInput?: () => void };

const androidBridge = () => {
	return (window as unknown as { __colibriWindow?: WindowBridge })
		.__colibriWindow;
};

export const createAndroidRestart = (
	bridge: () => WindowBridge | undefined = androidBridge,
): NativeTouchKeyboardRestart => {
	return () => {
		const target = bridge();
		if (typeof target?.restartInput !== "function") return false;
		target.restartInput();
		return true;
	};
};

export const resolveTouchKeyboardRestart = (
	platform: string = currentReleasePlatform(),
): NativeTouchKeyboardRestart | undefined => {
	if (platform === "android") return createAndroidRestart();
	return undefined;
};
