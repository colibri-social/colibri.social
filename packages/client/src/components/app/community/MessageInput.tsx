import type { ColibriRichTextFacet } from "@colibri-social/lib";
import { useFileFieldContext } from "@kobalte/core/file-field";
import {
	type Component,
	createEffect,
	createSignal,
	For,
	type JSX,
	Match,
	on,
	onCleanup,
	onMount,
	Show,
	Switch,
} from "solid-js";
import { toast } from "somoto";
import ArrowsMergeIcon from "~icons/ph/arrows-merge";
import CircleIcon from "~icons/ph/circle";
import FileIcon from "~icons/ph/file";
import PaperPlaneRightIcon from "~icons/ph/paper-plane-right-fill";
import PaperclipIcon from "~icons/ph/paperclip";
import PlusIcon from "~icons/ph/plus";
import XIcon from "~icons/ph/x";
import { enqueueMessageSend } from "../../../atproto/outbox/sends";
import type { Facet, RecordRef } from "../../../atproto/views";
import { useChannelContext } from "../../../contexts/Channel";
import { useCommunityContext } from "../../../contexts/Community";
import { useUserContext } from "../../../contexts/User";
import { useUserPreferences } from "../../../contexts/UserPreferences";
import {
	readAttachmentDraft,
	writeAttachmentDraft,
} from "../../../utils/attachment-drafts";
import { linkUrisFromFacets } from "../../../utils/link-facets";
import { useIsMobile } from "../../../utils/mobile-pane";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuPortal,
	DropdownMenuTrigger,
} from "../../ui/DropdownMenu";
import {
	FileFieldItem,
	FileFieldItemDeleteTrigger,
	FileFieldItemList,
	FileFieldItemName,
	FileFieldItemPreviewImage,
	FileFieldItemSize,
	FileFieldTrigger,
} from "../../ui/FileField";
import { isRemovableEmbed } from "../channel/message/Embed";
import { Lightbox } from "../common/Lightbox";
import { trimWithFacets } from "../common/rich-text-renderer/util";
import { TextEditor } from "../common/text-editor/TextEditor";
import { DisplayableName, displayableNameFn } from "../user/DisplayableName";

const PLUS_CLASSES =
	"w-10 h-10 min-w-10 bg-muted text-muted-foreground hover:text-primary-foreground flex items-center justify-center rounded-lg cursor-pointer disabled:pointer-events-none disabled:opacity-50";

/**
 * The message input used to send messages to the currently viewed channel.
 */
export type ComposerSubmission = {
	text: string;
	facets: Array<ColibriRichTextFacet>;
	files: Array<File>;
	suppressedEmbeds: Array<string>;
};

