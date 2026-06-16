import type { ActorData } from "@colibri-social/lib";
import type { Component } from "solid-js";

export const displayableNameFn = (user: ActorData) =>
	user.data.displayName || user.handle || user.did;

export const DisplayableName: Component<{ user: ActorData }> = (props) => {
	return displayableNameFn(props.user);
};
