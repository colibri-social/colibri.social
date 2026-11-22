export type TimeInput = Date | string | number;

const DAY_MS = 24 * 60 * 60 * 1000;

const toDate = (value: TimeInput) =>
	value instanceof Date ? value : new Date(value);

const startOfDay = (date: Date) =>
	new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

export const isSameDay = (a: TimeInput, b: TimeInput) =>
	startOfDay(toDate(a)) === startOfDay(toDate(b));

export const formatShortTime = (value: TimeInput, locale?: string) =>
	new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(toDate(value));

export const formatMessageTime = (
	value: TimeInput,
	now: TimeInput = new Date(),
	locale?: string,
) => {
	const date = toDate(value);
	if (Number.isNaN(date.getTime())) return "";
	const reference = toDate(now);
	const time = formatShortTime(date, locale);
	const days = Math.round((startOfDay(reference) - startOfDay(date)) / DAY_MS);
	if (days === 0) return time;
	if (days === 1) return `Yesterday at ${time}`;
	return new Intl.DateTimeFormat(locale, {
		dateStyle: "short",
		timeStyle: "short",
	}).format(date);
};

export const formatFullTimestamp = (value: TimeInput, locale?: string) => {
	const date = toDate(value);
	if (Number.isNaN(date.getTime())) return "";
	return new Intl.DateTimeFormat(locale, {
		dateStyle: "full",
		timeStyle: "short",
	}).format(date);
};
