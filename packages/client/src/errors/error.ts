import {
	type ColibriErrorCode,
	domainOf,
	type ErrorDomain,
	isRetryableCode,
	needsReauthentication,
} from "./codes";

export type ErrorSeverity = "info" | "warning" | "error" | "fatal";

export interface FieldProblem {
	field?: string;
	message: string;
}

export interface ColibriErrorOptions {
	code: ColibriErrorCode;
	message?: string;
	status?: number;
	method?: string;
	serverMessage?: string;
	retryAfterMs?: number;
	retryable?: boolean;
	severity?: ErrorSeverity;
	fields?: Array<FieldProblem>;
	context?: Record<string, unknown>;
	cause?: unknown;
}

export class ColibriError extends Error {
	readonly code: ColibriErrorCode;
	readonly domain: ErrorDomain;
	readonly status: number | undefined;
	readonly method: string | undefined;
	readonly serverMessage: string | undefined;
	readonly retryAfterMs: number | undefined;
	readonly retryable: boolean;
	readonly severity: ErrorSeverity;
	readonly fields: Array<FieldProblem>;
	readonly context: Record<string, unknown>;
	eventId: string | undefined;

	constructor(options: ColibriErrorOptions) {
		super(options.message ?? options.serverMessage ?? options.code, {
			cause: options.cause,
		});
		this.name = "ColibriError";
		this.code = options.code;
		this.domain = domainOf(options.code);
		this.status = options.status;
		this.method = options.method;
		this.serverMessage = options.serverMessage;
		this.retryAfterMs = options.retryAfterMs;
		this.retryable = options.retryable ?? isRetryableCode(options.code);
		this.severity = options.severity ?? "error";
		this.fields = options.fields ?? [];
		this.context = options.context ?? {};
		this.eventId = undefined;
	}

	get needsReauth(): boolean {
		return needsReauthentication(this.code);
	}

	withContext(extra: Record<string, unknown>): ColibriError {
		Object.assign(this.context, extra);
		return this;
	}
}

export const isColibriError = (value: unknown): value is ColibriError =>
	value instanceof ColibriError;

export const colibriError = (options: ColibriErrorOptions): ColibriError =>
	new ColibriError(options);

export const isRetryable = (err: unknown): boolean =>
	!isColibriError(err) || err.retryable;
