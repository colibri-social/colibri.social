import type { TimestampStyle } from "@colibri-social/lib";

const RELATIVE_DIVISIONS: Array<{
	amount: number;
	unit: Intl.RelativeTimeFormatUnit;
}> = [
	{ amount: 60, unit: "second" },
	{ amount: 60, unit: "minute" },
	{ amount: 24, unit: "hour" },
	{ amount: 7, unit: "day" },
	{ amount: 4.34524, unit: "week" },
	{ amount: 12, unit: "month" },
	{ amount: Number.POSITIVE_INFINITY, unit: "year" },
];

const formatRelative = (date: Date, now: Date = new Date()): string => {
	let duration = (date.getTime() - now.getTime()) / 1000;

	for (const division of RELATIVE_DIVISIONS) {
		if (Math.abs(duration) < division.amount) {
			return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
				Math.round(duration),
				division.unit,
			);
		}
		duration /= division.amount;
	}

	return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
		Math.round(duration),
		"year",
	);
};

/**
 * Formats an ISO datetime string per a Discord-style timestamp display style.
 */
export const formatTimestamp = (
	datetime: string,
	style: TimestampStyle = "relative",
	now: Date = new Date(),
): string => {
	const date = new Date(datetime);
	if (Number.isNaN(date.getTime())) return datetime;

	switch (style) {
		case "time-short":
			return new Intl.DateTimeFormat(undefined, {
				hour: "numeric",
				minute: "2-digit",
			}).format(date);
		case "time-long":
			return new Intl.DateTimeFormat(undefined, {
				hour: "numeric",
				minute: "2-digit",
				second: "2-digit",
			}).format(date);
		case "date-short":
			return new Intl.DateTimeFormat(undefined, { dateStyle: "short" }).format(
				date,
			);
		case "date-long":
			return new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(
				date,
			);
		case "datetime-short":
			return new Intl.DateTimeFormat(undefined, {
				dateStyle: "short",
				timeStyle: "short",
			}).format(date);
		case "datetime-long":
			return new Intl.DateTimeFormat(undefined, {
				dateStyle: "long",
				timeStyle: "short",
			}).format(date);
		case "relative":
		default:
			return formatRelative(date, now);
	}
};
