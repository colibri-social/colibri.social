export interface FilterableEvent {
	exception?: { values?: Array<{ type?: string }> };
	tags?: Record<string, unknown> | undefined;
}

const DECLINED_EXCEPTION_TYPES = new Set([
	"NotAllowedError",
	"PermissionDeniedError",
]);

export const isDeclinedByUser = (event: FilterableEvent): boolean => {
	if (event.tags?.["voice.stage"] !== undefined) return false;

	const values = event.exception?.values;
	if (!values || values.length === 0) return false;
	return values.every(
		(value) =>
			value.type !== undefined && DECLINED_EXCEPTION_TYPES.has(value.type),
	);
};
