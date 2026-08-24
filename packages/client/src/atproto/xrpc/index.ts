import type { Agent } from "@atproto/api";
import { Client } from "@atproto/lex-client";
import { classifyThrown } from "../../errors/classify";
import { ColibriError } from "../../errors/error";
import {
	appViewServiceRef,
	getAppViewDid,
	getAppViewHostFromDid,
	notifServiceRef,
} from "../../utils/appview";
import {
	reportXrpcFailure,
	reportXrpcNetworkError,
} from "../../utils/dev-diagnostics";
import { createLogger } from "../../utils/logger";
import { perfNow, recordRequest } from "../../utils/perf";
import { enqueueAppview, setAppviewExecutor } from "../outbox/outbox";
import { methodByNsid } from "./registry";
import { type CallOptions, call, type Method, type Output } from "./request";
import { type XrpcResult, xrpcFail, xrpcOk } from "./result";

const log = createLogger("xrpc");

export type Service = "appview" | "notif";

export interface QueuedOptions extends CallOptions {
	label?: string;
	service?: Service;
}

const SERVICE_AUTH_LIFETIME_SECONDS = 60;

const nsidFromPath = (path: string): string =>
	/\/xrpc\/([^?/]+)/.exec(path)?.[1] ?? path;

const isDeferrable = (error: ColibriError): boolean =>
	error.retryable || error.code === "Offline" || error.code === "Timeout";

export class ColibriClient {
	readonly appViewDid: string;

	private readonly agent: Agent;
	private readonly appview: Client;
	private readonly notif: Client;

	constructor(agent: Agent, appViewDid: string) {
		this.agent = agent;
		this.appViewDid = appViewDid;
		this.appview = this.build(appViewServiceRef(appViewDid));
		this.notif = this.build(notifServiceRef(appViewDid));
	}

	private build(serviceRef: string): Client {
		return new Client({
			did: this.agent.did as never,
			fetchHandler: (path, init) => this.dispatch(serviceRef, path, init),
		});
	}

	private async dispatch(
		serviceRef: string,
		path: string,
		init: RequestInit,
	): Promise<Response> {
		const lxm = nsidFromPath(path);
		const start = perfNow();

		const headers = new Headers(init.headers);
		headers.set("atproto-proxy", serviceRef);

		const origin = import.meta.env.DEV
			? getAppViewHostFromDid(this.appViewDid, "http")
			: null;

		if (origin) {
			const token = await this.serviceAuthToken(lxm, serviceRef);
			if (token) headers.set("Authorization", `Bearer ${token}`);
		}

		const request = origin
			? fetch(`${origin}${path}`, { ...init, headers })
			: this.agent.fetchHandler(path as `/xrpc/${string}`, {
					...init,
					headers,
				});

		return request.then(
			(res) => {
				recordRequest(lxm, start, perfNow() - start, res.ok);
				if (!res.ok) {
					log.warn("request failed", { method: lxm, status: res.status });
					if (import.meta.env.DEV) void reportXrpcFailure(lxm, res.clone());
				}
				return res;
			},
			(err: unknown) => {
				if (init.signal?.aborted) throw err;
				recordRequest(lxm, start, perfNow() - start, false);
				log.error("request could not be sent", {
					method: lxm,
					code: classifyThrown(err, { method: lxm }).code,
				});
				reportXrpcNetworkError(lxm, err);
				throw err;
			},
		);
	}

	private async serviceAuthToken(
		lxm: string,
		aud: string,
	): Promise<string | undefined> {
		try {
			const { data } = await this.agent.com.atproto.server.getServiceAuth({
				aud,
				lxm,
				exp: Math.floor(Date.now() / 1000) + SERVICE_AUTH_LIFETIME_SECONDS,
			});
			return data.token;
		} catch (err) {
			log.warn("could not mint service auth", {
				method: lxm,
				code: classifyThrown(err, { method: lxm }).code,
			});
			return undefined;
		}
	}

	private clientFor(service: Service): Client {
		return service === "notif" ? this.notif : this.appview;
	}

	call<M extends Method>(
		method: M,
		input?: Record<string, unknown>,
		options?: CallOptions,
	): Promise<XrpcResult<Output<M>>> {
		return call(this.appview, method, input, options);
	}

	push<M extends Method>(
		method: M,
		input?: Record<string, unknown>,
		options?: CallOptions,
	): Promise<XrpcResult<Output<M>>> {
		return call(this.notif, method, input, options);
	}

	async queued<M extends Method>(
		method: M,
		input?: Record<string, unknown>,
		options?: QueuedOptions,
	): Promise<XrpcResult<Output<M> | undefined>> {
		const service = options?.service ?? "appview";
		const result = await call(this.clientFor(service), method, input, options);
		if (result.ok || !isDeferrable(result.error)) return result;

		log.warn("deferring a write that could not be sent", {
			method: method.nsid,
			code: result.error.code,
		});
		await enqueueAppview({
			service,
			lxm: method.nsid,
			input: input ?? {},
			label: options?.label,
		});
		return xrpcOk(undefined, true);
	}

	private register(): void {
		setAppviewExecutor(async (entry) => {
			const method = methodByNsid(entry.lxm);
			if (!method) {
				return xrpcFail(
					new ColibriError({ code: "Unexpected", method: entry.lxm }),
				);
			}
			return call(this.clientFor(entry.service), method, entry.input);
		});
	}

	static create(agent: Agent, appViewDid: string): ColibriClient {
		const client = new ColibriClient(agent, appViewDid);
		client.register();
		return client;
	}
}

const byAppView = new Map<string, ColibriClient>();

export const primaryClient = (agent: Agent): ColibriClient => {
	const did = getAppViewDid();
	const existing = byAppView.get(did);
	if (existing) return existing;
	const created = ColibriClient.create(agent, did);
	byAppView.set(did, created);
	return created;
};

export const clientForManagingApp = (
	agent: Agent,
	managingApp: string,
): ColibriClient => {
	const existing = byAppView.get(managingApp);
	if (existing) return existing;
	const created = new ColibriClient(agent, managingApp);
	byAppView.set(managingApp, created);
	return created;
};

export const resetClients = (): void => {
	byAppView.clear();
};

export type { CallOptions, Method, Output };
