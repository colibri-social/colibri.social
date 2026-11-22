import {
	HapticsProvider,
	installIconEffects,
	installMotionTokens,
	setNativeTouchKeyboardRestart,
	Toaster,
} from "@colibri-social/ui";
import type { ParentComponent } from "solid-js";
import { installAppActivity } from "./native/app-active";
import { installContextMenuGuard } from "./native/context-menu-guard";
import { resolveHaptics } from "./native/haptics";
import { installReceiveFiles } from "./native/receive-files";
import { resolveTouchKeyboardRestart } from "./native/touch-keyboard";
import { usePlatform } from "./screen/platform";

installMotionTokens();
installIconEffects();
installAppActivity();
installReceiveFiles();
installContextMenuGuard();
setNativeTouchKeyboardRestart(resolveTouchKeyboardRestart());

const haptics = resolveHaptics();

export const Providers: ParentComponent = (props) => {
	const platform = usePlatform();
	return (
		<HapticsProvider haptics={haptics}>
			{props.children}
			<Toaster platform={platform()} />
		</HapticsProvider>
	);
};
