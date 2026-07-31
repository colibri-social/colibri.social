import type { ColibriError } from "../../errors/error";

export interface XrpcOk<T> {
	ok: true;
	data: T;
	queued?: boolean;
}

export interface XrpcFail {
	ok: false;
	error: ColibriError;
}

export type XrpcResult<T> = XrpcOk<T> | XrpcFail;

export const xrpcOk = <T>(data: T, queued?: boolean): XrpcOk<T> =>
	queued ? { ok: true, data, queued: true } : { ok: true, data };

export const xrpcFail = (error: ColibriError): XrpcFail => ({
	ok: false,
	error,
});

export const dataOr = <T, F>(result: XrpcResult<T>, fallback: F): T | F =>
	result.ok ? result.data : fallback;

export const errorOf = <T>(result: XrpcResult<T>): ColibriError | undefined =>
	result.ok ? undefined : result.error;
