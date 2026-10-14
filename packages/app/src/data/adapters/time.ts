const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const formatAge = (value: string | Date, now: Date = new Date()) => {
	const date = value instanceof Date ? value : new Date(value);
	const elapsed = now.getTime() - date.getTime();
	if (Number.isNaN(elapsed) || elapsed < MINUTE) return "now";
	if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m`;
	if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h`;
	if (elapsed < 7 * DAY) return `${Math.floor(elapsed / DAY)}d`;
	return `${Math.floor(elapsed / (7 * DAY))}w`;
};
