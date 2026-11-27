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
		description={`${props.name} is hosted by ${props.host}, which is currently not responding. Nothing you've sent is lost, and the Space opens again on its own once they're back.`}
		onRetry={props.onRetry}
		retrying={props.retrying}
		class={props.class}
	/>
);
