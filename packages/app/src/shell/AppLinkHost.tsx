import { toast } from "@colibri-social/ui";
import { onCleanup } from "solid-js";
import { useBadges } from "../data/badges";
import { useData } from "../data/store";
import {
	bumpSupporterLink,
	type LinkOutcome,
	linkErrorMessage,
	linkSuccessMessage,
	listenForLinkOutcomes,
} from "../data/supporter-link";
import { listenForAppLinks } from "../native/deep-links";
import { listenForSettingsShortcut } from "../native/settings-shortcut";
import {
	parsePath,
	type Route,
	routeRoot,
	SETTINGS_PATH,
	withoutMessages,
} from "./layers";
import { requestLaunchJump, requestRouteJump } from "./message-jump";
import type { Navigator } from "./stack";

export const AppLinkHost = (props: {
	stack: Pick<Navigator, "setRoot" | "push">;
}) => {
	const data = useData();
	const badges = useBadges();
	const open = (route: Route) => {
		requestRouteJump(route);
		const plain = withoutMessages(route);
		const root = routeRoot(plain);
		if (root) props.stack.setRoot(root);
		for (const layer of plain.layers) props.stack.push(layer);
	};
	const settle = (outcome: LinkOutcome) => {
		badges.invalidate(data.viewer.did);
		bumpSupporterLink();
		open(parsePath(`${SETTINGS_PATH}/support`));
		if (outcome.status === "linked") toast.success(linkSuccessMessage(outcome));
		else toast.error(linkErrorMessage(outcome.reason));
	};
	requestLaunchJump();
	onCleanup(listenForAppLinks(open));
	onCleanup(listenForLinkOutcomes(settle));
	onCleanup(listenForSettingsShortcut(props.stack));
	return null;
};
