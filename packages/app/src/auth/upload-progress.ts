export const UPLOAD_ID_HEADER = "x-colibri-upload-id";

type ProgressCallback = (fraction: number) => void;

const NULL_BODY_STATUSES = new Set([101, 103, 204, 205, 304]);
const FRAME_FALLBACK_MS = 16;

const callbacks = new Map<string, ProgressCallback>();
let nextId = 0;

export const registerUpload = (onProgress: ProgressCallback) => {
	nextId += 1;

	const id = String(nextId);

	callbacks.set(id, onProgress);

	return {
		id,
		release: () => {
			callbacks.delete(id);
		},
	};
};

export const progressCallbackFor = (id: string) => {
	return callbacks.get(id);
};

const parseHeaders = (raw: string) => {
	const headers = new Headers();

	for (const line of raw.trim().split(/[\r\n]+/)) {
		const separator = line.indexOf(":");

		if (separator <= 0) continue;

		headers.append(
			line.slice(0, separator).trim(),
			line.slice(separator + 1).trim(),
		);
	}

	return headers;
};

const abortReasonOf = (signal: AbortSignal) => {
	return signal.reason ?? new DOMException("Request aborted", "AbortError");
};

export const xhrFetch = async (
	request: Request,
	signal: AbortSignal | undefined,
	onProgress: ProgressCallback,
): Promise<Response> => {
	if (signal?.aborted) throw abortReasonOf(signal);

	const body =
		request.method === "GET" || request.method === "HEAD"
			? undefined
			: await request.blob();

	if (signal?.aborted) throw abortReasonOf(signal);

	return new Promise<Response>((resolve, reject) => {
		const xhr = new XMLHttpRequest();

		const onAbort = () => xhr.abort();

		const settle = () => {
			signal?.removeEventListener("abort", onAbort);
		};

		xhr.open(request.method, request.url);
		xhr.responseType = "blob";

		request.headers.forEach((value, key) => {
			if (key.toLowerCase() !== UPLOAD_ID_HEADER) {
				xhr.setRequestHeader(key, value);
			}
		});

		xhr.upload.onprogress = (event) => {
			if (event.lengthComputable && event.total > 0) {
				onProgress(Math.min(1, event.loaded / event.total));
			}
		};

		xhr.onload = () => {
			settle();

			try {
				resolve(
					new Response(
						NULL_BODY_STATUSES.has(xhr.status) ? null : xhr.response,
						{
							status: xhr.status,
							statusText: xhr.statusText,
							headers: parseHeaders(xhr.getAllResponseHeaders()),
						},
					),
				);
			} catch {
				reject(new TypeError("Network request failed"));
			}
		};

		xhr.onerror = () => {
			settle();
			reject(new TypeError("Network request failed"));
		};

		xhr.ontimeout = () => {
			settle();
			reject(new TypeError("Network request timed out"));
		};

		xhr.onabort = () => {
			settle();
			reject(
				signal?.aborted
					? abortReasonOf(signal)
					: new DOMException("Request aborted", "AbortError"),
			);
		};

		signal?.addEventListener("abort", onAbort, { once: true });

		xhr.send(body ?? null);
	});
};

const scheduleFrame = (callback: () => void) => {
	if (typeof requestAnimationFrame === "function") {
		const handle = requestAnimationFrame(callback);

		return () => cancelAnimationFrame(handle);
	}

	const handle = setTimeout(callback, FRAME_FALLBACK_MS);

	return () => clearTimeout(handle);
};

export const throttleToFrames = (onProgress: ProgressCallback | undefined) => {
	let pending: number | undefined;
	let cancel: (() => void) | undefined;

	const flush = () => {
		cancel = undefined;

		if (pending === undefined) return;

		const fraction = pending;

		pending = undefined;
		onProgress?.(fraction);
	};

	const stop = () => {
		cancel?.();
		cancel = undefined;
		pending = undefined;
	};

	return {
		report: (fraction: number) => {
			if (!onProgress) return;

			pending = fraction;
			cancel ??= scheduleFrame(flush);
		},
		stop,
	};
};
