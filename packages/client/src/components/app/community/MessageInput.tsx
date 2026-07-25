import type { Agent } from "@atproto/api";
import type { JsonBlobRef } from "@atproto/lexicon";
import type { AttachmentObj, ColibriRichTextFacet } from "@colibri-social/lib";
import { useFileFieldContext } from "@kobalte/core/file-field";
import {
	type Component,
	createEffect,
	createSignal,
	For,
	Match,
	Show,
	Switch,
} from "solid-js";
import { toast } from "somoto";
import CheckIcon from "~icons/ph/check";
import CircleIcon from "~icons/ph/circle";
import FileIcon from "~icons/ph/file";
import PaperPlaneRightIcon from "~icons/ph/paper-plane-right-fill";
import PlusIcon from "~icons/ph/plus";
import SpinnerIcon from "~icons/ph/spinner-gap";
import XIcon from "~icons/ph/x";
import { enqueueCreate } from "../../../atproto/outbox/outbox";
import { uploadBlob } from "../../../atproto/pds";
import type { PendingMessage } from "../../../atproto/xrpc/social/colibri/channel/listMessages";
import { useChannelContext } from "../../../contexts/Channel";
import { useCommunityContext } from "../../../contexts/Community";
import { useUserContext } from "../../../contexts/User";
import { useIsMobile } from "../../../utils/mobile-pane";
import { purify } from "../../../utils/purify";
import {
	FileFieldItem,
	FileFieldItemDeleteTrigger,
	FileFieldItemList,
	FileFieldItemName,
	FileFieldItemPreviewImage,
	FileFieldItemSize,
	FileFieldTrigger,
} from "../../ui/FileField";
import { Lightbox } from "../common/Lightbox";
import { trimWithFacets } from "../common/rich-text-renderer/util";
import { TextEditor } from "../common/text-editor/TextEditor";
import { DisplayableName, displayableNameFn } from "../user/DisplayableName";

// Uploads a single file straight to the user's PDS via the authenticated
// (OAuth) agent and resolves to an AttachmentObj ready to embed in a record.
const uploadFile = async (agent: Agent, file: File): Promise<AttachmentObj> => {
	const blob = await uploadBlob(agent, file);
	return {
		blob: blob.toJSON() as unknown as JsonBlobRef,
		name: file.name,
	};
};

/**
 * The message input used to send messages to the currently viewed channel.
 */
