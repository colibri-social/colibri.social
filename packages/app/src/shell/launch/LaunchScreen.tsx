import { LoadingScreen } from "@colibri-social/ui";
import { onCleanup, Show } from "solid-js";
import { usePlatform } from "../../screen/platform";
import { WindowChrome } from "../desktop/TitleBar";
import {
	LAUNCH_BIRD_SIZE,
	LAUNCH_SCREEN_ID,
	LAUNCH_SCREEN_LABEL,
	LAUNCH_SCREEN_STYLE,
	LAUNCH_STYLE_ID,
} from "./launch-markup";
import { LAUNCH_TIPS, launchTips } from "./launch-tips";

const RESUME_WINDOW_MS = 1000;

const tipStart = Math.floor(Math.random() * LAUNCH_TIPS.length);
let mounted = 0;
let startedAt: number | undefined;
let endedAt: number | undefined;

const ensureLaunchStyle = () => {
	if (document.getElementById(LAUNCH_STYLE_ID)) return;
	const style = document.createElement("style");
	style.id = LAUNCH_STYLE_ID;
	style.textContent = LAUNCH_SCREEN_STYLE;
	document.head.append(style);
};

const documentLaunchScreen = () => {
	const node = document.getElementById(LAUNCH_SCREEN_ID);
	return node?.parentNode === document.body ? node : undefined;
};

export const dismissDocumentLaunchScreen = () => {
	documentLaunchScreen()?.remove();
};

const claimLaunchStart = () => {
	const now = performance.now();
	const lapsed =
		mounted === 0 && endedAt !== undefined && now - endedAt > RESUME_WINDOW_MS;
	if (startedAt === undefined || lapsed) startedAt = now;
	mounted += 1;
	onCleanup(() => {
		mounted -= 1;
		if (mounted === 0) endedAt = performance.now();
	});
	return startedAt;
};

export const LaunchScreen = () => {
	ensureLaunchStyle();
	const platform = usePlatform();
	const since = claimLaunchStart();
	return (
		<div data-launch-screen="">
			<Show when={platform() === "desktop"}>
				<div class="absolute inset-x-0 top-0 z-10">
					<WindowChrome />
				</div>
			</Show>
			<LoadingScreen
				class="absolute inset-0"
				label={LAUNCH_SCREEN_LABEL}
				tips={launchTips(platform())}
				tipStart={tipStart}
				since={since}
				birdSize={LAUNCH_BIRD_SIZE}
			/>
		</div>
	);
};
