import type { TimestampStyle } from "@colibri-social/lib";
import { type Component, createMemo } from "solid-js";
import { formatTimestamp } from "../../../../utils/format-timestamp";
import { useNow } from "../../../../utils/now";

/**
 * Renders a `time` facet in the viewer's local timezone. Relative timestamps
 * self-update: the label is recomputed against a shared 1s clock and only
 * re-renders when the rounded phrasing actually changes (e.g. "in 5 hours" →
 * "in 42 seconds" → "3 minutes ago"). Absolute styles read no clock, so they
 * render once and never tick.
 */
export const Timestamp: Component<{
	datetime: string;
	style?: TimestampStyle;
}> = (props) => {
	const now = useNow();
	const isRelative = () => (props.style ?? "relative") === "relative";

	const label = createMemo(() =>
		isRelative()
			? formatTimestamp(props.datetime, props.style, new Date(now()))
			: formatTimestamp(props.datetime, props.style),
	);

	// Absolute long form as a hover tooltip so the precise instant is always
	// available, regardless of the chosen display style.
	const title = createMemo(() =>
		formatTimestamp(props.datetime, "datetime-long"),
	);

	return (
		<time
			data-facet-type="time"
			dateTime={props.datetime}
			title={title()}
			class="bg-orange-400/15 px-1 rounded-xs inline"
		>
			{label()}
		</time>
	);
};
