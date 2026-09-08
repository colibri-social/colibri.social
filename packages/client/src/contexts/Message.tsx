import type { ColibriRichTextFacet } from "@colibri-social/lib";
import {
	type Accessor,
	batch,
	createContext,
	createEffect,
	createMemo,
	createSignal,
	onMount,
	type ParentComponent,
	type Setter,
	useContext,
} from "solid-js";
import { toast } from "somoto";
import type { PendingMessage } from "../atproto/cache/schema";
import {
	embedSuppression,
	isEmbedSuppressed,
	isHidden,
} from "../atproto/labels";
import { asUri, COLLECTIONS, colibri } from "../atproto/lexicons";
import { buildReactionRecord } from "../atproto/message-record";
import {
	enqueueSpaceCreate,
	enqueueSpaceDelete,
} from "../atproto/outbox/outbox";
import {
	discardSend,
	retrySend,
	type SendProgress,
	sendProgress,
	sendsRevision,
} from "../atproto/outbox/sends";
import { nextTid } from "../atproto/outbox/tid";
import { findReactionRkey } from "../atproto/pds";
import type { MessageView, ReactionView, RecordRef } from "../atproto/views";
import { isVisibleParent } from "../atproto/views";
import { clientForManagingApp } from "../atproto/xrpc";
import { isRemovableEmbed } from "../components/app/channel/message/Embed";
import {
	type TextWithFacets,
	trimWithFacets,
} from "../components/app/common/rich-text-renderer/util";
import {
	clearEditDraft,
	readEditDraft,
	writeEditDraft,
} from "../utils/composer-drafts";
import { linkUrisFromFacets } from "../utils/link-facets";
import type { LinkTarget } from "../utils/link-target";
import { isLegacyImmutable } from "../utils/message-legacy";
import {
	buildFeatureKey,
	normalizeFacets,
	stableStringify,
} from "../utils/normalize-facets";
import { sortReactionGroups } from "../utils/reaction-order";
import { useChannelContext } from "./Channel";
import { useCommunityContext, usePermissions } from "./Community";
import { useUserContext } from "./User";
import { useUserPreferences } from "./UserPreferences";

export type MessageData = MessageView | PendingMessage;

