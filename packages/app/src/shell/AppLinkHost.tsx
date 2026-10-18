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
import { parsePath, type Route, routeRoot, SETTINGS_PATH } from "./layers";
import type { Navigator } from "./stack";

export const AppLinkHost = (props: {
	stack: Pick<Navigator, "setRoot" | "push">;
}) => {
	const data = useData();
	const badges = useBadges();
	const open = (route: Route) => {
		const root = routeRoot(route);
		if (root) props.stack.setRoot(root);
		for (const layer of route.layers) props.stack.push(layer);
	};
	const settle = (outcome: LinkOutcome) => {
		badges.invalidate(data.viewer.did);
		bumpSupporterLink();
		open(parsePath(`${SETTINGS_PATH}/support`));
		if (outcome.status === "linked") toast.success(linkSuccessMessage(outcome));
		else toast.error(linkErrorMessage(outcome.reason));
	};
	onCleanup(listenForAppLinks(open));
	onCleanup(listenForLinkOutcomes(settle));
	return null;
};
