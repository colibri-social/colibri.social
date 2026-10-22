import type {
	ColibriError,
	ColibriErrorCode,
	ErrorCopy,
} from "@colibri-social/lib";
import { ErrorState, FEEDBACK_URL } from "@colibri-social/ui";
import { type JSX, Show } from "solid-js";
import { describeError } from "../../data/error-copy";
import { openExternalUrl } from "../../native/open-external";
import { usePlatform } from "../../screen/platform";
import { WindowChrome } from "../desktop/TitleBar";

const CANT_CONNECT: ErrorCopy = {
	title: "Colibri can't connect right now",
	description:
		"Check your internet connection, then try again. Your messages and Spaces are safe.",
};

const STARTUP_COPY: Partial<Record<ColibriErrorCode, ErrorCopy>> = {
	Offline: {
		title: "You're offline",
		description:
			"Connect to the internet, then try again. Your messages and Spaces are safe.",
	},
	Timeout: CANT_CONNECT,
	Unreachable: CANT_CONNECT,
	NetworkFailed: CANT_CONNECT,
};

export const startupCopy = (error: ColibriError): ErrorCopy =>
	STARTUP_COPY[error.code] ?? describeError(error);

export const StartupError = (props: {
	error: ColibriError;
	onRetry: () => unknown;
	report?: JSX.Element;
}) => {
	const platform = usePlatform();
	const copy = () => startupCopy(props.error);
	return (
		<div
			data-startup-error=""
			class="fixed inset-0 z-[300] flex flex-col bg-background"
		>
			<Show when={platform() === "desktop"}>
				<WindowChrome />
			</Show>
			<div class="flex min-h-0 flex-1 flex-col pt-safe px-safe pb-safe">
				<ErrorState
					title={copy().title}
					description={copy().description}
					code={props.error.code}
					onRetry={props.onRetry}
					report={props.report}
					onFeedback={() => openExternalUrl(FEEDBACK_URL)}
				/>
			</div>
		</div>
	);
};
