import { classifyThrown, createLogger } from "@colibri-social/lib";
import { toast } from "@colibri-social/ui";
import { describeError } from "../../../data/error-copy";

const log = createLogger("settings/devices");

export const reportDeviceError = (
	thrown: unknown,
	method: string,
	title: string,
) => {
	const error = classifyThrown(thrown, { method });
	log.warn(`${method} failed`, { code: error.code });
	const copy = describeError(error);
	toast.error(title, {
		description: copy.description ?? "Give it another try.",
	});
	return copy;
};
