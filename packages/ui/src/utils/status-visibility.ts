import type { Presence } from "../components/Avatar/Avatar";

export type StatusVisibilityOptions = {
	presence?: Presence;
	showWhileOffline?: boolean;
	own?: boolean;
};

export const isStatusVisible = (options: StatusVisibilityOptions) =>
	options.own === true ||
	options.presence !== "offline" ||
	options.showWhileOffline === true;

export const visibleStatus = <T>(
	status: T | undefined,
	options: StatusVisibilityOptions,
): T | undefined => (isStatusVisible(options) ? status : undefined);
