import { AtpAgent } from "@atproto/api";
import type { StandardDocument } from "@colibri-social/standard-renderer";
import {
	BLOG_DID,
	BLOG_PDS,
	DOCUMENT_COLLECTION,
	PUBLICATION_URI,
} from "./config";

export interface BlogPost {
	rkey: string;
	uri: string;
	doc: StandardDocument;
}

const agent = new AtpAgent({ service: BLOG_PDS });

const TTL_MS = 5 * 60_000;

interface Cached<T> {
	value: T;
	expires: number;
}

let listCache: Cached<BlogPost[]> | undefined;
let listInflight: Promise<BlogPost[]> | undefined;

const rkeyFromUri = (uri: string) => uri.split("/").pop() ?? "";

const fetchAllPosts = async (): Promise<BlogPost[]> => {
	const posts: BlogPost[] = [];
	let cursor: string | undefined;

	do {
		const res = await agent.com.atproto.repo.listRecords({
			repo: BLOG_DID,
			collection: DOCUMENT_COLLECTION,
			limit: 100,
			cursor,
		});

		for (const record of res.data.records) {
			const doc = record.value as unknown as StandardDocument;
			if (doc.site !== PUBLICATION_URI) continue;
			posts.push({ rkey: rkeyFromUri(record.uri), uri: record.uri, doc });
		}

		cursor = res.data.cursor;
	} while (cursor);

	posts.sort(
		(a, b) =>
			new Date(b.doc.publishedAt).getTime() -
			new Date(a.doc.publishedAt).getTime(),
	);

	return posts;
};

export const listPosts = async (): Promise<BlogPost[]> => {
	if (listCache && listCache.expires > Date.now()) return listCache.value;
	if (listInflight) return listInflight;

	listInflight = fetchAllPosts()
		.then((value) => {
			listCache = { value, expires: Date.now() + TTL_MS };
			return value;
		})
		.finally(() => {
			listInflight = undefined;
		});

	return listInflight;
};

export const getPost = async (rkey: string): Promise<BlogPost | undefined> => {
	if (listCache && listCache.expires > Date.now()) {
		const cached = listCache.value.find((p) => p.rkey === rkey);
		if (cached) return cached;
	}

	try {
		const res = await agent.com.atproto.repo.getRecord({
			repo: BLOG_DID,
			collection: DOCUMENT_COLLECTION,
			rkey,
		});
		const doc = res.data.value as unknown as StandardDocument;
		if (doc.site !== PUBLICATION_URI) return undefined;
		return { rkey, uri: res.data.uri, doc };
	} catch {
		return undefined;
	}
};
