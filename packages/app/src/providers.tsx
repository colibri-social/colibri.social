import {
	HapticsProvider,
	installIconEffects,
	installMotionTokens,
	Toaster,
} from "@colibri-social/ui";
import type { ParentComponent } from "solid-js";
import { installAppActivity } from "./native/app-active";
import { installContextMenuGuard } from "./native/context-menu-guard";
import { resolveHaptics } from "./native/haptics";
import { installReceiveFiles } from "./native/receive-files";
import { usePlatform } from "./screen/platform";

installMotionTokens();
installIconEffects();
installAppActivity();
installReceiveFiles();
installContextMenuGuard();

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
