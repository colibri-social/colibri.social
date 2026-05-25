import { ActorData } from "lib";
import { Component } from "solid-js";

export const DisplayableName: Component<{ user: ActorData }> = (props) => {
	return props.user.data.displayName || props.user.handle || props.user.did;
};
