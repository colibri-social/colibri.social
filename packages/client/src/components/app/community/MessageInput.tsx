import type { Agent } from "@atproto/api";
import type { JsonBlobRef } from "@atproto/lexicon";
import type { AttachmentObj, ColibriRichTextFacet } from "@colibri-social/lib";
import { type Details, useFileFieldContext } from "@kobalte/core/file-field";
import { type Accessor, type Component, createEffect, Show } from "solid-js";
import { toast } from "somoto";
import CircleIcon from "~icons/ph/circle";
import PlusIcon from "~icons/ph/plus";
import { createRecord, uploadBlob } from "../../../atproto/pds";
import type { PendingMessage } from "../../../atproto/xrpc/social/colibri/channel/listMessages";
import { useChannelContext } from "../../../contexts/Channel";
import { useCommunityContext } from "../../../contexts/Community";
import { useUserContext } from "../../../contexts/User";
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
	files: Accessor<Details | undefined>;
	channelName: string;
}> = (props) => {
	const fileField = useFileFieldContext();

	const channel = useChannelContext();
	const community = useCommunityContext();
	const user = useUserContext();

	let inputEl!: HTMLDivElement;

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
			files.map((file) => uploadFile(user.atproto.agent, file)),
		);
	};

	/**
	 * Sends the message currently contained in the input.
	 */
	const sendMessage = async (
		text: string,
		facets: Array<ColibriRichTextFacet>,
	): Promise<boolean> => {
		const files = props.files();
		const acceptedFiles = files?.acceptedFiles ?? [];
		const hasFiles = acceptedFiles.length > 0;
		const replyingMessage = channel.replyingTo()
			? JSON.parse(JSON.stringify(channel.replyingTo()))
			: undefined;

		const cleanText = purify(text.trim());

		if (cleanText.length === 0 && !hasFiles) {
			toast.error("Failed to send message", {
				description: "Cannot send an empty message.",
			});
			return false;
		}

		channel.clearReplyingTo();
		// Reset the throttle so the next keystroke after sending pings promptly.
		lastTypingPing = 0;

		// Snapshot first: `removeFile` mutates the live `acceptedFiles` array, so
		// iterating it directly shifts elements out from under the loop and leaves
		// some attachments behind.
		for (const file of [...fileField.acceptedFiles]) {
			fileField.removeFile(file);
		}

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

		const pending: PendingMessage = {
			hash,
			uri: "",
			text: cleanText,
			facets,
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

		try {
			const res = await createRecord(
				user.atproto.agent,
				user.did,
				"social.colibri.message",
				{
					text: cleanText,
					facets,
					channel: channel.channelUri(),
					createdAt: now,
					...(replyingMessage ? { parent: replyingMessage.uri } : {}),
					...(attachments.length > 0 ? { attachments } : {}),
				},
			);
			channel.confirmPendingMessage(hash, res.uri);
			channel.advanceReadCursor();
		} catch {
			channel.removePendingMessage(hash);
			toast.error("Failed to send message.");
			return false;
		}

		return true;
	};

	createEffect(() => {
		const target = channel.replyingTo();
		// Tracking
		const _ = props.files()?.acceptedFiles.length;

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
			<Show when={channel.replyingTo() !== undefined}>
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
			<Show
				when={(props.files() || { acceptedFiles: [] }).acceptedFiles.length > 0}
			>
				<div
					class="left-0 border-y border-border w-full px-4 py-2 bg-background/75 backdrop-blur-sm text-foreground flex justify-between items-center"
					classList={{
						"border-t-0": channel.replyingTo() !== undefined,
					}}
				>
					<FileFieldItemList class="flex flex-row gap-2 m-0 p-0 flex-wrap">
						{() => (
							<FileFieldItem>
								<FileFieldItemPreviewImage />
								<FileFieldItemName />
								<FileFieldItemSize />
								<FileFieldItemDeleteTrigger />
							</FileFieldItem>
						)}
					</FileFieldItemList>
				</div>
			</Show>
			<Show when={channel.typingUsers().length > 0}>
				<div class="px-4 py-1 text-xs text-foreground pointer-events-none z-50 h-20 pt-14 overflow-hidden absolute top-0 left-0 bg-linear-to-b from-background/0 from-0% via-background/70 via-35% to-background to-90% -translate-y-full w-full">
					<Show
						when={channel.typingUsers().length === 1}
						fallback={
							<Show
								when={channel.typingUsers().length === 2}
								fallback={<span>Several people are typing…</span>}
							>
								<span>
									{typingDisplayName(channel.typingUsers()[0])} and{" "}
									{typingDisplayName(channel.typingUsers()[1])} are typing…
								</span>
							</Show>
						}
					>
						<span>
							{typingDisplayName(channel.typingUsers()[0])} is typing…
						</span>
					</Show>
				</div>
			</Show>
			<div class="w-full min-h-16 h-fit flex flex-row gap-4 px-4 py-3 bg-card relative chat-input-container">
				<FileFieldTrigger class="w-10 h-10 min-w-10 bg-muted text-muted-foreground hover:text-primary-foreground flex items-center justify-center rounded-lg cursor-pointer">
					<PlusIcon />
				</FileFieldTrigger>
				<div
					ref={inputEl}
					class="w-[calc(100%-3.5rem)] max-w-[calc(100%-3.5rem)]"
					onPaste={(e) => {
						if ((e.clipboardData?.files.length || 0) > 0) {
							e.preventDefault();

							for (const file of e.clipboardData!.files) {
								fileField.processFiles([file]);
							}
						}
					}}
				>
					<div class="w-full">
						<TextEditor
							mainEditor
							placeholder={`Message ${props.channelName}`}
							sendMessage={sendMessage}
							onChange={handleTypingChange}
							onEscape={channel.clearReplyingTo}
						/>
					</div>
				</div>
			</div>
		</div>
	);
};
