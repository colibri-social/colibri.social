import { actions } from "astro:actions";
import { makePersisted } from "@solid-primitives/storage";
import { useParams } from "@solidjs/router";
import stringify from "json-stable-stringify";
import { type Accessor, type Component, createSignal, Show } from "solid-js";
import { toast } from "somoto";
import type { PostMessageInput } from "@/actions/message/post";
import { generateHash } from "@/utils/generate-hash";
import { parseZodToErrorOrDisplay } from "@/utils/parse-zod-to-error-or-display";
import { useGlobalContext } from "../contexts/GlobalContext";
import { useMessageContext } from "../contexts/MessageContext";
import { Plus } from "../icons/Plus";
import { XCircle } from "../icons/XCircle";
import {
	RichTextRenderer,
	type TextWithFacets,
	trimTextWithFacets,
} from "./RichTextRenderer";
import type { Details } from "@kobalte/core/file-field";
import {
	FileFieldItem,
	FileFieldItemDeleteTrigger,
	FileFieldItemList,
	FileFieldItemName,
	FileFieldItemPreviewImage,
	FileFieldItemSize,
	FileFieldTrigger,
} from "../shadcn-solid/file-field";
import type { BlobObj } from "../contexts/GlobalContext/events";
import type { BlobRef } from "@atproto/lexicon";

const uploadWithProgress = (
	file: File,
	onProgress: (loaded: number, total: number) => void,
): Promise<BlobRef> => {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open("POST", "/api/v1/blob/upload");
		xhr.upload.onprogress = (e) => {
			if (e.lengthComputable) onProgress(e.loaded, e.total);
		};
		xhr.onload = () => resolve(JSON.parse(xhr.responseText));
		xhr.onerror = () => reject(new Error("Upload failed"));
		xhr.send(file);
	});
};

/**
 * The message input used to send messages to the currently viewed channel.
 */
export const MessageInput: Component<{
	files: Accessor<Details | undefined>;
	channelName: string;
	clearFiles: () => void;
}> = (props) => {
	const params = useParams();
	const channel = () => params.channel!;

	const [loading, setLoading] = createSignal(false);
	const [messageData, { clearReplyingTo }] = useMessageContext();
	const [globalData, { addPendingMessage, removePendingMessage }] =
		useGlobalContext();
	const [fileUploadProgress, setFileUploadProgress] = createSignal<
		Array<number>
	>([]);

	let inputEl!: HTMLDivElement;
	const [inputContent, setInputContent] = makePersisted(
		createSignal<TextWithFacets>({ text: "", facets: [] }),
		{
			name: `${params.channel}-input`,
		},
	);

	const uploadFiles = async (files: Array<File>): Promise<Array<BlobObj>> => {
		setFileUploadProgress(files.map(() => 0));
		const promises: Array<Promise<BlobRef>> = [];

		files.forEach((file, index) => {
			promises.push(
				uploadWithProgress(file, (loaded, total) => {
					setFileUploadProgress((current) =>
						current.splice(index, 1, loaded / total),
					);
				}),
			);
		});

		return (await Promise.all(promises)).map(
			(b) => JSON.parse(JSON.stringify(b)) as BlobObj,
		);
	};

	/**
	 * Sends the message currently contained in the input.
	 */
	const sendMessage = async (): Promise<boolean> => {
		if (loading()) return false;

		const trimmed = trimTextWithFacets(inputContent());
		const hasFiles = (props.files()?.acceptedFiles.length ?? 0) > 0;

		if (trimmed.text.length === 0 && !hasFiles) {
			return false;
		}

		setLoading(true);

		const attachments = await uploadFiles(props.files()?.acceptedFiles ?? []);

		const obj: PostMessageInput = {
			text: trimmed.text,
			facets: trimmed.facets,
			channel: channel(),
			createdAt: new Date().toISOString(),
			parent: messageData.replyingTo?.rkey,
			attachments,
		};

		console.log(obj);

		const hash = await generateHash(stringify(obj)!);

		addPendingMessage({
			channel: obj.channel,
			created_at: obj.createdAt,
			hash,
			text: trimmed.text,
			facets: trimmed.facets,
			author_did: globalData.user.sub,
			display_name: globalData.user.displayName!,
			avatar_url: globalData.user.avatar!,
			parent: messageData.replyingTo?.rkey,
			parent_message: messageData.replyingTo || null,
			reactions: [],
		});

		setInputContent({
			text: "",
			facets: [],
		});

		clearReplyingTo();

		const { error } = await actions.postMessage(obj);

		setLoading(false);
		props.clearFiles();

		if (error) {
			toast.error("Failed to send message", {
				description: parseZodToErrorOrDisplay(error.message),
			});
			removePendingMessage(hash);
			return false;
		}

		return true;
	};

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
						<XCircle />
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
							<FileFieldItem class="relative">
								<FileFieldItemPreviewImage />
								<FileFieldItemName />
								<FileFieldItemSize />
								<FileFieldItemDeleteTrigger />
								<div
									class="absolute left-0 bottom-0 h-2 bg-primary"
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
					<Plus />
				</FileFieldTrigger>
				<div
					ref={inputEl}
					class="w-full min-h-10 px-3 py-2 border border-neutral-700 rounded-lg outline-0 focus-within:border-neutral-400 h-fit max-h-40 overflow-auto"
					onKeyDown={(e) => {
						if (e.key === "Enter" && !e.shiftKey) {
							e.preventDefault();
							sendMessage();
						}
					}}
				>
					<RichTextRenderer
						text={inputContent}
						setInputContent={setInputContent}
						editable={!loading()}
						placeholder={`Message ${props.channelName}`}
					/>
				</div>
			</div>
		</div>
	);
};
