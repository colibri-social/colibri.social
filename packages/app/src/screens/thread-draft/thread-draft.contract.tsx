import {
	Avatar,
	ChannelHeader,
	Composer,
	IconButton,
	NavHeader,
	TextField,
	ThreadIcon,
	toast,
} from "@colibri-social/ui";
import { CloseIcon } from "@solar-icons/solid/bold/close";
import { createEffect, createMemo, createSignal, on, Show } from "solid-js";
import { displayNameOf } from "../../data/adapters/authors";
import { fromComposerValue } from "../../data/adapters/facets";
import { skeyOf } from "../../data/ids";
import {
	createComposerDraft,
	readThreadNameDraft,
	threadStartDraftKey,
	writeThreadNameDraft,
} from "../../data/persist-drafts";
import type { ThreadAnchor } from "../../data/source";
import { useData } from "../../data/store";
import { defineContract, slot } from "../../screen/define";
import { useStack } from "../../shell/stack";
import { suppressedLinksFor } from "../channel/composer/link-previews";
import { createConversation } from "../channel/conversation";
import { closePane } from "../thread/close-pane";
import {
	chooseThreadName,
	FALLBACK_THREAD_NAME,
	suggestThreadName,
	THREAD_NAME_MAX_BYTES,
	threadNameTooLong,
} from "./thread-name";

export type ThreadDraftArgs = {
	space: string;
	channel: string;
	channelType?: string;
	anchor?: string;
};

