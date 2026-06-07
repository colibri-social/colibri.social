import {
	createContext,
	createEffect,
	createSignal,
	type Accessor,
	type ParentComponent,
	type Setter,
	useContext,
} from "solid-js";
import { toast } from "somoto";
import { ColibriRichTextFacet } from "lib";
import { purify } from "../utils/purify";
import type { Message } from "../atproto/xrpc/social/colibri/channel/listMessages";
import type { TextWithFacets } from "../components/app/common/rich-text-renderer/util";
import {
	createRecord,
	deleteRecord,
	findReactionRkey,
	putRecord,
} from "../atproto/pds";
import { AtURI } from "../utils/at-uri";
import { useUserContext } from "./User";
import { useChannelContext } from "./Channel";
import { useCommunityContext, usePermissions } from "./Community";

export type MessageContextValue = {
	get message(): Message;

	blockModalOpen: Accessor<boolean>;
	setBlockModalOpen: Setter<boolean>;
	deletionModalOpen: Accessor<boolean>;
	setDeletionModalOpen: Setter<boolean>;
	debugModalOpen: Accessor<boolean>;
	setDebugModalOpen: Setter<boolean>;
	emojiPopoverOpen: Accessor<boolean>;
	setEmojiPopoverOpen: Setter<boolean>;

	editedText: Accessor<TextWithFacets>;
	setEditedText: Setter<TextWithFacets>;
	newText: Accessor<TextWithFacets>;
	setNewText: Setter<TextWithFacets>;

	isPending: Accessor<boolean>;
	editMode: Accessor<boolean>;
	isAdmin: Accessor<boolean>;
	messageEditable: Accessor<boolean>;
	isRepliedTo: Accessor<boolean | undefined>;
	containsMentionOrIsReplyToUser: Accessor<boolean>;
	isFocused: Accessor<boolean>;

	handlePotentialDeletion: (e: MouseEvent) => void;
	handlePotentialBlock: (e: MouseEvent) => void;
	/** Perform the deletion immediately (called by shift-click and modal confirm). */
	confirmDelete: () => Promise<void>;
	/** Perform the block immediately (called by shift-click and modal confirm). */
	confirmBlock: () => Promise<void>;
	enableReplyMode: () => void;
	enableEditMode: () => void;
	cancelEdits: () => void;
	submitEdits: (
		text: string,
		facets: Array<ColibriRichTextFacet>,
	) => Promise<void>;
	addReactionOptimistic: (emoji: string) => Promise<void>;
	removeReaction: (emoji: string) => Promise<void>;
};

const MessageContext = createContext<MessageContextValue>();

