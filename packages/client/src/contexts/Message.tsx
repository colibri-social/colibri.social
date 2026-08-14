import type { ColibriRichTextFacet } from "@colibri-social/lib";
import {
	type Accessor,
	createContext,
	createEffect,
	createSignal,
	onMount,
	type ParentComponent,
	type Setter,
	useContext,
} from "solid-js";
import { toast } from "somoto";
import { buildMessageRecord } from "../atproto/message-record";
import {
	enqueueCreate,
	enqueueDelete,
	enqueuePut,
} from "../atproto/outbox/outbox";
import { nextTid } from "../atproto/outbox/tid";
import { findReactionRkey } from "../atproto/pds";
import type { Message } from "../atproto/xrpc/social/colibri/channel/listMessages";
import { isRemovableEmbed } from "../components/app/channel/message/Embed";
import {
	type TextWithFacets,
	trimWithFacets,
} from "../components/app/common/rich-text-renderer/util";
import { AtURI } from "../utils/at-uri";
import {
	clearEditDraft,
	readEditDraft,
	writeEditDraft,
} from "../utils/composer-drafts";
import { linkUrisFromFacets } from "../utils/link-facets";
import type { LinkTarget } from "../utils/link-target";
import { purify } from "../utils/purify";
import { useChannelContext } from "./Channel";
import { useCommunityContext, usePermissions } from "./Community";
import { useUserContext } from "./User";
import { useUserPreferences } from "./UserPreferences";

export type MessageContextValue = {
	get message(): Message;

	blockModalOpen: Accessor<boolean>;
	setBlockModalOpen: Setter<boolean>;
	deletionModalOpen: Accessor<boolean>;
	setDeletionModalOpen: Setter<boolean>;
	debugModalOpen: Accessor<boolean>;
	setDebugModalOpen: Setter<boolean>;
	embedsModalOpen: Accessor<boolean>;
	setEmbedsModalOpen: Setter<boolean>;
	emojiPopoverOpen: Accessor<boolean>;
	setEmojiPopoverOpen: Setter<boolean>;
	contextMenuOpen: Accessor<boolean>;
	setContextMenuOpen: Setter<boolean>;
	linkTarget: Accessor<LinkTarget | undefined>;
	setLinkTarget: Setter<LinkTarget | undefined>;

	editedText: Accessor<TextWithFacets>;
	setEditedText: Setter<TextWithFacets>;
	saveEditedText: (text: string, facets: Array<ColibriRichTextFacet>) => void;
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

	removableEmbedUris: Accessor<Array<string>>;
	visibleEmbedUris: Accessor<Array<string>>;
	authorSuppressedEmbeds: Accessor<Array<string>>;
	modSuppressedEmbeds: Accessor<Array<string>>;
	isEmbedVisible: (uri: string) => boolean;
	canModerateEmbeds: Accessor<boolean>;
	removeEmbed: (uri: string) => Promise<void>;
	modRemoveEmbed: (uri: string) => Promise<void>;

	stagedEmbeds: Accessor<Array<string> | undefined>;
	setStagedEmbeds: Setter<Array<string> | undefined>;
	stagedDirty: Accessor<boolean>;
	openEmbedsModal: (seedUri?: string) => void;
	closeEmbedsModal: () => void;
	saveStagedEmbeds: () => Promise<void>;
};

const MessageContext = createContext<MessageContextValue>();

