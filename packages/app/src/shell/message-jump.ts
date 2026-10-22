import { createSignal, untrack } from "solid-js";
import {
	type MessageTarget,
	messageTargetOf,
	parsePath,
	type Route,
} from "./layers";

const [pending, setPending] = createSignal<MessageTarget>();

export const pendingMessageJump = pending;

export const requestMessageJump = (target: MessageTarget) =>
	setPending({ ...target });

export const requestRouteJump = (route: Route) => {
	const target = messageTargetOf(route);
	if (target) requestMessageJump(target);
};

export const takeMessageJump = (scope: {
	space: string;
	channel: string;
	thread?: string;
}) => {
	const current = untrack(pending);
	if (
		!current ||
		current.space !== scope.space ||
		current.channel !== scope.channel ||
		current.thread !== scope.thread
	) {
		return undefined;
	}
	setPending(undefined);
	return current.rkey;
};

let launchPath: string | undefined =
	typeof location === "undefined" ? undefined : location.pathname;

export const rememberLaunchPath = (path: string) => {
	launchPath = path;
};

export const requestLaunchJump = () => {
	const path = launchPath;
	launchPath = undefined;
	if (path) requestRouteJump(parsePath(path));
};
