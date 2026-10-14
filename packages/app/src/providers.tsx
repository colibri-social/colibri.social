import {
	type Haptics,
	HapticsProvider,
	installIconEffects,
	installMotionTokens,
	Toaster,
} from "@colibri-social/ui";
import type { ParentComponent } from "solid-js";
import { usePlatform } from "./screen/platform";

installMotionTokens();
installIconEffects();

const vibrate = (pattern: number | number[]) => {
	if (typeof navigator !== "undefined" && "vibrate" in navigator) {
		navigator.vibrate(pattern);
	}
};

const webHaptics: Haptics = {
	impact: (style) => vibrate(style === "heavy" || style === "rigid" ? 14 : 8),
	selection: () => {},
	notification: (type) => vibrate(type === "error" ? [10, 40, 10] : 10),
};

export const Providers: ParentComponent = (props) => {
	const platform = usePlatform();
	return (
		<HapticsProvider haptics={webHaptics}>
			{props.children}
			<Toaster platform={platform()} />
		</HapticsProvider>
	);
};
