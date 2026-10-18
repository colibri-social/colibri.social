import type { LiveEvent } from "../source";
import type { RemoteLive } from "./source";
import type { RemoteSession } from "./transport";

export type RecordedCall = {
	nsid: string;
	method: string;
	params: URLSearchParams;
	headers: Headers;
	body: unknown;
};

type Reply = Response | ((call: RecordedCall) => Response | Promise<Response>);

export const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});

export const xrpcError = (status: number, error: string, message?: string) =>
	json({ error, ...(message ? { message } : {}) }, status);

export const createFakeSession = (did = "did:plc:viewer") => {
	const routes = new Map<string, Reply[]>();
	const calls: RecordedCall[] = [];

	const session: RemoteSession = {
		did,
		fetchHandler: async (path, init = {}) => {
			const url = new URL(path, "https://pds.test");
			const nsid = url.pathname.replace("/xrpc/", "");
			const headers = new Headers(init.headers);
			let body: unknown;
			if (typeof init.body === "string") body = JSON.parse(init.body);
			else if (init.body !== undefined) body = init.body;
			const call: RecordedCall = {
				nsid,
				method: init.method ?? "GET",
				params: url.searchParams,
				headers,
				body,
			};
			calls.push(call);
			const queue = routes.get(nsid);
			const reply = queue && queue.length > 1 ? queue.shift() : queue?.[0];
			if (!reply) return xrpcError(501, "MethodNotImplemented", nsid);
			return typeof reply === "function" ? reply(call) : reply.clone();
		},
	};

	return {
		session,
		calls,
		on: (nsid: string, ...replies: Reply[]) => {
			routes.set(nsid, replies);
		},
		callsTo: (nsid: string) => calls.filter((call) => call.nsid === nsid),
	};
};

export const createFakeLive = () => {
	const listeners = new Set<(event: LiveEvent) => void>();
	const sent: unknown[] = [];
	const watched: Array<{ target: unknown; released: boolean }> = [];
	const live: RemoteLive = {
		subscribe: (listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		send: (frame) => {
			sent.push(frame);
			return true;
		},
		watch: (target) => {
			const entry = { target, released: false };
			watched.push(entry);
			return () => {
				entry.released = true;
			};
		},
	};
	return {
		live,
		sent,
		watched,
		emit: (event: LiveEvent) => {
			for (const listener of listeners) listener(event);
		},
	};
};
