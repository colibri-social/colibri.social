import { toast } from "somoto";
import { sessionDead } from "../atproto/session-health";
import { describeError, FALLBACK_COPY } from "./copy";
import { isColibriError, isRetryable } from "./error";
import { type ReportOptions, reportError } from "./report";

export interface ShowErrorOptions extends ReportOptions {
	fallbackTitle?: string;
	description?: string;
	retry?: () => void;
	report?: boolean;
}

export const showError = (
	err: unknown,
	options: ShowErrorOptions = {},
): void => {
	const {
		fallbackTitle,
		description,
		retry,
		report = true,
		...reportOptions
	} = options;

	const classified = report ? reportError(err, reportOptions) : err;

	if (sessionDead() && isColibriError(classified) && classified.needsReauth) {
		return;
	}

	const copy = err === undefined ? FALLBACK_COPY : describeError(classified);

	const title = fallbackTitle ?? copy.title;
	const body = description ?? copy.description;
	const offerRetry = retry !== undefined && isRetryable(classified);

	toast.error(title, {
		description: body,
		action: offerRetry ? { label: "Retry", onClick: retry } : undefined,
	});
};
