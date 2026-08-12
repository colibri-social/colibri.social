export const MIN_CHANNEL_SIDEBAR_WIDTH = 200;
export const MAX_CHANNEL_SIDEBAR_WIDTH = 360;
export const DEFAULT_CHANNEL_SIDEBAR_WIDTH = 288;

export const clampSidebarWidth = (value: unknown): number =>
	typeof value === "number" && Number.isFinite(value)
		? Math.max(
				MIN_CHANNEL_SIDEBAR_WIDTH,
				Math.min(MAX_CHANNEL_SIDEBAR_WIDTH, value),
			)
		: DEFAULT_CHANNEL_SIDEBAR_WIDTH;
