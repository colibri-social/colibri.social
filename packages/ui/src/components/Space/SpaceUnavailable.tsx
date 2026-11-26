import { ErrorState } from "../ErrorState/ErrorState";

export type SpaceUnavailableProps = {
	name: string;
	host: string;
	onRetry?: () => unknown;
	retrying?: boolean;
	variant?: "screen" | "inline";
	class?: string;
};

export const SpaceUnavailable = (props: SpaceUnavailableProps) => (
	<ErrorState
		variant={props.variant}
		title={`${props.name} can't be reached right now`}
		description={`This Space runs on ${props.host}, and that server isn't answering. Messages that were already sent are safe, and Colibri keeps trying in the background.`}
		onRetry={props.onRetry}
		retrying={props.retrying}
		class={props.class}
	/>
);
