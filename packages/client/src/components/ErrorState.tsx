import { Show } from "solid-js";
import { classifyThrown } from "../errors/classify";
import { describeError } from "../errors/copy";
import { isRetryable } from "../errors/error";
import { ErrorDetails } from "./ErrorDetails";
import { Alert, AlertDescription, AlertTitle } from "./ui/Alert";
import { Button } from "./ui/Button";

export interface ErrorStateProps {
	error: unknown;
	retry?: () => void;
	eventId?: string;
	compact?: boolean;
	class?: string;
}

export const ErrorState = (props: ErrorStateProps) => {
	const failure = () => classifyThrown(props.error);
	const copy = () => describeError(props.error);
	const canRetry = () => props.retry !== undefined && isRetryable(props.error);

	return (
		<div
			class={`flex flex-col items-center justify-center gap-3 p-6 ${props.class ?? ""}`}
		>
			<Alert variant="destructive" class="max-w-md">
				<AlertTitle>{copy().title}</AlertTitle>
				<Show when={copy().description}>
					<AlertDescription>{copy().description}</AlertDescription>
				</Show>
			</Alert>

			<Show when={canRetry()}>
				<Button variant="secondary" size="sm" onClick={() => props.retry?.()}>
					Try again
				</Button>
			</Show>

			<Show when={!props.compact}>
				<ErrorDetails code={failure().code} eventId={props.eventId} />
			</Show>
		</div>
	);
};
