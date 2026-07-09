import { type Component, createMemo } from "solid-js";
import {
	formatMessageTimestamp,
	formatTimestamp,
} from "../../../../utils/format-timestamp";
import { useNow } from "../../../../utils/now";

export const MessageTimestamp: Component<{ datetime: string }> = (props) => {
	const now = useNow();
	const label = createMemo(() =>
		formatMessageTimestamp(props.datetime, new Date(now())),
	);
	const title = createMemo(() =>
		formatTimestamp(props.datetime, "datetime-long"),
	);

	return (
		<time dateTime={props.datetime} title={title()}>
			{label()}
		</time>
	);
};