export const threadDraft = defineContract({
	id: "threadDraft",
	model: (args: ThreadDraftArgs) => {
		const data = useData();
		const stack = useStack();
		const community = createMemo(() => data.spaceByKey(args.space));
		const parent = createMemo(() => {
			const current = community();
			return current
				? data.space(current).channelBySlug(args.channel)
				: undefined;
		});
		const anchorMessage = createMemo(() => {
			const ref = parent()?.space;
			if (!ref || !args.anchor) return undefined;
			return data
				.channel(ref)
				.messages()
				.find((message) => message.rkey === args.anchor);
		});
		const suggested = () => suggestThreadName(anchorMessage()?.text);
		const conversation = createConversation({
			space: args.space,
			channel: args.channel,
			target: () => parent()?.space,
			label: () => parent()?.name ?? args.channel,
			isActive: () => false,
		});
		const draftKey = () => {
			const ref = parent()?.space;
			return ref ? threadStartDraftKey(ref, args.anchor) : undefined;
		};
		const draft = createComposerDraft({
			key: draftKey,
			attachments: {
				files: () => conversation.attachments.items().map((item) => item.file),
				add: (files) => conversation.attachments.addFiles(files),
			},
		});
		const showLinkPreviews = () =>
			draft.linkPreviews() ?? conversation.linkPreviewsByDefault();
		const linkPreviews = () =>
			conversation.chat.linkEmbedsEnabled?.() === false
				? undefined
				: showLinkPreviews();
		const [name, setNameSignal] = createSignal("");
		createEffect(
			on(draftKey, (key) => {
				if (key && !name()) setNameSignal(readThreadNameDraft(key));
			}),
		);
		const setName = (next: string) => {
			setNameSignal(next);
			const key = draftKey();
			if (key) writeThreadNameDraft(key, next);
		};
		const discardDraft = () => {
			draft.clear();
			const key = draftKey();
			if (key) writeThreadNameDraft(key, "");
		};
		const discard = () => {
			discardDraft();
			closePane(stack);
		};
		const [busy, setBusy] = createSignal(false);
		const tooLong = () => threadNameTooLong(name().trim());

		const authorName = () => {
			const message = anchorMessage();
			const current = community();
			if (!message) return "";
			const member = current
				? data.space(current).memberByDid(message.author.did)
				: undefined;
			return displayNameOf(member?.actor ?? message.author, member);
		};

		const submit = async (value: { text: string; facets: unknown[] }) => {
			const ref = parent()?.space;
			if (!ref || busy()) return false;
			const payload = fromComposerValue(
				value as Parameters<typeof fromComposerValue>[0],
			);
			if (!payload.text && !conversation.attachments.hasAttachments()) {
				return false;
			}
			if (tooLong()) {
				toast.error(
					`Thread names can be up to ${THREAD_NAME_MAX_BYTES} bytes long`,
				);
				return false;
			}
			const message = anchorMessage();
			const anchor: ThreadAnchor | undefined = message
				? { space: ref, did: message.author.did, rkey: message.rkey }
				: undefined;
			const showPreviews = showLinkPreviews();
			setBusy(true);
			try {
				const created = await data.channel(ref).createThread({
					name: chooseThreadName(name(), suggested()),
					anchor,
				});
				discardDraft();
				const converted = data.emoji.withFacets(
					community()?.did,
					payload.text,
					payload.facets,
				);
				const suppressedEmbeds = suppressedLinksFor(
					converted.facets,
					showPreviews,
				);
				void data.channel(created.space).send({
					...payload,
					text: converted.text,
					facets: converted.facets,
					files: conversation.attachments.take(),
					suppressedEmbeds,
				});
				stack.replaceTop({
					kind: "thread",
					space: args.space,
					channel: args.channel,
					channelType: args.channelType,
					thread: skeyOf(created.space),
				});
				return true;
			} catch {
				toast.error("Couldn't create the thread", {
					description: "Your draft is still here. Try again in a moment.",
				});
				return false;
			} finally {
				setBusy(false);
			}
		};

		return {
			args,
			stack,
			parent,
			anchorMessage,
			authorName,
			suggested,
			conversation,
			name,
			setName,
			busy,
			tooLong,
			submit,
			draft,
			linkPreviews,
			discard,
		};
	},
	slots: {
		Header: slot((m, p: { platform?: "mobile" | "desktop" }) => (
			<Show
				when={p.platform !== "desktop"}
				fallback={
					<ChannelHeader
						platform="desktop"
						name="New thread"
						icon={<ThreadIcon />}
						description={m.parent() ? `in #${m.parent()?.name}` : undefined}
						actions={
							<IconButton
								variant="ghost"
								size="md"
								label="Discard thread"
								icon={<CloseIcon />}
								onClick={m.discard}
							/>
						}
					/>
				}
			>
				<NavHeader
					safeTop
					kind="back"
					navigateLabel="Discard thread"
					onNavigate={m.discard}
					title={
						<span class="flex min-w-0 flex-col">
							<span class="truncate">New thread</span>
							<Show when={m.parent()}>
								{(channel) => (
									<span class="truncate text-xs font-normal text-muted-foreground">
										{`in #${channel().name}`}
									</span>
								)}
							</Show>
						</span>
					}
				/>
			</Show>
		)),
		Name: slot((m) => (
			<TextField
				label="Thread name (optional)"
				value={m.name()}
				onChange={m.setName}
				placeholder={m.suggested() || FALLBACK_THREAD_NAME}
				error={
					m.tooLong()
						? `Up to ${THREAD_NAME_MAX_BYTES} bytes. Shorten the name to create the thread.`
						: undefined
				}
			/>
		)),
		Anchor: slot((m) => (
			<Show when={m.anchorMessage()}>
				{(message) => (
					<div
						data-thread-anchor=""
						class="flex min-w-0 flex-col gap-1 overflow-hidden rounded-control bg-secondary px-3 py-2"
					>
						<span class="flex min-w-0 items-center gap-2">
							<Avatar
								size="xs"
								src={message().author.avatar}
								name={m.authorName()}
								seed={message().author.did}
							/>
							<span class="min-w-0 truncate text-sm font-semibold">
								{m.authorName()}
							</span>
						</span>
						<p class="m-0 line-clamp-3 text-sm text-muted-foreground [overflow-wrap:anywhere]">
							{message().text || "Attachment"}
						</p>
					</div>
				)}
			</Show>
		)),
		Composer: slot((m, p: { platform?: "mobile" | "desktop" }) => (
			<>
				<Composer
					platform={p.platform ?? "mobile"}
					safeBottom={p.platform !== "desktop"}
					channelName={m.parent()?.name ?? m.args.channel}
					placeholder="Enter a message to start the conversation!"
					sources={m.conversation.sources}
					onSend={m.submit}
					onChange={m.draft.changed}
					onUpload={() => m.conversation.attachments.pick()}
					onPasteFiles={(files) => m.conversation.attachments.addFiles(files)}
					hasAttachments={m.conversation.attachments.hasAttachments()}
					onEmoji={(event) => {
						m.conversation.setMediaAnchor(
							event.currentTarget instanceof HTMLElement
								? event.currentTarget
								: undefined,
						);
						m.conversation.media.openEmoji();
					}}
					onGif={(event) => {
						m.conversation.setMediaAnchor(
							event.currentTarget instanceof HTMLElement
								? event.currentTarget
								: undefined,
						);
						m.conversation.media.openGif();
					}}
					editorRef={(handle) => {
						m.conversation.setEditor(handle);
						m.draft.bind(handle);
					}}
					disabled={m.parent()?.viewer.canPost === false}
					disabledReason="You can't post in this channel."
					top={<m.conversation.attachments.Tray />}
					linkPreviews={m.linkPreviews()}
					onLinkPreviewsChange={m.draft.setLinkPreviews}
				/>
				<m.conversation.media.Sheet />
			</>
		)),
	},
});
