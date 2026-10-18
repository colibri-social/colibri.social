import type {
	AttachmentView,
	Did,
	Facet,
	MessageView,
	SpaceRef,
} from "../types";

export type QueuedFile = {
	file: File;
	spoiler?: boolean;
	alt?: string;
	attachment?: AttachmentView;
	uploadedAt?: number;
};

export type OutboxOp =
	| {
			t: "send";
			channel: SpaceRef;
			rkey: string;
			text: string;
			facets?: Facet[];
			parent?: string;
			parentAuthor?: Did;
			attachments?: AttachmentView[];
			suppressedEmbeds?: string[];
			files: QueuedFile[];
	  }
	| {
			t: "edit";
			channel: SpaceRef;
			rkey: string;
			text: string;
			facets?: Facet[];
	  }
	| { t: "delete"; channel: SpaceRef; rkey: string }
	| {
			t: "react";
			channel: SpaceRef;
			rkey: string;
			emoji: string;
			add: boolean;
			author: Did;
			reaction?: string;
	  }
	| {
			t: "forward";
			from: SpaceRef;
			rkey: string;
			to: SpaceRef;
			text?: string;
			forwardRkey: string;
			message?: MessageView;
	  }
	| { t: "deleteThread"; thread: SpaceRef };

export type OutboxEntry = {
	seq: number;
	op: OutboxOp;
	createdAt: number;
	attempts: number;
	failed?: boolean;
};

export type OutboxTicket = { seq: number; settled: Promise<OutboxResult> };

export type OutboxResult = { message?: MessageView };

export type OutboxEvent =
	| {
			type: "progress";
			entry: OutboxEntry;
			file: number;
			fraction: number;
			failed?: boolean;
	  }
	| { type: "sent"; entry: OutboxEntry; message?: MessageView }
	| { type: "failed"; entry: OutboxEntry; code: string }
	| { type: "dropped"; entry: OutboxEntry };

export type OutboxQueue = {
	load: () => Promise<OutboxEntry[]>;
	put: (entry: OutboxEntry) => Promise<void>;
	remove: (seq: number) => Promise<void>;
};
