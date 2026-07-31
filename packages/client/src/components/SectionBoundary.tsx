import { createSignal, ErrorBoundary, type JSX, onMount } from "solid-js";
import { classifyThrown } from "../errors/classify";
import { reportError } from "../errors/report";
import { createLogger } from "../utils/logger";
import { ErrorState } from "./ErrorState";

const log = createLogger("boundary");

export interface SectionBoundaryProps {
	name: string;
	compact?: boolean;
	children: JSX.Element;
}

const Fallback = (props: {
	name: string;
	compact?: boolean;
	error: unknown;
	reset: () => void;
}) => {
	const [eventId, setEventId] = createSignal<string | undefined>(undefined);

	onMount(() => {
		log.error("section crashed", {
			section: props.name,
			code: classifyThrown(props.error).code,
		});
		setEventId(
			reportError(props.error, {
				stage: "render",
				tags: { section: props.name },
				severity: "fatal",
			}).eventId,
		);
	});

	return (
		<ErrorState
			error={props.error}
			retry={props.reset}
			eventId={eventId()}
			compact={props.compact}
		/>
	);
};

export const SectionBoundary = (props: SectionBoundaryProps) => (
	<ErrorBoundary
		fallback={(error: unknown, reset: () => void) => (
			<Fallback
				name={props.name}
				compact={props.compact}
				error={error}
				reset={reset}
			/>
		)}
	>
		{props.children}
	</ErrorBoundary>
);
