import type { ColibriError } from "@colibri-social/lib";
import {
	ErrorState,
	FEEDBACK_URL,
	NavHeader,
	NotFound,
} from "@colibri-social/ui";
import type { JSX } from "solid-js";
import { describeError } from "../data/error-copy";
import { openExternalUrl } from "../native/open-external";
import { useStack } from "./stack";

export const LoadErrorState = (props: {
	error: ColibriError;
	onRetry: () => unknown;
	title?: string;
	variant?: "screen" | "inline";
	actions?: JSX.Element;
	class?: string;
}) => {
	const copy = () => describeError(props.error);
	return (
		<ErrorState
			variant={props.variant}
			title={props.title ?? copy().title}
			description={copy().description}
			code={props.error.code}
			onRetry={props.error.retryable ? props.onRetry : undefined}
			actions={props.actions}
			onFeedback={() => openExternalUrl(FEEDBACK_URL)}
			class={props.class}
		/>
	);
};

export const NotFoundScreen = (props: {
	path: string;
	platform: "mobile" | "desktop";
}) => {
	const stack = useStack();
	return (
		<div
			data-not-found-screen=""
			class="flex min-h-0 flex-1 flex-col bg-background"
		>
			{props.platform === "mobile" ? (
				<NavHeader
					safeTop
					kind="back"
					navigateLabel="Back"
					onNavigate={() => stack.pop()}
				/>
			) : null}
			<NotFound path={props.path} onAction={() => stack.popTo(0)} />
		</div>
	);
};
