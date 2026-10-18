import { Show } from "solid-js";
import { useLiveStatus } from "../data/live-context";
import { ConnectionStatus } from "./connection";

export const ConnectionSlot = (props: { platform: "mobile" | "desktop" }) => {
	const live = useLiveStatus();
	return (
		<Show when={live}>
			{(source) => (
				<ConnectionStatus
					status={source().status()}
					retryAt={source().retryAt()}
					onRetry={source().retry}
					platform={props.platform}
				/>
			)}
		</Show>
	);
};