export type MessageContextValue = {
	get message(): MessageData;
	sortedReactions: Accessor<Array<ReactionView>>;

	blockModalOpen: Accessor<boolean>;
	setBlockModalOpen: Setter<boolean>;
	deletionModalOpen: Accessor<boolean>;
	setDeletionModalOpen: Setter<boolean>;
	debugModalOpen: Accessor<boolean>;
	setDebugModalOpen: Setter<boolean>;
	embedsModalOpen: Accessor<boolean>;
	setEmbedsModalOpen: Setter<boolean>;
	reactionsViewerOpen: Accessor<boolean>;
	reactionsViewerEmoji: Accessor<string | undefined>;
	openReactionsViewer: (emoji?: string) => void;
	closeReactionsViewer: () => void;
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
	sendState: Accessor<SendProgress | undefined>;
	retrySendState: () => void;
	discardSendState: () => void;
	isLegacy: Accessor<boolean>;
	isHiddenByModerator: Accessor<boolean>;
	revealed: Accessor<boolean>;
	toggleRevealed: () => void;
	editMode: Accessor<boolean>;
	isAdmin: Accessor<boolean>;
	messageEditable: Accessor<boolean>;
	isRepliedTo: Accessor<boolean | undefined>;
	containsMentionOrIsReplyToUser: Accessor<boolean>;
	isFocused: Accessor<boolean>;

	handlePotentialDeletion: (e: MouseEvent) => void;
	handlePotentialBlock: (e: MouseEvent) => void;
	confirmDelete: () => Promise<void>;
	confirmBlock: () => Promise<void>;
	canReply: Accessor<boolean>;
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

export const MessageContextProvider: ParentComponent<{ data: MessageData }> = (
	props,
) => {
	const user = useUserContext();
	const channel = useChannelContext();
	const community = useCommunityContext();
	const { recordEmojiUse } = useUserPreferences();

	const isPending = () => "hash" in props.data;

	const uploadingRkey = (): string | undefined => {
		const { data } = props;
		if (!("hash" in data)) return undefined;
		return data.hash.startsWith("outbox:") ? data.hash.slice(7) : undefined;
	};

	const sendState = (): SendProgress | undefined => {
		sendsRevision();
		const rkey = uploadingRkey();
		return rkey ? sendProgress(rkey) : undefined;
	};

	const retrySendState = () => {
		const rkey = uploadingRkey();
		if (rkey) retrySend(rkey);
	};

	const discardSendState = () => {
		const rkey = uploadingRkey();
		if (rkey) discardSend(rkey);
	};

	const confirmed = (): MessageView | undefined =>
		"hash" in props.data ? undefined : props.data;

	const isLegacy = () => {
		const target = confirmed();
		return target !== undefined && isLegacyImmutable(target);
	};

	const isHiddenByModerator = () => {
		const target = confirmed();
		return target !== undefined && isHidden(target);
	};

	const [revealed, setRevealed] = createSignal(false);

	const toggleRevealed = () => setRevealed((prev) => !prev);

	const sortedReactions = createMemo(() =>
		sortReactionGroups(confirmed()?.reactions ?? []),
	);

	const [blockModalOpen, setBlockModalOpen] = createSignal(false);
	const [deletionModalOpen, setDeletionModalOpen] = createSignal(false);
	const [emojiPopoverOpen, setEmojiPopoverOpen] = createSignal(false);
	const [debugModalOpen, setDebugModalOpen] = createSignal(false);
	const [embedsModalOpen, setEmbedsModalOpen] = createSignal(false);
	const [reactionsViewerOpen, setReactionsViewerOpen] = createSignal(false);
	const [reactionsViewerEmoji, setReactionsViewerEmoji] = createSignal<
		string | undefined
	>();
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
		const target = confirmed();
		if (!target) return;
		if (readEditDraft(target.uri)) channel.setEditingMessage(target);
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

	createEffect(() => {
		if (editMode()) return;
		setEditedText(
			readEditDraft(props.data.uri) ?? {
				text: props.data.text,
				facets: props.data.facets || [],
			},
		);
	});

	const facetsKey = (facets: Array<ColibriRichTextFacet>): string =>
		stableStringify(
			normalizeFacets(facets).map((facet) => ({
				byteStart: facet.index.byteStart,
				byteEnd: facet.index.byteEnd,
				features: facet.features.map(buildFeatureKey).sort(),
			})),
		);

	const matchesCurrent = (input: TextWithFacets): boolean => {
		const current = newText();
		const next = trimWithFacets({
			text: input.text,
			facets: input.facets ?? [],
		});
		return (
			next.text === current.text &&
			facetsKey(next.facets) === facetsKey(current.facets ?? [])
		);
	};

	const saveEditedText = (
		text: string,
		facets: Array<ColibriRichTextFacet>,
	) => {
		setEditedText({ text, facets });
		if (isPending()) return;
		if (matchesCurrent({ text, facets })) {
			clearEditDraft(props.data.uri);
			return;
		}
		writeEditDraft(props.data.uri, { text, facets });
	};

	const isRepliedTo = () => {
		if (isPending()) return undefined;
		return channel.replyingTo()?.uri === props.data.uri;
	};

	const containsMentionOrIsReplyToUser = () => {
		const target = confirmed();
		if (!target) return false;
		const ownRoleUris = new Set(
			community().utils.getMember(user.did)?.roles ?? [],
		);
		const parent = target.parent;
		const repliedToUser =
			parent !== undefined &&
			isVisibleParent(parent) &&
			parent.author.did === user.did;
		return (
			repliedToUser ||
			target.facets?.some((x) =>
				x.features.some((y) => {
					if (
						y.$type === "social.colibri.beta.richtext.facet#mention" &&
						"did" in y
					) {
						return y.did === user.did;
					}
					if (
						y.$type === "social.colibri.beta.richtext.facet#role" &&
						"role" in y
					) {
						return ownRoleUris.has(y.role);
					}
					return false;
				}),
			) === true
		);
	};

	const isFocused = () => {
		if ("hash" in props.data) return false;
		return channel.focusedMessage() === props.data.uri;
	};

	const messageEditable = () =>
		!isLegacy() && props.data.author.did === user.did;

	const { isAdmin: _isAdmin, canApplyLabel } = usePermissions();
	const isAdmin = () => _isAdmin(user.did);

	const canReply = () => !isPending() && channel.canSendMessages();

	const enableReplyMode = () => {
		if (!canReply()) return;
		const target = confirmed();
		if (!target) return;
		channel.setReplyingTo(target);
	};

	const enableEditMode = () => {
		const target = confirmed();
		if (!target || isLegacy()) return;
		channel.setEditingMessage(target);
	};

	const cancelEdits = () => {
		setEditedText({
			text: props.data.text,
			facets: props.data.facets || [],
		});
		clearEditDraft(props.data.uri);
		channel.clearEditingMessage();
		channel.focusComposer();
	};

	const confirmDelete = async () => {
		const target = confirmed();
		if (!target || isLegacy()) return;
		setDeletionModalOpen(false);
		channel.focusComposer();
		await channel.deleteMessage(target);
	};

	const managingClient = () =>
		clientForManagingApp(user.atproto.agent, community().community.managingApp);

	const confirmBlock = async () => {
		const target = confirmed();
		if (!target) return;
		setBlockModalOpen(false);
		const res = await managingClient().call(colibri.community.applyLabel.main, {
			body: {
				space: target.channel,
				subject: {
					did: target.author.did,
					collection: COLLECTIONS.message,
					rkey: target.rkey,
				},
				val: "hidden",
			},
		});
		if (res.ok) {
			channel.patchMessage(target.uri, {
				labels: [...target.labels, res.data.label],
			});
		} else {
			toast.error("Failed to hide message.");
		}
	};

	const linkUris = (): Array<string> => linkUrisFromFacets(props.data.facets);

	const removableEmbedUris = (): Array<string> =>
		linkUris().filter(isRemovableEmbed);

	const suppression = createMemo(() => {
		const target = confirmed();
		return target
			? embedSuppression(target)
			: { all: false, uris: new Set<string>() };
	});

	const authorSuppressedEmbeds = (): Array<string> =>
		confirmed()?.suppressedEmbeds ?? [];

	const modSuppressedEmbeds = (): Array<string> => {
		const s = suppression();
		if (s.all) return linkUris();
		const authorSet = new Set(authorSuppressedEmbeds());
		return [...s.uris].filter((uri) => !authorSet.has(uri));
	};

	const isEmbedVisible = (uri: string): boolean => {
		if (!isRemovableEmbed(uri)) return true;
		if (!channel.linkEmbedsEnabled()) return false;
		return !isEmbedSuppressed(suppression(), uri);
	};

	const visibleEmbedUris = (): Array<string> =>
		linkUris().filter(isEmbedVisible);

	const canModerateEmbeds = () =>
		!isPending() &&
		props.data.author.did !== user.did &&
		canApplyLabel(user.did);

	const writeAuthorSuppression = async (next: Array<string>) => {
		const target = confirmed();
		if (!target || isLegacy()) return;

		const previous = authorSuppressedEmbeds();
		channel.patchMessage(target.uri, { suppressedEmbeds: next.map(asUri) });

		const ok = await channel.patchMessageRecord(target, {
			suppressedEmbeds: next,
		});
		if (!ok) {
			channel.patchMessage(target.uri, {
				suppressedEmbeds: previous.map(asUri),
			});
			toast.error("Failed to update link previews.");
		}
	};

	const removeEmbed = (uri: string) =>
		authorSuppressedEmbeds().includes(uri)
			? Promise.resolve()
			: writeAuthorSuppression([...authorSuppressedEmbeds(), uri]);

	const applyModLabel = async (
		target: MessageView,
		val: string,
		scope: Array<string>,
	): Promise<boolean> => {
		const res = await managingClient().call(colibri.community.applyLabel.main, {
			body: {
				space: target.channel,
				subject: {
					did: target.author.did,
					collection: COLLECTIONS.message,
					rkey: target.rkey,
				},
				val,
				scope: scope.map(asUri),
			},
		});
		return res.ok;
	};

	const negateModLabel = async (
		target: MessageView,
		val: string,
	): Promise<boolean> => {
		const res = await managingClient().call(
			colibri.community.negateLabel.main,
			{
				body: {
					space: target.channel,
					subject: {
						did: target.author.did,
						collection: COLLECTIONS.message,
						rkey: target.rkey,
					},
					val,
				},
			},
		);
		return res.ok;
	};

	const saveModSuppression = async (next: Array<string>) => {
		const target = confirmed();
		if (!target) return;

		const previous = modSuppressedEmbeds();
		const toSuppress = next.filter((uri) => !previous.includes(uri));
		const toRestore = previous.filter((uri) => !next.includes(uri));
		if (toSuppress.length === 0 && toRestore.length === 0) return;

		let ok = true;

		if (toSuppress.length > 0) {
			ok = await applyModLabel(target, "embeds-suppressed", toSuppress);
		}
		if (ok && toRestore.length > 0) {
			ok = await negateModLabel(target, "embeds-suppressed");
			if (ok && toSuppress.length === 0) {
				const remaining = previous.filter((uri) => !toRestore.includes(uri));
				if (remaining.length > 0) {
					ok = await applyModLabel(target, "embeds-suppressed", remaining);
				}
			}
		}

		if (!ok) {
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
		const target = confirmed();
		if (!target || isLegacy()) return;

		if (matchesCurrent({ text, facets })) {
			cancelEdits();
			return;
		}

		const originalText = newText();

		const trimmed = trimWithFacets({ text, facets });
		const cleanText = trimmed.text;
		const cleanFacets = trimmed.facets;

		setNewText({ text: cleanText, facets: cleanFacets });
		clearEditDraft(target.uri);
		channel.clearEditingMessage();

		if (cleanText.length === 0 && target.attachments.length === 0) {
			setDeletionModalOpen(true);
			return;
		}

		const updatedAt = new Date().toISOString();
		const ok = await channel.patchMessageRecord(target, {
			text: cleanText,
			facets: cleanFacets,
			updatedAt,
		});
		if (ok) {
			channel.updateMessageText(target.uri, cleanText, cleanFacets, updatedAt);
		} else {
			setNewText(originalText);
			channel.setEditingMessage(target);
			toast.error("Failed to edit message.");
		}
	};

	const handlePotentialDeletion = (e: MouseEvent) => {
		if (isPending() || isLegacy()) return;
		if (e.shiftKey) {
			confirmDelete();
			return;
		}
		setDeletionModalOpen(true);
	};

	const handlePotentialBlock = (e: MouseEvent) => {
		if (isPending() || isLegacy()) return;
		if (e.shiftKey) {
			confirmBlock();
			return;
		}
		setBlockModalOpen(true);
	};

	const reactionTarget = (): RecordRef | undefined => {
		const target = confirmed();
		return target ? { did: target.author.did, rkey: target.rkey } : undefined;
	};

	const addReactionOptimistic = async (emoji: string) => {
		const target = reactionTarget();
		if (!target || isLegacy()) return;
		const space = channel.channelSpace();
		if (!space) return;

		recordEmojiUse(emoji);
		channel.addReactionOptimistic(target, emoji, user.did);
		const rkey = nextTid();
		channel.cacheReactionRkey(target, emoji, rkey);
		try {
			await enqueueSpaceCreate(
				space,
				user.did,
				COLLECTIONS.reaction,
				buildReactionRecord(emoji, target),
				{ rkey, label: "Failed to add reaction." },
			);
		} catch {
			channel.removeReactionOptimistic(target, emoji, user.did);
			toast.error("Failed to add reaction.");
		}
	};

	const removeReaction = async (emoji: string) => {
		const target = reactionTarget();
		if (!target || isLegacy()) return;
		const space = channel.channelSpace();
		if (!space) return;

		channel.removeReactionOptimistic(target, emoji, user.did);
		try {
			let rkey = channel.getReactionRkey(target, emoji);
			if (!rkey) {
				rkey = await findReactionRkey(
					user.atproto.agent,
					space,
					user.did,
					target,
					emoji,
				);
			}
			if (!rkey) throw new Error("Reaction record not found.");
			await enqueueSpaceDelete(space, user.did, COLLECTIONS.reaction, rkey, {
				label: "Failed to remove reaction.",
			});
		} catch {
			channel.addReactionOptimistic(target, emoji, user.did);
			toast.error("Failed to remove reaction.");
		}
	};

	const openReactionsViewer = (emoji?: string) => {
		batch(() => {
			setReactionsViewerEmoji(emoji);
			setReactionsViewerOpen(true);
		});
	};

	const closeReactionsViewer = () => {
		setReactionsViewerOpen(false);
	};

	const value: MessageContextValue = {
		get message() {
			return props.data;
		},
		sortedReactions,
		blockModalOpen,
		setBlockModalOpen,
		deletionModalOpen,
		setDeletionModalOpen,
		debugModalOpen,
		setDebugModalOpen,
		embedsModalOpen,
		setEmbedsModalOpen,
		reactionsViewerOpen,
		reactionsViewerEmoji,
		openReactionsViewer,
		closeReactionsViewer,
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
		sendState,
		retrySendState,
		discardSendState,
		isLegacy,
		isHiddenByModerator,
		revealed,
		toggleRevealed,
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
		canReply,
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
