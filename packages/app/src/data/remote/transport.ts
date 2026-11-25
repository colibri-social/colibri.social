import {
	appViewServiceRef,
	ColibriError,
	canonicalSpaceUris,
	classifyResponse,
	classifyThrown,
	createLogger,
	isOffline,
	type Method,
	notifServiceRef,
	type Output,
} from "@colibri-social/lib";
import { registerUpload, UPLOAD_ID_HEADER } from "../../auth/upload-progress";

const log = createLogger("remote");

export type RemoteSession = {
	did: string;
	accountHost?: () => string | undefined;
	accountIssuer?: () => string | undefined;
	fetchHandler: (path: string, init?: RequestInit) => Promise<Response>;
};

export type Params = Record<
	string,
	string | number | boolean | ReadonlyArray<string> | undefined
>;

type RawBody = { data: Blob; encoding: string };

export type CallInit = {
	params?: Params;
	body?: unknown;
	raw?: RawBody;
	signal?: AbortSignal;
	attempts?: number;
	onProgress?: (fraction: number) => void;
};

const RETRY_ATTEMPTS = 3;
const RETRY_BASE_MS = 400;

const sleep = (ms: number) =>
	new Promise<void>((resolve) => setTimeout(resolve, ms));

export const encodeParams = (params: Params | undefined) => {
	const search = new URLSearchParams();
	for (const [key, value] of Object.entries(params ?? {})) {
		if (value === undefined) continue;
		if (Array.isArray(value)) {
			for (const item of value) search.append(key, item);
			continue;
		}
		search.append(key, String(value));
	}
	const encoded = search.toString();
	return encoded ? `?${encoded}` : "";
};

const readBody = async (response: Response): Promise<unknown> => {
	const text = await response.text();
	if (text.trim() === "") return {};
	try {
		return canonicalSpaceUris(JSON.parse(text) as unknown);
	} catch (cause) {
		throw new ColibriError({ code: "MalformedResponse", cause });
	}
};

export const createTransport = (input: {
	session: RemoteSession;
	appViewDid: string;
	onScopesRejected?: (method: string) => void;
}) => {
	const appViewProxy = appViewServiceRef(input.appViewDid);
	const notifProxy = notifServiceRef(input.appViewDid);

	const send = async (
		nsid: string,
		kind: "query" | "procedure",
		init: CallInit,
		proxy: string | undefined,
	): Promise<unknown> => {
		const headers = new Headers();
		if (proxy) headers.set("atproto-proxy", proxy);
		let body: BodyInit | undefined;
		if (init.raw) {
			headers.set("content-type", init.raw.encoding);
			body = init.raw.data;
		} else if (kind === "procedure" && init.body !== undefined) {
			headers.set("content-type", "application/json");
			body = JSON.stringify(canonicalSpaceUris(init.body));
		}
		const path = `/xrpc/${nsid}${encodeParams(canonicalSpaceUris(init.params))}`;
		const attempts = init.attempts ?? (kind === "query" ? RETRY_ATTEMPTS : 1);
		const upload = init.onProgress
			? registerUpload(init.onProgress)
			: undefined;

		if (upload) headers.set(UPLOAD_ID_HEADER, upload.id);

		let failure: ColibriError | undefined;
		try {
			for (let attempt = 1; attempt <= attempts; attempt++) {
				try {
					const response = await input.session.fetchHandler(path, {
						method: kind === "query" ? "GET" : "POST",
						headers,
						body,
						signal: init.signal,
					});
					if (response.ok) return await readBody(response);
					failure = classifyResponse({
						status: response.status,
						body: await response.text(),
						method: nsid,
						retryAfter: response.headers.get("retry-after"),
					});
				} catch (cause) {
					failure = classifyThrown(cause, { method: nsid });
				}
				if (!failure.retryable || isOffline() || init.signal?.aborted) break;
				if (attempt < attempts) {
					await sleep(RETRY_BASE_MS * 2 ** (attempt - 1));
				}
			}
		} finally {
			upload?.release();
		}

		const error =
			failure ?? new ColibriError({ code: "Unexpected", method: nsid });
		log.warn("request failed", { method: nsid, code: error.code });
		if (error.code === "ScopesMissing") input.onScopesRejected?.(nsid);
		throw error;
	};

	const fetchBlob = async (
		nsid: string,
		params: Params,
		proxy: string | undefined,
	): Promise<Blob> => {
		const path = `/xrpc/${nsid}${encodeParams(canonicalSpaceUris(params))}`;
		const headers = new Headers();

		if (proxy) headers.set("atproto-proxy", proxy);

		let response: Response;

		try {
			response = await input.session.fetchHandler(path, {
				method: "GET",
				headers,
			});
		} catch (cause) {
			throw classifyThrown(cause, { method: nsid });
		}

		if (!response.ok)
			throw classifyResponse({
				status: response.status,
				body: await response.text(),
				method: nsid,
				retryAfter: response.headers.get("retry-after"),
			});

		return response.blob();
	};

	return {
		did: input.session.did,
		appViewDid: input.appViewDid,
		query: <M extends Method>(method: M, init: CallInit = {}) =>
			send(method.nsid, "query", init, appViewProxy) as Promise<Output<M>>,
		procedure: <M extends Method>(method: M, init: CallInit = {}) =>
			send(method.nsid, "procedure", init, appViewProxy) as Promise<Output<M>>,
		notifProcedure: <M extends Method>(method: M, init: CallInit = {}) =>
			send(method.nsid, "procedure", init, notifProxy) as Promise<Output<M>>,
		pdsQuery: <T>(nsid: string, init: CallInit = {}) =>
			send(nsid, "query", init, undefined) as Promise<T>,
		pdsProcedure: <T>(nsid: string, init: CallInit = {}) =>
			send(nsid, "procedure", init, undefined) as Promise<T>,
		appViewQuery: <T>(nsid: string, init: CallInit = {}) =>
			send(nsid, "query", init, appViewProxy) as Promise<T>,
		appViewProcedure: <T>(nsid: string, init: CallInit = {}) =>
			send(nsid, "procedure", init, appViewProxy) as Promise<T>,
		pdsBlob: (cid: string) =>
			fetchBlob(
				"com.atproto.sync.getBlob",
				{ did: input.session.did, cid },
				undefined,
			),
		appViewBlob: (nsid: string, params: Params) =>
			fetchBlob(nsid, params, appViewProxy),
	};
};

export type Transport = ReturnType<typeof createTransport>;
