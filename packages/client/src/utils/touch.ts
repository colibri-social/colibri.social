import createMediaQuery from "./create-media-query";

export const TOUCH_QUERY = "(pointer: coarse)";

export const useIsTouch = () => createMediaQuery(TOUCH_QUERY);

export const isTouchNow = () =>
	typeof matchMedia !== "undefined" && matchMedia(TOUCH_QUERY).matches;
