import type { Activity, ActivityKind, Presence } from "./views";

const KIND_LABELS: Record<ActivityKind, (source: string) => string> = {
	listening: (source) => `Listening to ${source}`,
	playing: () => "Playing",
	streaming: (source) => `Streaming on ${source}`,
};

export const activityOf = (
	presence: Presence | undefined,
): Activity | undefined => presence?.activity;

export const activityLabel = (activity: Activity): string => {
	const label = KIND_LABELS[activity.kind as ActivityKind];
	return label ? label(activity.source) : activity.source;
};

export const activityIsLive = (activity: Activity | undefined): boolean => {
	if (!activity) return false;
	if (activity.endsAt === undefined) return true;

	const endsAt = Date.parse(activity.endsAt);
	return Number.isNaN(endsAt) || endsAt > Date.now();
};

export const liveActivityOf = (
	presence: Presence | undefined,
): Activity | undefined => {
	const activity = activityOf(presence);
	return activityIsLive(activity) ? activity : undefined;
};

export const activitySummary = (activity: Activity): string =>
	activity.subtitle
		? `${activity.title} · ${activity.subtitle}`
		: activity.title;

const warmed = new Set<string>();

export const warmActivityImage = (imageUri: string | undefined): void => {
	if (!imageUri || warmed.has(imageUri)) return;
	if (typeof Image === "undefined") return;

	warmed.add(imageUri);
	new Image().src = imageUri;
};

export const warmActivityImages = (
	activities: Iterable<Activity | undefined>,
): void => {
	for (const activity of activities) warmActivityImage(activity?.imageUri);
};
