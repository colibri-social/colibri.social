import type { PendingMessage } from "../../../data/store";
import type {
	DeletedMessageView,
	Facet,
	MessageView,
	ProfileView,
	ThreadView,
} from "../../../data/types";

export type MessageParent = NonNullable<MessageView["parent"]>;

export type ChatMessageState = "sent" | "pending" | "failed";

export type ChatMessage = {
	key: string;
	author: string;
	timestamp: string;
	reply?: boolean;
	forward?: boolean;
	failed?: boolean;
	system?: boolean;
	state: ChatMessageState;
	rkey?: string;
	text: string;
	facets: Facet[];
	parent?: MessageParent;
	view?: MessageView;
	thread?: ThreadView;
	anchor?: boolean;
	attachments?: MessageView["attachments"];
	uploadProgress?: (number | undefined)[];
};

export const isVisibleParent = (
	parent: MessageParent | undefined,
): parent is MessageView & { $type: string } =>
	!!parent && "author" in parent && "text" in parent;

export const isDeletedParent = (
	parent: MessageParent | undefined,
): parent is DeletedMessageView & { $type: string } =>
	!!parent && !isVisibleParent(parent);

export const toChatMessage = (
	view: MessageView,
	options: { key?: string; thread?: ThreadView } = {},
): ChatMessage => ({
	key: options.key ?? view.rkey,
	author: view.author.did,
	timestamp: view.createdAt,
	reply: !!view.parent,
	forward: !!view.forward,
	state: "sent",
	rkey: view.rkey,
	text: view.text,
	facets: view.facets ?? [],
	parent: view.parent,
	view,
	thread: options.thread,
});

export const pendingChatMessage = (input: {
	nonce: string;
	author: string;
	text: string;
	facets?: Facet[];
	parent?: MessageView;
	createdAt?: string;
	attachments?: MessageView["attachments"];
	uploadProgress?: (number | undefined)[];
}): ChatMessage => ({
	key: input.nonce,
	attachments: input.attachments,
	uploadProgress: input.uploadProgress,
	author: input.author,
	timestamp: input.createdAt ?? new Date().toISOString(),
	reply: !!input.parent,
	state: "pending",
	text: input.text,
	facets: input.facets ?? [],
	parent: input.parent
		? { ...input.parent, $type: "social.colibri.beta.channel.defs#messageView" }
		: undefined,
});

export const failChatMessage = (message: ChatMessage): ChatMessage => ({
	...message,
	state: "failed",
	failed: true,
});

export const pendingToChatMessage = (
	pending: PendingMessage,
	viewer: ProfileView,
	findMessage?: (rkey: string) => MessageView | undefined,
): ChatMessage => {
	const parent = pending.parent ? findMessage?.(pending.parent) : undefined;
	const message = pendingChatMessage({
		nonce: pending.nonce,
		author: viewer.did,
		text: pending.text,
		facets: pending.facets,
		parent,
		createdAt: pending.createdAt,
	});
	return pending.state === "failed" ? failChatMessage(message) : message;
};

export const isHiddenMessage = (message: Pick<MessageView, "labels">) =>
	message.labels.some((label) => label.val === "hidden");
