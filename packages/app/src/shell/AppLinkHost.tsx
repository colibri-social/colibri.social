import { onCleanup } from "solid-js";
import { listenForAppLinks } from "../native/deep-links";
import type { Navigator } from "./stack";

export const AppLinkHost = (props: {
	stack: Pick<Navigator, "setRoot" | "push">;
}) => {
	onCleanup(
		listenForAppLinks((route) => {
			props.stack.setRoot(route.root);
			for (const layer of route.layers) props.stack.push(layer);
		}),
	);
	return null;
};
