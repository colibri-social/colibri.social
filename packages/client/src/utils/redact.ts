const REDACTED = "[redacted]";

const SENSITIVE_KEY =
	/token|secret|password|passphrase|jwt|dpop|authorization|cookie|email/i;
const BEARER = /\bBearer\s+[\w\-._~+/]+=*/gi;
const JWT = /\beyJ[\w-]*\.[\w-]*\.[\w-]*/g;
const EMAIL = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g;

export const redactText = (value: string): string =>
	value
		.replace(BEARER, `Bearer ${REDACTED}`)
		.replace(JWT, REDACTED)
		.replace(EMAIL, REDACTED);

export const redactData = (
	data: Record<string, unknown> | undefined,
	depth = 0,
): Record<string, unknown> | undefined => {
	if (!data) return undefined;
	if (depth > 3) return {};

	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(data)) {
		if (SENSITIVE_KEY.test(key)) {
			out[key] = REDACTED;
			continue;
		}
		if (typeof value === "string") {
			out[key] = redactText(value);
		} else if (value instanceof Error) {
			out[key] = `${value.name}: ${redactText(value.message)}`;
		} else if (Array.isArray(value)) {
			out[key] = value.length;
		} else if (value && typeof value === "object") {
			out[key] = redactData(value as Record<string, unknown>, depth + 1);
		} else {
			out[key] = value;
		}
	}
	return out;
};
