import type { Activity, ActivityKind, Presence } from "./views";

const KIND_LABELS: Record<ActivityKind, (source: string) => string> = {
	listening: (source) => `Listening to ${source}`,
	playing: () => "Playing",
	streaming: (source) => `Streaming on ${source}`,
};

export const activityOf = (
	presence: Presence | undefined,
): Activity[] | undefined => presence?.activities;

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

export const liveActivitiesOf = (
	presence: Presence | undefined,
): Activity[] => {
	const activities = activityOf(presence);
	return (activities ?? [])
		.map((activity) => (activityIsLive(activity) ? activity : undefined))
		.filter((x) => typeof x !== "undefined");
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
	activities: Iterable<Activity | undefined> | undefined,
): void => {
	for (const activity of activities ?? [])
		warmActivityImage(activity?.imageUri);
};
