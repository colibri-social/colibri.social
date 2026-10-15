import {
	LAUNCH_SCREEN_ID,
	LAUNCH_SCREEN_LABEL,
	LAUNCH_SCREEN_STYLE,
	LAUNCH_STYLE_ID,
	launchMarkSvg,
} from "./launch-markup";

let copies = 0;

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

export const LaunchScreen = () => {
	ensureLaunchStyle();
	const adopted = documentLaunchScreen();
	if (adopted) {
		adopted.removeAttribute("id");
		return adopted;
	}
	copies += 1;
	return (
		<div
			data-launch-screen=""
			role="status"
			aria-label={LAUNCH_SCREEN_LABEL}
			innerHTML={launchMarkSvg(`launch-mark-${copies}`)}
		/>
	);
};