export const MessageInput: Component<{
	disabled: boolean;
	channelName: string;
	maxAttachments: number;
}> = (props) => {
	const fileField = useFileFieldContext();

	const channel = useChannelContext();
	const community = useCommunityContext();
	const user = useUserContext();

	let inputEl!: HTMLDivElement;

	const isMobile = useIsMobile();

	const [editorEmpty, setEditorEmpty] = createSignal(true);
	const [charPercent, setCharPercent] = createSignal(0);
	const [isSending, setIsSending] = createSignal(false);
	const [uploadedFiles, setUploadedFiles] = createSignal<Set<File>>(new Set());

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

	let submitMessage: (() => void) | undefined;

	const hasAttachments = () => fileField.acceptedFiles.length > 0;

	const showSendButton = () =>
		isMobile() && (!editorEmpty() || hasAttachments());

	// Typing indicator: ping the AppView at most once every 2s while the user
	// is actively typing. There's no explicit "stop" — receivers auto-clear
	// after the channel context's hold window once pings cease.
	let lastTypingPing = Date.now();

	const handleTypingChange = () => {
		const now = Date.now();

		if (now - lastTypingPing > 2000) {
			lastTypingPing = now;

			channel.sendTyping();
		}
	};

	/** Resolve a typing user's DID to a display name via the member cache. */
	const typingDisplayName = (did: string): string => {
		const member = community().members.find((m) => m.did === did);

		if (!member) return "";

		return displayableNameFn(member);
	};

	/**
	 * Uploads the given files to the user's PDS in parallel.
	 * @param files The files to upload
	 */
	const uploadFiles = (files: Array<File>): Promise<Array<AttachmentObj>> => {
		return Promise.all(
			files.map(async (file) => {
				const attachment = await uploadFile(user.atproto.agent, file);
				setUploadedFiles((prev) => new Set(prev).add(file));
				return attachment;
			}),
		);
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
		const replyingMessage = channel.replyingTo()
			? JSON.parse(JSON.stringify(channel.replyingTo()))
			: undefined;

		const trimmed = trimWithFacets({ text, facets });
		const cleanText = purify(trimmed.text);
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

		channel.clearReplyingTo();
		// Reset the throttle so the next keystroke after sending pings promptly.
		lastTypingPing = 0;

		if (hasFiles) {
			setUploadedFiles(new Set());
			setIsSending(true);
		}

		try {
			let attachments: AttachmentObj[] = [];
			if (hasFiles) {
				try {
					attachments = await uploadFiles(acceptedFiles);
				} catch (err) {
					toast.error("Failed to upload attachments.", {
						description:
							err instanceof Error
								? err.message
								: "An unexpected error occurred while uploading to your PDS.",
					});
					return false;
				}
			}

			const now = new Date().toISOString();
			const hash = crypto.randomUUID();

			let uri: string;
			try {
				({ uri } = await enqueueCreate(
					user.did,
					"social.colibri.message",
					{
						text: cleanText,
						facets: cleanFacets,
						channel: channel.channelUri(),
						createdAt: now,
						...(replyingMessage ? { parent: replyingMessage.uri } : {}),
						...(attachments.length > 0 ? { attachments } : {}),
					},
					{ label: "Failed to send message." },
				));
			} catch {
				toast.error("Failed to send message.");
				return false;
			}

			const pending: PendingMessage = {
				hash,
				uri,
				text: cleanText,
				facets: cleanFacets,
				channel: channel.channelUri(),
				community: "",
				author: {
					did: user.did,
					handle: user.handle.replaceAll("at://", ""),
					data: user.data,
				},
				parent: replyingMessage,
				attachments,
				reactions: [],
				createdAt: now,
				edited: false,
			};

			channel.addPendingMessage(pending);
			channel.advanceReadCursor(uri);

			for (const file of acceptedFiles) {
				fileField.removeFile(file);
			}

			return true;
		} finally {
			if (hasFiles) setIsSending(false);
		}
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

	createEffect(() => {
		const target = channel.replyingTo();
		// Tracking
		const _ = fileField.acceptedFiles.length;

		if (!target) return;

		const richTextMessageInput = document.querySelector<HTMLParagraphElement>(
			"#editor .ProseMirror",
		);

		if (richTextMessageInput) {
			setTimeout(() => richTextMessageInput.focus(), 0);
		}
	});

	return (
		<div class="w-full flex h-fit flex-col gap-0 relative shrink-0">
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
						<Show
							when={isSending()}
							fallback={
								<span class="text-muted-foreground">
									{fileField.acceptedFiles.length}/{props.maxAttachments}{" "}
									attachments
								</span>
							}
						>
							<span class="flex items-center gap-1.5 text-foreground">
								<SpinnerIcon class="size-4 animate-spin" />
								Uploading {uploadedFiles().size} of{" "}
								{fileField.acceptedFiles.length}…
							</span>
						</Show>
					</div>
					<Show
						when={isMobile()}
						fallback={
							<FileFieldItemList
								class="flex flex-row gap-2 m-0 p-0 flex-wrap"
								classList={{ "pointer-events-none": isSending() }}
							>
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
										<Switch fallback={<FileFieldItemDeleteTrigger />}>
											<Match when={isSending() && uploadedFiles().has(item)}>
												<span class="[grid-area:delete] self-center flex items-center justify-center p-0.5 text-green-500">
													<CheckIcon class="size-4" />
												</span>
											</Match>
											<Match when={isSending()}>
												<span class="[grid-area:delete] self-center flex items-center justify-center p-0.5 text-muted-foreground">
													<SpinnerIcon class="size-4 animate-spin" />
												</span>
											</Match>
										</Switch>
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
											<Switch>
												<Match when={isSending() && uploadedFiles().has(item)}>
													<div class="absolute inset-0 flex items-center justify-center bg-black/40 text-green-400">
														<CheckIcon class="size-5" />
													</div>
												</Match>
												<Match when={isSending()}>
													<div class="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
														<SpinnerIcon class="size-5 animate-spin" />
													</div>
												</Match>
												<Match when={!isSending()}>
													<button
														type="button"
														aria-label="Remove attachment"
														onClick={() => fileField.removeFile(item)}
														class="absolute top-0.5 right-0.5 size-5 flex items-center justify-center rounded-full bg-background/90 text-destructive"
													>
														<XIcon class="size-3.5" />
													</button>
												</Match>
											</Switch>
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
						<FileFieldTrigger
							disabled={isSending()}
							class="w-10 h-10 min-w-10 bg-muted text-muted-foreground hover:text-primary-foreground flex items-center justify-center rounded-lg cursor-pointer disabled:pointer-events-none disabled:opacity-50"
						>
							<PlusIcon />
						</FileFieldTrigger>
						<div ref={inputEl} class="flex-1 min-w-0">
							<div class="w-full">
								<TextEditor
									mainEditor
									blocked={isSending}
									placeholder={`Message ${props.channelName}`}
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
								disabled={isSending()}
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
						<span class="text-sm">
							You are not allowed to send messages in this channel.
						</span>
					</Match>
				</Switch>
			</div>
		</div>
	);
};
