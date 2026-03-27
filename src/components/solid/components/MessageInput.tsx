import { actions } from "astro:actions";
import { type Details, useFileFieldContext } from "@kobalte/core/file-field";
import { useParams } from "@solidjs/router";
import stringify from "json-stable-stringify";
import {
	type Accessor,
	type Component,
	createEffect,
	createSignal,
	Show,
} from "solid-js";
import { toast } from "somoto";
import type { PostMessageInput } from "@/actions/message/post";
import { Icon } from "@/components/solid/icons/Icon";
import type { Facet } from "@/utils/atproto/rich-text";
import { generateHash } from "@/utils/generate-hash";
import { parseZodToErrorOrDisplay } from "@/utils/parse-zod-to-error-or-display";
import { purify } from "@/utils/purify";
import { useGlobalContext } from "../contexts/GlobalContext";
import type { AttachmentObj, BlobObj } from "../contexts/GlobalContext/events";
import { useMessageContext } from "../contexts/MessageContext";
import {
	FileFieldItem,
	FileFieldItemDeleteTrigger,
	FileFieldItemList,
	FileFieldItemName,
	FileFieldItemPreviewImage,
	FileFieldItemSize,
	FileFieldTrigger,
} from "../shadcn-solid/file-field";
import { TextEditor } from "./TextEditor/TextEditor";

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
				blob: JSON.parse(xhr.responseText) as BlobObj,
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
	const params = useParams();
	const channel = () => params.channel!;
	const fileField = useFileFieldContext();

	const [messageData, { clearReplyingTo }] = useMessageContext();
	const [globalData, { addPendingMessage, removePendingMessage }] =
		useGlobalContext();
	const [fileUploadProgress, setFileUploadProgress] = createSignal<
		Array<number>
	>([]);

	let inputEl!: HTMLDivElement;

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
		facets: Array<Facet>,
	): Promise<boolean> => {
		const files = props.files();
		const hasFiles = (files?.acceptedFiles.length ?? 0) > 0;
		const replyingMessage = messageData.replyingTo
			? JSON.parse(JSON.stringify(messageData.replyingTo))
			: undefined;
		const _channel = channel();

		if (text.length === 0 && !hasFiles) {
			return false;
		}

		clearReplyingTo();

		for (const file of fileField.acceptedFiles) {
			fileField.removeFile(file);
		}

		const attachments = await uploadFiles(files?.acceptedFiles ?? []);

		const obj: PostMessageInput = {
			text: purify(text.trim()),
			facets: facets,
			channel: _channel,
			createdAt: new Date().toISOString(),
			parent: replyingMessage?.rkey,
			attachments,
		};

		if (obj.text.trim().length === 0) {
			toast.error("Failed to send message", {
				description: "Unable to send empty message.",
			});
			return false;
		}

		const hash = await generateHash(stringify(obj)!);

		addPendingMessage({
			channel: obj.channel,
			created_at: obj.createdAt,
			hash,
			text: purify(text.trim()),
			facets: facets,
			author_did: globalData.user.sub,
			display_name: globalData.user.displayName!,
			banner_url: globalData.user.banner,
			description: globalData.user.description,
			avatar_url: globalData.user.avatar!,
			parent: replyingMessage?.rkey,
			parent_message: replyingMessage || null,
			reactions: [],
			state: "offline",
		});

		const { error } = await actions.postMessage(obj);

		setFileUploadProgress([]);

		if (error) {
			toast.error("Failed to send message", {
				description: parseZodToErrorOrDisplay(error.message),
			});
			removePendingMessage(hash);
			return false;
		}

		// return true;
		return true;
	};

	createEffect(() => {
		const target = messageData.replyingTo;

		if (!target) return;

		const richTextMessageInput = document.querySelector<HTMLParagraphElement>(
			"#editor .ProseMirror",
		);

		if (richTextMessageInput) richTextMessageInput.focus();
	});

	return (
		<div class="w-full flex h-fit flex-col gap-0 relative shrink-0">
			<Show when={messageData.replyingTo !== undefined}>
				<div class="absolute top-0 left-0 transform -translate-y-full border-y border-border w-full px-4 py-2 bg-primary/5 backdrop-blur-sm text-foreground flex justify-between items-center">
					<span>
						Replying to <strong>{messageData.replyingTo!.display_name}</strong>
					</span>
					<button
						type="button"
						class="cursor-pointer w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground"
						onClick={clearReplyingTo}
					>
						<Icon variant="regular" name="x-circle-icon" />
					</button>
				</div>
			</Show>
			<Show
				when={(props.files() || { acceptedFiles: [] }).acceptedFiles.length > 0}
			>
				<div
					class="left-0 border-y border-border w-full px-4 py-2 bg-background/75 backdrop-blur-sm text-foreground flex justify-between items-center"
					classList={{
						"border-t-0": messageData.replyingTo !== undefined,
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
			<div class="w-full min-h-16 h-fit flex flex-row gap-4 px-4 py-3 bg-card">
				<FileFieldTrigger class="w-10 h-10 min-w-10 bg-muted flex items-center justify-center rounded-lg cursor-pointer">
					<Icon variant="regular" name="plus-icon" />
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
						/>
					</div>
				</div>
			</div>
		</div>
	);
};