export const MessageContextProvider: ParentComponent<{ data: Message }> = (
	props,
) => {
	const user = useUserContext();
	const channel = useChannelContext();
	const community = useCommunityContext();
	const { recordEmojiUse } = useUserPreferences();

	const isPending = () => "hash" in props.data;

	const [blockModalOpen, setBlockModalOpen] = createSignal(false);
	const [deletionModalOpen, setDeletionModalOpen] = createSignal(false);
	const [emojiPopoverOpen, setEmojiPopoverOpen] = createSignal(false);
	const [debugModalOpen, setDebugModalOpen] = createSignal(false);
	const [embedsModalOpen, setEmbedsModalOpen] = createSignal(false);
	const [stagedEmbeds, setStagedEmbeds] = createSignal<
		Array<string> | undefined
	>();
	const [contextMenuOpen, setContextMenuOpen] = createSignal(false);
	const [linkTarget, setLinkTarget] = createSignal<LinkTarget | undefined>();

	const editMode = () =>
		!isPending() && channel.editingMessage()?.uri === props.data.uri;

	const [editedText, setEditedText] = createSignal<TextWithFacets>(
		readEditDraft(props.data.uri) ?? {
			text: props.data.text,
			facets: props.data.facets || [],
		},
	);

	onMount(() => {
		if (isPending()) return;
		if (readEditDraft(props.data.uri)) channel.setEditingMessage(props.data);
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

	const saveEditedText = (
		text: string,
		facets: Array<ColibriRichTextFacet>,
	) => {
		setEditedText({ text, facets });
		if (!isPending()) writeEditDraft(props.data.uri, { text, facets });
	};

	const isRepliedTo = () => {
		if (isPending()) return undefined;
		return channel.replyingTo()?.uri === props.data.uri;
	};

	const containsMentionOrIsReplyToUser = () => {
		if ("hash" in props.data) return false;
		const ownRoleUris = new Set(
			community().members.find((m) => m.did === user.did)?.roles ?? [],
		);
		return (
			props.data.parent?.author.did === user.did ||
			props.data.facets?.some((x) =>
				x.features.some(
					(y) =>
						(y.$type === "social.colibri.richtext.facet#mention" &&
							y.did === user.did) ||
						(y.$type === "social.colibri.richtext.facet#role" &&
							ownRoleUris.has(y.role)),
				),
			) === true
		);
	};

	const isFocused = () => {
		if ("hash" in props.data) return false;
		return channel.focusedMessage() === props.data.uri;
	};

	const messageEditable = () => props.data.author.did === user.did;

	const { isAdmin: _isAdmin, canHideMessage } = usePermissions();
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
		clearEditDraft(props.data.uri);
		channel.clearEditingMessage();
		// Return focus to the main composer once the inline editor unmounts.
		// `:not(.temp-editor)` skips the (now-closing) edit editor, which shares
		// the `#editor` id and sits earlier in the DOM.
		setTimeout(() => {
			document
				.querySelector<HTMLElement>("#editor:not(.temp-editor) .ProseMirror")
				?.focus();
		}, 0);
	};

	const confirmDelete = async () => {
		if (isPending()) return;
		const rkey = AtURI.parseAtURI(props.data.uri).identifier;
		channel.removeMessage(props.data.uri); // optimistic — instant
		setDeletionModalOpen(false);
		// Return focus to the main composer after confirming
		setTimeout(() => {
			document
				.querySelector<HTMLElement>("#editor:not(.temp-editor) .ProseMirror")
				?.focus();
		}, 0);
		try {
			await enqueueDelete(user.did, "social.colibri.message", rkey, {
				label: "Failed to delete message.",
			});
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

	const linkUris = (): Array<string> => linkUrisFromFacets(props.data.facets);

	const removableEmbedUris = (): Array<string> =>
		linkUris().filter(isRemovableEmbed);

	const authorSuppressedEmbeds = (): Array<string> =>
		props.data.suppressedEmbeds ?? [];

	const modSuppressedEmbeds = (): Array<string> =>
		props.data.modSuppressedEmbeds ?? [];

	const isEmbedVisible = (uri: string): boolean => {
		if (!isRemovableEmbed(uri)) return true;
		if (!channel.linkEmbedsEnabled()) return false;
		return (
			!authorSuppressedEmbeds().includes(uri) &&
			!modSuppressedEmbeds().includes(uri)
		);
	};

	const visibleEmbedUris = (): Array<string> =>
		linkUris().filter(isEmbedVisible);

	const canModerateEmbeds = () =>
		!isPending() &&
		props.data.author.did !== user.did &&
		canHideMessage(user.did);

	const writeAuthorSuppression = async (next: Array<string>) => {
		if (isPending()) return;

		const rkey = AtURI.parseAtURI(props.data.uri).identifier;
		const previous = authorSuppressedEmbeds();
		const text = props.data.text;
		const facets = props.data.facets ?? [];
		const edited = props.data.edited;

		channel.patchMessage(props.data.uri, { suppressedEmbeds: next });

		try {
			await enqueuePut(
				user.did,
				"social.colibri.message",
				rkey,
				buildMessageRecord(props.data, {
					text,
					facets,
					edited,
					suppressedEmbeds: next,
				}),
				{ label: "Failed to update link previews." },
			);
		} catch {
			channel.patchMessage(props.data.uri, { suppressedEmbeds: previous });
			toast.error("Failed to update link previews.");
		}
	};

	const removeEmbed = (uri: string) =>
		authorSuppressedEmbeds().includes(uri)
			? Promise.resolve()
			: writeAuthorSuppression([...authorSuppressedEmbeds(), uri]);

	const saveModSuppression = async (next: Array<string>) => {
		const previous = modSuppressedEmbeds();
		const toSuppress = next.filter((uri) => !previous.includes(uri));
		const toRestore = previous.filter((uri) => !next.includes(uri));
		if (toSuppress.length === 0 && toRestore.length === 0) return;

		channel.patchMessage(props.data.uri, { modSuppressedEmbeds: next });

		const communityUri = community().community.uri;
		let ok = true;

		if (toSuppress.length > 0) {
			ok = !!(await user.xrpc.social.colibri.community.suppressMessageEmbeds(
				communityUri,
				props.data.uri,
				toSuppress,
			));
		}
		if (ok && toRestore.length > 0) {
			ok = !!(await user.xrpc.social.colibri.community.unsuppressMessageEmbeds(
				communityUri,
				props.data.uri,
				toRestore,
			));
		}

		if (!ok) {
			channel.patchMessage(props.data.uri, { modSuppressedEmbeds: previous });
			toast.error("Failed to update link previews.");
		}
	};

	const modRemoveEmbed = (uri: string) =>
		saveModSuppression([...new Set([...modSuppressedEmbeds(), uri])]);

	const hiddenByMe = (): Array<string> =>
		messageEditable() ? authorSuppressedEmbeds() : modSuppressedEmbeds();

	const openEmbedsModal = (seedUri?: string) => {
		if (isPending()) return;
		const base = hiddenByMe();
		setStagedEmbeds(
			seedUri !== undefined && !base.includes(seedUri)
				? [...base, seedUri]
				: [...base],
		);
		setEmbedsModalOpen(true);
	};

	const closeEmbedsModal = () => {
		setEmbedsModalOpen(false);
		setStagedEmbeds(undefined);
	};

	const stagedDirty = () => {
		const staged = stagedEmbeds();
		if (!staged) return false;
		const current = hiddenByMe();
		return (
			staged.length !== current.length ||
			staged.some((uri) => !current.includes(uri))
		);
	};

	const saveStagedEmbeds = async () => {
		const staged = stagedEmbeds();
		closeEmbedsModal();
		if (!staged) return;
		await (messageEditable()
			? writeAuthorSuppression(staged)
			: saveModSuppression(staged));
	};

	const submitEdits = async (
		text: string,
		facets: Array<ColibriRichTextFacet>,
	) => {
		if (isPending()) return;

		const rkey = AtURI.parseAtURI(props.data.uri).identifier;
		const originalText = newText();

		const trimmed = trimWithFacets({ text, facets });
		const cleanText = purify(trimmed.text);
		const cleanFacets = trimmed.facets;

		setNewText({ text: cleanText, facets: cleanFacets }); // optimistic
		clearEditDraft(props.data.uri);
		channel.clearEditingMessage();

		if (cleanText.length === 0) {
			setDeletionModalOpen(true);
			return;
		}

		try {
			await enqueuePut(
				user.did,
				"social.colibri.message",
				rkey,
				buildMessageRecord(props.data, {
					text: cleanText,
					facets: cleanFacets,
					edited: true,
				}),
				{ label: "Failed to edit message." },
			);
			channel.updateMessageText(props.data.uri, cleanText, cleanFacets);
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
		recordEmojiUse(emoji);
		channel.addReactionOptimistic(props.data.uri, emoji, user.did); // instant
		const rkey = nextTid();
		channel.cacheReactionRkey(props.data.uri, emoji, rkey);
		try {
			await enqueueCreate(
				user.did,
				"social.colibri.reaction",
				{ emoji, parent: props.data.uri },
				{ rkey, label: "Failed to add reaction." },
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
			await enqueueDelete(user.did, "social.colibri.reaction", rkey, {
				label: "Failed to remove reaction.",
			});
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
		embedsModalOpen,
		setEmbedsModalOpen,
		emojiPopoverOpen,
		setEmojiPopoverOpen,
		contextMenuOpen,
		setContextMenuOpen,
		linkTarget,
		setLinkTarget,
		editedText,
		setEditedText,
		saveEditedText,
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
		removableEmbedUris,
		visibleEmbedUris,
		authorSuppressedEmbeds,
		modSuppressedEmbeds,
		isEmbedVisible,
		canModerateEmbeds,
		removeEmbed,
		modRemoveEmbed,
		stagedEmbeds,
		setStagedEmbeds,
		stagedDirty,
		openEmbedsModal,
		closeEmbedsModal,
		saveStagedEmbeds,
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
