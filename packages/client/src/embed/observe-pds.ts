import { Agent } from "@atproto/api";
import { classifyThrown } from "../errors/classify";
import { createLogger } from "../utils/logger";
import type { EmbedEmitter, EmbedEventBody } from "./types";

const log = createLogger("embed");

const WRITE_KINDS: Record<string, "created" | "updated" | "deleted"> = {
	createRecord: "created",
	putRecord: "updated",
	deleteRecord: "deleted",
};

const lexiconOf = (url: string): string => {
	const path = url.startsWith("/") ? url : new URL(url).pathname;
	return path.replace(/^.*\/xrpc\//, "").split("?")[0] ?? "";
};

type RepoWriteResponse = { uri?: string; cid?: string };
type BlobResponse = { blob?: { mimeType?: string; size?: number } };

const rkeyOf = (uri: string): string => uri.split("/").pop() ?? "";
const repoOf = (uri: string): string => uri.split("/")[2] ?? "";
const collectionOf = (uri: string): string => uri.split("/")[3] ?? "";

const describe = async (
	lexicon: string,
	body: string | undefined,
	response: Response,
): Promise<EmbedEventBody | undefined> => {
	if (!response.ok) return undefined;

	const write = WRITE_KINDS[lexicon.replace("com.atproto.repo.", "")];

	if (write === "deleted") {
		if (!body) return undefined;
		try {
			const input = JSON.parse(body) as {
				repo?: string;
				collection?: string;
				rkey?: string;
			};
			if (!input.repo || !input.collection || !input.rkey) return undefined;
			return {
				kind: "record.deleted",
				repo: input.repo,
				collection: input.collection,
				rkey: input.rkey,
				uri: `at://${input.repo}/${input.collection}/${input.rkey}`,
			};
		} catch {
			return undefined;
		}
	}

	if (write) {
		const data = (await response.clone().json()) as RepoWriteResponse;
		if (!data.uri) return undefined;
		return {
			kind: write === "created" ? "record.created" : "record.updated",
			repo: repoOf(data.uri),
			collection: collectionOf(data.uri),
			rkey: rkeyOf(data.uri),
			uri: data.uri,
		};
	}

	if (lexicon === "com.atproto.repo.uploadBlob") {
		const data = (await response.clone().json()) as BlobResponse;
		if (!data.blob) return undefined;
		return {
			kind: "blob.uploaded",
			mimeType: data.blob.mimeType ?? "application/octet-stream",
			size: data.blob.size ?? 0,
		};
	}

	return undefined;
};

const readBody = (init: RequestInit | undefined): string | undefined =>
	typeof init?.body === "string" ? init.body : undefined;

export const observeAgent = (agent: Agent, emitter: EmbedEmitter): Agent =>
	new Agent({
		did: agent.sessionManager.did,
		fetchHandler: async (url, init) => {
			const response = await agent.sessionManager.fetchHandler(url, init);

			try {
				const event = await describe(lexiconOf(url), readBody(init), response);
				if (event) emitter.emit(event);
			} catch (e) {
				const failure = classifyThrown(e);
				log.debug("could not describe a PDS call", { code: failure.code });
			}

			return response;
		},
	});
