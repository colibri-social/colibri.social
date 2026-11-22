import { DEFAULT_APPVIEW_URL } from "@colibri-social/lib";

const escapeRegExp = (value: string) => {
	return value.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
};

export const TRACE_PROPAGATION_TARGETS: RegExp[] = [
	/^https?:\/\/localhost(:\d+)?(\/|$)/,
	/^https:\/\/colibri\.social\/_actions/,
	/^https:\/\/colibri\.social\/api/,
	/^https:\/\/api\.colibri\.social/,
	/^https:\/\/appview\.colibri\.social/,
	new RegExp(`^${escapeRegExp(DEFAULT_APPVIEW_URL)}`),
	/^https:\/\/[a-z0-9-]+\.nodes\.colibri\.social/,
];