export const MessageInput: Component<{
	disabled: boolean;
	disabledReason?: string;
	disabledAction?: JSX.Element;
	channelName: string;
	maxAttachments: number;
	placeholder?: string;
	onSend?: (submission: ComposerSubmission) => Promise<boolean>;
	onStartThread?: () => void;
}> = (props) => {
	const fileField = useFileFieldContext();

	const channel = useChannelContext();
	const community = useCommunityContext();
	const user = useUserContext();
	const userPreferences = useUserPreferences();

	let inputEl!: HTMLDivElement;

	const isMobile = useIsMobile();

	const [editorEmpty, setEditorEmpty] = createSignal(true);
	const [charPercent, setCharPercent] = createSignal(0);
	const [embedsEnabled, setEmbedsEnabled] = createSignal(
		userPreferences.preferences().linkEmbedsByDefault,
	);

	createEffect(() => {
		const excess = fileField.acceptedFiles.length - props.maxAttachments;
		if (excess <= 0) return;

		const overflow = fileField.acceptedFiles.slice(
			fileField.acceptedFiles.length - excess,
		);
		for (const file of overflow) fileField.removeFile(file);

		toast.error("Too many attachments", {
			description: `You can attach up to ${props.maxAttachments} files per message.`,
		});
	});

	const clearAttachments = (files: Array<File>) => {
		for (const file of files) fileField.removeFile(file);
	};

	createEffect(
		on(
			() => channel.channelSpace(),
			(space, previousSpace) => {
				const carried = [...fileField.acceptedFiles];
				if (previousSpace) writeAttachmentDraft(previousSpace, carried);
				clearAttachments(carried);
				const restored = space ? readAttachmentDraft(space) : [];
				if (restored.length > 0) fileField.processFiles(restored);
			},
			{ defer: true },
		),
	);

	let submitMessage: (() => void) | undefined;

	const hasAttachments = () => fileField.acceptedFiles.length > 0;

	const showSendButton = () =>
		isMobile() && (!editorEmpty() || hasAttachments());

	// Typing indicator: ping the AppView at most once every 2s while the user
	// is actively typing. There's no explicit "stop" — receivers auto-clear
	// after the channel context's hold window once pings cease.
	let lastTypingPing = 0;

	const handleTypingChange = () => {
		const now = Date.now();

		if (now - lastTypingPing > 2000) {
			lastTypingPing = now;

			channel.sendTyping();
		}
	};

	createEffect(
		on(
			() => channel.channelSpace(),
			() => {
				lastTypingPing = 0;
			},
			{ defer: true },
		),
	);

	/** Resolve a typing user's DID to a display name via the member cache. */
	const typingDisplayName = (did: string): string => {
		const member = community().members.find((m) => m.did === did);

		if (!member) return "";

		return displayableNameFn(member.actor, member.nickname);
	};

	/**
	 * Sends the message currently contained in the input.
	 */
	const sendMessage = async (
		text: string,
		facets: Array<ColibriRichTextFacet>,
	): Promise<boolean> => {
		const acceptedFiles = [...fileField.acceptedFiles];
		const hasFiles = acceptedFiles.length > 0;
		const replyingMessage = channel.replyingTo();
		const targetChannelSpace = channel.channelSpace();

		const trimmed = trimWithFacets({ text, facets });
		const cleanText = trimmed.text;
		const cleanFacets = trimmed.facets;

		if (cleanText.length === 0 && !hasFiles) {
			toast.error("Failed to send message", {
				description: "Cannot send an empty message.",
			});
			return false;
		}

		if (hasFiles && typeof navigator !== "undefined" && !navigator.onLine) {
			toast.error("You're offline", {
				description:
					"Attachments can't be sent until you're back online. Your message is still here.",
			});
			return false;
		}

		const suppressedEmbeds = embedsEnabled()
			? []
			: linkUrisFromFacets(cleanFacets).filter(isRemovableEmbed);

		const send = props.onSend;
		if (send) {
			const sent = await send({
				text: cleanText,
				facets: cleanFacets,
				files: acceptedFiles,
				suppressedEmbeds,
			});
			if (!sent) return false;
			clearAttachments(acceptedFiles);
			lastTypingPing = 0;
			setEmbedsEnabled(userPreferences.preferences().linkEmbedsByDefault);
			return true;
		}

		if (hasFiles) {
			const queued = await enqueueMessageSend({
				space: targetChannelSpace,
				repo: user.did,
				text: cleanText,
				facets: cleanFacets as unknown as Array<Facet>,
				files: acceptedFiles,
				parent: replyingMessage
					? ({
							did: replyingMessage.author.did,
							rkey: replyingMessage.rkey,
						} as RecordRef)
					: undefined,
				suppressedEmbeds,
			});

			if (!queued.ok) {
				toast.error("Too much waiting to upload", {
					description:
						"Send or remove some of your queued attachments before adding more.",
				});
				return false;
			}

			channel.advanceReadCursor(queued.rkey);
			clearAttachments(acceptedFiles);
		} else {
			await channel.sendMessage({
				text: cleanText,
				facets: cleanFacets,
				parent: replyingMessage,
				suppressedEmbeds,
			});
		}

		channel.clearReplyingTo();
		// Reset the throttle so the next keystroke after sending pings promptly.
		lastTypingPing = 0;
		setEmbedsEnabled(userPreferences.preferences().linkEmbedsByDefault);

		return true;
	};

	const isEditingOnMobile = () =>
		isMobile() && channel.editingMessage() !== undefined;

	const handleSubmit = (
		text: string,
		facets: Array<ColibriRichTextFacet>,
	): Promise<boolean> =>
		isEditingOnMobile()
			? channel.submitMessageEdit(text, facets)
			: sendMessage(text, facets);

	let root: HTMLDivElement | undefined;

	const focusEditor = () => {
		root
			?.querySelector<HTMLParagraphElement>("#editor .ProseMirror")
			?.focus({ preventScroll: true });
	};

	onMount(() => channel.registerComposerFocus(focusEditor));
	onCleanup(() => channel.registerComposerFocus(undefined));

	createEffect(() => {
		const target = channel.replyingTo();
		// Tracking
		const _ = fileField.acceptedFiles.length;

		if (!target) return;

		setTimeout(focusEditor, 0);
	});

	return (
		<div ref={root} class="w-full flex h-fit flex-col gap-0 relative shrink-0">
			<Show when={isMobile()}>
				<div class="w-full h-0.5 bg-muted/40 overflow-hidden shrink-0">
					<div
						class="h-full transition-all duration-150"
						classList={{
							"bg-primary": charPercent() < 90,
							"bg-yellow-500": charPercent() >= 90 && charPercent() < 100,
							"bg-red-500": charPercent() === 100,
						}}
						style={{ width: `${charPercent()}%` }}
					/>
				</div>
			</Show>
			<Show when={isEditingOnMobile()}>
				<div class="border-y border-border w-full px-4 py-2 bg-primary/5 backdrop-blur-sm text-foreground flex justify-between items-center">
					<span>Editing message</span>
					<button
						type="button"
						class="cursor-pointer w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground"
						onClick={channel.cancelMessageEdit}
					>
						<CircleIcon />
					</button>
				</div>
			</Show>
			<Show when={channel.replyingTo() !== undefined && !isEditingOnMobile()}>
				<div class="border-y border-border w-full px-4 py-2 bg-blue-500/5 backdrop-blur-sm text-foreground flex justify-between items-center">
					<span>
						Replying to{" "}
						<strong>
							<DisplayableName user={channel.replyingTo()!.author} />
						</strong>
					</span>
					<button
						type="button"
						class="cursor-pointer w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground"
						onClick={channel.clearReplyingTo}
					>
						<CircleIcon />
					</button>
				</div>
			</Show>
			<Show when={fileField.acceptedFiles.length > 0}>
				<div
					class="left-0 border-t border-border w-full px-4 py-2 bg-background/75 backdrop-blur-sm text-foreground flex flex-col gap-2"
					classList={{
						"border-t-0": channel.replyingTo() !== undefined,
					}}
				>
					<div class="flex items-center justify-between text-xs">
						<span class="text-muted-foreground">
							{fileField.acceptedFiles.length}/{props.maxAttachments}{" "}
							attachments
						</span>
					</div>
					<Show
						when={isMobile()}
						fallback={
							<FileFieldItemList class="flex flex-row gap-2 m-0 p-0 flex-wrap">
								{(item) => (
									<FileFieldItem>
										<Switch fallback={<FileFieldItemPreviewImage />}>
											<Match when={item.type.includes("image")}>
												<Lightbox src={URL.createObjectURL(item)}>
													<FileFieldItemPreviewImage class="cursor-pointer" />
												</Lightbox>
											</Match>
										</Switch>
										<FileFieldItemName />
										<FileFieldItemSize />
										<FileFieldItemDeleteTrigger />
									</FileFieldItem>
								)}
							</FileFieldItemList>
						}
					>
						<div class="flex flex-row gap-2 overflow-x-auto pb-1 max-w-full">
							<For each={fileField.acceptedFiles}>
								{(item) => {
									const isImage = item.type.includes("image");
									const src = isImage ? URL.createObjectURL(item) : undefined;

									return (
										<div class="relative shrink-0 size-14 rounded-md border border-border bg-secondary/30 overflow-hidden">
											<Show
												when={isImage}
												fallback={
													<div class="w-full h-full flex items-center justify-center text-muted-foreground">
														<FileIcon class="size-6" />
													</div>
												}
											>
												<Lightbox src={src!} class="w-full h-full">
													<img
														src={src}
														alt={item.name}
														class="w-full h-full object-cover cursor-pointer"
													/>
												</Lightbox>
											</Show>
											<button
												type="button"
												aria-label="Remove attachment"
												onClick={() => fileField.removeFile(item)}
												class="absolute top-0.5 right-0.5 size-5 flex items-center justify-center rounded-full bg-background/90 text-destructive"
											>
												<XIcon class="size-3.5" />
											</button>
										</div>
									);
								}}
							</For>
						</div>
					</Show>
				</div>
			</Show>
			<Show when={channel.typingUsers().length > 0}>
				<div class="px-4 py-2 text-xs text-foreground pointer-events-none z-50 h-8 pt-1 overflow-hidden absolute top-0 left-0 bg-linear-to-b from-background/0 from-0% via-background/70 via-35% to-background to-90% -translate-y-full w-full flex flex-col justify-end">
					<Show
						when={channel.typingUsers().length === 1}
						fallback={
							<Show
								when={channel.typingUsers().length === 2}
								fallback={<span>Several people are typing...</span>}
							>
								<span>
									{typingDisplayName(channel.typingUsers()[0])} and{" "}
									{typingDisplayName(channel.typingUsers()[1])} are typing...
								</span>
							</Show>
						}
					>
						<span>
							{typingDisplayName(channel.typingUsers()[0])} is typing...
						</span>
					</Show>
				</div>
			</Show>
			<div
				class="w-full min-h-16 h-fit flex flex-row gap-4 px-4 py-3 bg-card relative chat-input-container justify-center"
				classList={{ "items-end": isMobile(), "items-center": !isMobile() }}
			>
				<Switch>
					<Match when={!props.disabled}>
						<Show
							when={props.onStartThread}
							fallback={
								<FileFieldTrigger class={PLUS_CLASSES}>
									<PlusIcon />
								</FileFieldTrigger>
							}
						>
							{(startThread) => (
								<DropdownMenu placement="top-start">
									<DropdownMenuTrigger
										class={PLUS_CLASSES}
										aria-label="More actions"
									>
										<PlusIcon />
									</DropdownMenuTrigger>
									<DropdownMenuPortal>
										<DropdownMenuContent class="w-52">
											<DropdownMenuItem
												onSelect={() => fileField.fileInputRef()?.click()}
											>
												<PaperclipIcon />
												<span>Attach files</span>
											</DropdownMenuItem>
											<DropdownMenuItem onSelect={() => startThread()()}>
												<ArrowsMergeIcon class="rotate-180" />
												<span>Start a thread</span>
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenuPortal>
								</DropdownMenu>
							)}
						</Show>
						<div ref={inputEl} class="flex-1 min-w-0">
							<div class="w-full">
								<TextEditor
									mainEditor
									placeholder={
										props.placeholder ?? `Message ${props.channelName}`
									}
									sendMessage={handleSubmit}
									onChange={handleTypingChange}
									onImagePaste={(files) => fileField.processFiles(files)}
									onEscape={() =>
										isEditingOnMobile()
											? channel.cancelMessageEdit()
											: channel.clearReplyingTo()
									}
									submitOnEnter={!isMobile()}
									onEmptyChange={setEditorEmpty}
									onProgress={setCharPercent}
									embedsEnabled={
										channel.linkEmbedsEnabled() && !isEditingOnMobile()
											? embedsEnabled
											: undefined
									}
									onEmbedsEnabledChange={setEmbedsEnabled}
									registerSubmit={(submit) => {
										submitMessage = submit;
									}}
								/>
							</div>
						</div>
						<Show when={showSendButton()}>
							<button
								type="button"
								aria-label="Send message"
								// Keep focus (and the mobile keyboard) on the editor instead of
								// letting the tap shift it to this button.
								onMouseDown={(e) => e.preventDefault()}
								onClick={() => submitMessage?.()}
								class="w-10 h-10 min-w-10 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center rounded-lg cursor-pointer disabled:pointer-events-none disabled:opacity-50"
							>
								<PaperPlaneRightIcon />
							</button>
						</Show>
					</Match>
					<Match when={props.disabled}>
						<div class="w-full flex flex-row items-center justify-between gap-3">
							<span class="text-sm">
								{props.disabledReason ??
									"You are not allowed to send messages in this channel."}
							</span>
							<Show when={props.disabledAction}>{props.disabledAction}</Show>
						</div>
					</Match>
				</Switch>
			</div>
		</div>
	);
};
