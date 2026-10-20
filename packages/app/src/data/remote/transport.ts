import {
	appViewServiceRef,
	ColibriError,
	classifyResponse,
	classifyThrown,
	createLogger,
	isOffline,
	type Method,
	notifServiceRef,
	type Output,
} from "@colibri-social/lib";

const log = createLogger("remote");

export type RemoteSession = {
	did: string;
	accountHost?: () => string | undefined;
	fetchHandler: (path: string, init?: RequestInit) => Promise<Response>;
};

export type Params = Record<
	string,
	string | number | boolean | ReadonlyArray<string> | undefined
>;

export type RawBody = { data: Blob; encoding: string };

export type CallInit = {
	params?: Params;
	body?: unknown;
	raw?: RawBody;
	signal?: AbortSignal;
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
		return JSON.parse(text);
	} catch (cause) {
		throw new ColibriError({ code: "MalformedResponse", cause });
	}
};

export const createTransport = (input: {
	session: RemoteSession;
	appViewDid: string;
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
			body = JSON.stringify(init.body);
		}
		const path = `/xrpc/${nsid}${encodeParams(init.params)}`;
		const attempts = kind === "query" ? RETRY_ATTEMPTS : 1;
		let failure: ColibriError | undefined;
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
			if (attempt < attempts) await sleep(RETRY_BASE_MS * 2 ** (attempt - 1));
		}
		const error =
			failure ?? new ColibriError({ code: "Unexpected", method: nsid });
		log.warn("request failed", { method: nsid, code: error.code });
		throw error;
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
		pdsBlob: async (cid: string): Promise<Blob> => {
			const nsid = "com.atproto.sync.getBlob";
			const path = `/xrpc/${nsid}${encodeParams({ did: input.session.did, cid })}`;
			let response: Response;
			try {
				response = await input.session.fetchHandler(path, { method: "GET" });
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
		},
	};
};

export type Transport = ReturnType<typeof createTransport>;