export const MessageContextProvider: ParentComponent<{ data: Message }> = (
	props,
) => {
	const user = useUserContext();
	const channel = useChannelContext();
	const community = useCommunityContext();

	const isPending = () => props.data.uri.length === 0;

	const [blockModalOpen, setBlockModalOpen] = createSignal(false);
	const [deletionModalOpen, setDeletionModalOpen] = createSignal(false);
	const [emojiPopoverOpen, setEmojiPopoverOpen] = createSignal(false);
	const [debugModalOpen, setDebugModalOpen] = createSignal(false);

	const editMode = () =>
		!isPending() && channel.editingMessage()?.uri === props.data.uri;

	const [editedText, setEditedText] = createSignal<TextWithFacets>({
		text: props.data.text,
		facets: props.data.facets || [],
	});
	const [newText, setNewText] = createSignal<TextWithFacets>({
		text: props.data.text,
		facets: props.data.facets || [],
	});

	createEffect(() => {
		setNewText({
			text: props.data.text,
			facets: props.data.facets || [],
		});
	});

	const isRepliedTo = () => {
		if (isPending()) return undefined;
		return channel.replyingTo()?.uri === props.data.uri;
	};

	const containsMentionOrIsReplyToUser = () => {
		if ("hash" in props.data) return false;
		return (
			props.data.parent?.author.did === user.did ||
			props.data.facets?.some((x) =>
				x.features.some(
					(y) =>
						y.$type === "social.colibri.richtext.facet#mention" &&
						y.did === user.did,
				),
			) === true
		);
	};

	const isFocused = () => {
		if ("hash" in props.data) return false;
		return channel.focusedMessage() === props.data.uri;
	};

	const messageEditable = () => props.data.author.did === user.did;

	const { isAdmin: _isAdmin } = usePermissions();
	const isAdmin = () => _isAdmin(user.did);

	const enableReplyMode = () => {
		if (isPending()) return;
		channel.setReplyingTo(props.data);
	};

	const enableEditMode = () => {
		if (isPending()) return;
		channel.setEditingMessage(props.data);
	};

	const cancelEdits = () => {
		setEditedText({
			text: props.data.text,
			facets: props.data.facets || [],
		});
		channel.clearEditingMessage();
	};

	const confirmDelete = async () => {
		if (isPending()) return;
		const rkey = AtURI.parseAtURI(props.data.uri).identifier;
		channel.removeMessage(props.data.uri); // optimistic — instant
		setDeletionModalOpen(false);
		try {
			await deleteRecord(
				user.atproto.agent,
				user.did,
				"social.colibri.message",
				rkey,
			);
		} catch {
			toast.error("Failed to delete message.");
			// The message is already gone from the local list; it will reappear
			// on the next page load (the PDS still has it). A re-insert here
			// would require knowing the original list position, so we leave that
			// to the socket event reconciliation once that is wired up.
		}
	};

	const confirmBlock = async () => {
		if (isPending()) return;
		setBlockModalOpen(false);
		const res = await user.xrpc.social.colibri.community.blockMessage(
			community().community.uri,
			props.data.uri,
		);
		if (res) {
			channel.removeMessage(props.data.uri);
		} else {
			toast.error("Failed to block message.");
		}
	};

	const submitEdits = async (
		text: string,
		facets: Array<ColibriRichTextFacet>,
	) => {
		if (isPending()) return;

		const rkey = AtURI.parseAtURI(props.data.uri).identifier;
		const originalText = newText();

		setNewText({ text, facets }); // optimistic
		channel.clearEditingMessage();

		if (purify(text).trim().length === 0) {
			setDeletionModalOpen(true);
			return;
		}

		try {
			await putRecord(
				user.atproto.agent,
				user.did,
				"social.colibri.message",
				rkey,
				{
					text: purify(text.trim()),
					facets,
					channel: props.data.channel,
					createdAt: props.data.createdAt,
					edited: true,
					...(props.data.parent ? { parent: props.data.parent.uri } : {}),
				},
			);
			channel.updateMessageText(props.data.uri, purify(text.trim()), facets);
		} catch {
			setNewText(originalText); // revert
			channel.setEditingMessage(props.data);
			toast.error("Failed to edit message.");
		}
	};

	const handlePotentialDeletion = (e: MouseEvent) => {
		if (isPending()) return;
		if (e.shiftKey) {
			confirmDelete();
			return;
		}
		setDeletionModalOpen(true);
	};

	const handlePotentialBlock = (e: MouseEvent) => {
		if (isPending()) return;
		if (e.shiftKey) {
			confirmBlock();
			return;
		}
		setBlockModalOpen(true);
	};

	const addReactionOptimistic = async (emoji: string) => {
		if (isPending()) return;
		channel.addReactionOptimistic(props.data.uri, emoji, user.did); // instant
		try {
			const res = await createRecord(
				user.atproto.agent,
				user.did,
				"social.colibri.reaction",
				{ emoji, parent: props.data.uri },
			);
			channel.cacheReactionRkey(
				props.data.uri,
				emoji,
				AtURI.parseAtURI(res.uri).identifier,
			);
		} catch {
			channel.removeReactionOptimistic(props.data.uri, emoji, user.did); // revert
			toast.error("Failed to add reaction.");
		}
	};

	const removeReaction = async (emoji: string) => {
		if (isPending()) return;
		channel.removeReactionOptimistic(props.data.uri, emoji, user.did); // instant
		try {
			let rkey = channel.getReactionRkey(props.data.uri, emoji);
			if (!rkey) {
				rkey = await findReactionRkey(
					user.atproto.agent,
					user.did,
					props.data.uri,
					emoji,
				);
			}
			if (!rkey) throw new Error("Reaction record not found.");
			await deleteRecord(
				user.atproto.agent,
				user.did,
				"social.colibri.reaction",
				rkey,
			);
		} catch {
			channel.addReactionOptimistic(props.data.uri, emoji, user.did); // revert
			toast.error("Failed to remove reaction.");
		}
	};

	const value: MessageContextValue = {
		get message() {
			return props.data;
		},
		blockModalOpen,
		setBlockModalOpen,
		deletionModalOpen,
		setDeletionModalOpen,
		debugModalOpen,
		setDebugModalOpen,
		emojiPopoverOpen,
		setEmojiPopoverOpen,
		editedText,
		setEditedText,
		newText,
		setNewText,
		isPending,
		editMode,
		isAdmin,
		messageEditable,
		isRepliedTo,
		containsMentionOrIsReplyToUser,
		isFocused,
		handlePotentialDeletion,
		handlePotentialBlock,
		confirmDelete,
		confirmBlock,
		enableReplyMode,
		enableEditMode,
		cancelEdits,
		submitEdits,
		addReactionOptimistic,
		removeReaction,
	};

	return (
		<MessageContext.Provider value={value}>
			{props.children}
		</MessageContext.Provider>
	);
};

export const useMessageContext = (): MessageContextValue => {
	const ctx = useContext(MessageContext);
	if (!ctx)
		throw new Error("useMessageContext called outside MessageContextProvider");
	return ctx;
};
