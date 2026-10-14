export type ColibriErrorCode =
	| "Offline"
	| "Timeout"
	| "NetworkFailed"
	| "AuthRequired"
	| "Forbidden"
	| "NotFound"
	| "RateLimited"
	| "UpstreamFailure"
	| "InternalError"
	| "InvalidRequest"
	| "Unexpected";

const RETRYABLE_CODES: ReadonlySet<ColibriErrorCode> = new Set([
	"Offline",
	"Timeout",
	"NetworkFailed",
	"RateLimited",
	"UpstreamFailure",
	"InternalError",
	"Unexpected",
]);

export type ColibriErrorOptions = {
	code: ColibriErrorCode;
	message?: string;
	status?: number;
	method?: string;
	context?: Record<string, unknown>;
	cause?: unknown;
};

export class ColibriError extends Error {
	readonly code: ColibriErrorCode;
	readonly status: number | undefined;
	readonly method: string | undefined;
	readonly retryable: boolean;
	readonly context: Record<string, unknown>;

	constructor(options: ColibriErrorOptions) {
		super(options.message ?? options.code, { cause: options.cause });
		this.name = "ColibriError";
		this.code = options.code;
		this.status = options.status;
		this.method = options.method;
		this.retryable = RETRYABLE_CODES.has(options.code);
		this.context = options.context ?? {};
	}
}

export const isColibriError = (value: unknown): value is ColibriError =>
	value instanceof ColibriError;

const nameOf = (err: unknown) => {
	if (!err || typeof err !== "object") return undefined;
	const name = (err as { name?: unknown }).name;
	return typeof name === "string" ? name : undefined;
};

const statusOf = (err: unknown) => {
	if (!err || typeof err !== "object" || !("status" in err)) return undefined;
	const status = (err as { status: unknown }).status;
	return typeof status === "number" ? status : undefined;
};

const codeForStatus = (status: number): ColibriErrorCode => {
	if (status === 401) return "AuthRequired";
	if (status === 403) return "Forbidden";
	if (status === 404) return "NotFound";
	if (status === 429) return "RateLimited";
	if (status === 502 || status === 503 || status === 504) {
		return "UpstreamFailure";
	}
	if (status >= 500) return "InternalError";
	return "InvalidRequest";
};

const PROGRAMMING_TYPE_ERROR =
	/cannot read propert|cannot set propert|is not a function|is not iterable|is undefined|is null|cannot destructure/i;

const codeForShape = (err: unknown): ColibriErrorCode | undefined => {
	const name = nameOf(err);
	if (name === "TimeoutError" || name === "AbortError") return "Timeout";
	if (err instanceof TypeError) {
		return PROGRAMMING_TYPE_ERROR.test(err.message)
			? undefined
			: "NetworkFailed";
	}
	return undefined;
};

export type ClassifyInput = {
	method?: string;
	context?: Record<string, unknown>;
};

export const classifyThrown = (
	err: unknown,
	input: ClassifyInput = {},
): ColibriError => {
	if (isColibriError(err)) return err;
	const shared = { method: input.method, context: input.context, cause: err };
	if (typeof navigator !== "undefined" && navigator.onLine === false) {
		return new ColibriError({ ...shared, code: "Offline" });
	}
	const shape = codeForShape(err);
	if (shape) return new ColibriError({ ...shared, code: shape });
	const status = statusOf(err);
	if (status !== undefined && status >= 100) {
		return new ColibriError({ ...shared, code: codeForStatus(status), status });
	}
	const message = err instanceof Error ? err.message : String(err);
	return new ColibriError({ ...shared, code: "Unexpected", message });
};

export type LogData = Record<string, unknown>;

export type Logger = {
	debug: (message: string, data?: LogData) => void;
	info: (message: string, data?: LogData) => void;
	warn: (message: string, data?: LogData) => void;
	error: (message: string, data?: LogData) => void;
};

export const createLogger = (scope: string): Logger => {
	const prefix = `[${scope}]`;
	const write =
		(sink: (...values: unknown[]) => void) =>
		(message: string, data?: LogData) => {
			if (data) sink(prefix, message, data);
			else sink(prefix, message);
		};
	return {
		debug: write(console.debug),
		info: write(console.info),
		warn: write(console.warn),
		error: write(console.error),
	};
};

export type ErrorCopy = { title: string; description: string };

const CONNECTION_COPY: ErrorCopy = {
	title: "Couldn't reach Colibri",
	description: "Check your connection and try again.",
};

const COPY: Partial<Record<ColibriErrorCode, ErrorCopy>> = {
	Offline: {
		title: "You're offline",
		description: "Reconnect to the internet and try again.",
	},
	Timeout: CONNECTION_COPY,
	NetworkFailed: CONNECTION_COPY,
	UpstreamFailure: CONNECTION_COPY,
	RateLimited: {
		title: "Too many requests",
		description: "Wait a moment, then try again.",
	},
	Forbidden: {
		title: "You don't have access",
		description: "Ask a moderator if you think you should.",
	},
	AuthRequired: {
		title: "You're signed out",
		description: "Sign in again to keep going.",
	},
	NotFound: {
		title: "This couldn't be found",
		description: "It may have been deleted or moved.",
	},
};

export const describeError = (error: ColibriError): ErrorCopy =>
	COPY[error.code] ?? {
		title: "Something went wrong",
		description: "This didn't load. Try again in a moment.",
	};
