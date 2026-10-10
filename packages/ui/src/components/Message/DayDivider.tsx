import { cx } from "../../utils/cx";
import type { TimeInput } from "../../utils/time";

const DAY_MS = 24 * 60 * 60 * 1000;

const toDate = (value: TimeInput) =>
	value instanceof Date ? value : new Date(value);

const dayStart = (date: Date) =>
	new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

export const formatDayLabel = (
	value: TimeInput,
	now: TimeInput = new Date(),
	locale?: string,
) => {
	const date = toDate(value);
	if (Number.isNaN(date.getTime())) return "";
	const reference = toDate(now);
	const days = Math.round((dayStart(reference) - dayStart(date)) / DAY_MS);
	if (days === 0) return "Today";
	if (days === 1) return "Yesterday";
	return new Intl.DateTimeFormat(locale, {
		weekday: "long",
		day: "numeric",
		month: "long",
		year:
			date.getFullYear() === reference.getFullYear() ? undefined : "numeric",
	}).format(date);
};

export type DayDividerProps = {
	date: TimeInput;
	now?: TimeInput;
	locale?: string;
	class?: string;
};

export const DayDivider = (props: DayDividerProps) => {
	const label = () => formatDayLabel(props.date, props.now, props.locale);
	return (
		<div
			data-day-divider=""
			class={cx(
				"flex h-5 items-center gap-2 px-(--chat-row-padding,16px) select-none",
				props.class,
			)}
		>
			<span aria-hidden="true" class="h-px flex-1 bg-border" />
			<span class="text-xs leading-4 font-semibold text-muted-foreground">
				{label()}
			</span>
			<span aria-hidden="true" class="h-px flex-1 bg-border" />
		</div>
	);
};
