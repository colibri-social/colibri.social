import { JsonBlobRef } from "@atproto/lexicon";
import { type Details, useFileFieldContext } from "@kobalte/core/file-field";
import { useParams } from "@solidjs/router";
import stringify from "json-stable-stringify";
import { AttachmentObj, ColibriRichTextFacet } from "lib";
import {
	type Accessor,
	type Component,
	createEffect,
	createSignal,
	Show,
	untrack,
} from "solid-js";
import { toast } from "somoto";
import { useChannelContext } from "../../../contexts/Channel";
import { useCommunityContext } from "../../../contexts/Community";
import { useUserContext } from "../../../contexts/User";
import type { PendingMessage } from "../../../atproto/xrpc/social/colibri/channel/listMessages";
import { createRecord } from "../../../atproto/pds";
import { purify } from "../../../utils/purify";
import { DisplayableName } from "../user/DisplayableName";
import CircleIcon from "~icons/ph/circle";
import PlusIcon from "~icons/ph/plus";
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

// TODO: This does not work in Firefox. We might need a different solution for file uploads, but I am
// not sure if the PDS allows for tracking progress, and I do not want to proxy the files
const uploadWithProgress = (
	file: File,
	onProgress: (percent: number) => void,
): Promise<AttachmentObj> => {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open("POST", "/api/v1/blob/upload");

		// Phase 1: browser → our server (mapped to 0–50%)
		xhr.upload.onprogress = (e) => {
			if (e.lengthComputable) {
				onProgress((e.loaded / e.total) * 50);
			}
		};

		// Phase 1 complete; start simulated phase 2 (50–99%) while
		// the server relays the blob to the PDS.
		xhr.upload.onload = () => {
			onProgress(50);
			let simulated = 50;
			const interval = setInterval(() => {
				// Asymptotically approach 99% so it never actually reaches it.
				simulated += (99 - simulated) * 0.1;
				onProgress(simulated);
			}, 200);

			// Store the interval id on the xhr so we can clear it in onload.
			(xhr as XMLHttpRequest & { _sim?: ReturnType<typeof setInterval> })._sim =
				interval;
		};

		xhr.onload = () => {
			const xhrExt = xhr as XMLHttpRequest & {
				_sim?: ReturnType<typeof setInterval>;
			};
			clearInterval(xhrExt._sim);
			onProgress(100);
			resolve({
				blob: JSON.parse(xhr.responseText) as JsonBlobRef,
				name: file.name,
			});
		};

		xhr.onerror = () => {
			const xhrExt = xhr as XMLHttpRequest & {
				_sim?: ReturnType<typeof setInterval>;
			};
			clearInterval(xhrExt._sim);
			reject(new Error("Upload failed"));
		};

		xhr.send(file);
	});
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
	const [fileUploadProgress, setFileUploadProgress] = createSignal<
		Array<number>
	>([]);

	let inputEl!: HTMLDivElement;

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

	/** Resolve a typing user's DID to a display name via the member cache. */
	const typingDisplayName = (did: string): string => {
		const member = community().members.find((m) => m.did === did);
		return member?.data.displayName ?? member?.handle ?? did;
	};

	/**
	 * Uploads files and collects progress while we're at it.
	 * @param files The files to upload
	 * @todo This is more or less unused - progress should be shown on the pending message with file stubs.
	 */
	const uploadFiles = async (
		files: Array<File>,
	): Promise<Array<AttachmentObj>> => {
		setFileUploadProgress(files.map(() => 0));
		const promises: Array<Promise<AttachmentObj>> = [];

		files.forEach((file, index) => {
			promises.push(
				uploadWithProgress(file, (percent) => {
					setFileUploadProgress((current) => {
						const next = [...current];
						next[index] = percent;
						return next;
					});
				}),
			);
		});

		return await Promise.all(promises);
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

		for (const file of fileField.acceptedFiles) {
			fileField.removeFile(file);
		}

		let attachments: AttachmentObj[] = [];
		if (hasFiles) {
			try {
				attachments = await uploadFiles(acceptedFiles);
			} catch {
				toast.error("Failed to upload attachments.");
				setFileUploadProgress([]);
				return false;
			}
		}
		setFileUploadProgress([]);

		const now = new Date().toISOString();
		const hash = crypto.randomUUID();

		const pending: PendingMessage = {
			hash,
			uri: "",
			text: cleanText,
			facets,
			channel: channel.channelUri(),
			community: "",
			author: { did: user.did, handle: user.handle, data: user.data },
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
						{(file) => (
							<FileFieldItem class="relative overflow-hidden">
								<FileFieldItemPreviewImage />
								<FileFieldItemName />
								<FileFieldItemSize />
								<FileFieldItemDeleteTrigger />
								<div
									class="absolute left-0 bottom-0 h-1 bg-primary"
									style={{
										width: `${fileUploadProgress()[props.files()?.acceptedFiles.indexOf(file) ?? -1]}%`,
									}}
								/>
							</FileFieldItem>
						)}
					</FileFieldItemList>
				</div>
			</Show>
			<Show when={channel.typingUsers().length > 0}>
				<div class="px-4 py-1 text-xs text-muted-foreground h-5 overflow-hidden">
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
			<div class="w-full min-h-16 h-fit flex flex-row gap-4 px-4 py-3 bg-card">
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
