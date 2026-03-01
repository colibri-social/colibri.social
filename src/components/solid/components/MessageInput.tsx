import { actions } from "astro:actions";
import { makePersisted } from "@solid-primitives/storage";
import { useParams } from "@solidjs/router";
import stringify from "json-stable-stringify";
import { type Component, createSignal, Show } from "solid-js";
import type { PostMessageInput } from "@/actions/message/post";
import { generateHash } from "@/utils/generate-hash";
import { useGlobalContext } from "../contexts/GlobalContext";
import { useMessageContext } from "../contexts/MessageContext";
import { Plus } from "../icons/Plus";
import { XCircle } from "../icons/XCircle";
import {
	RichTextRenderer,
	type TextWithFacets,
	trimTextWithFacets,
} from "./RichTextRenderer";

/**
 * The message input used to send messages to the currently viewed channel.
 */
export const MessageInput: Component = () => {
	const params = useParams();
	const channel = () => params.channel!;

	const [messageData, { clearReplyingTo }] = useMessageContext();
	const [globalData, { addPendingMessage, removePendingMessage }] =
		useGlobalContext();

	let inputEl!: HTMLDivElement;
	const [inputContent, setInputContent] = makePersisted(
		createSignal<TextWithFacets>({ text: "", facets: [] }),
		{
			name: `${params.channel}-input`,
		},
	);

	/**
	 * Sends the message currently contained in the input.
	 */
	const sendMessage = async (): Promise<boolean> => {
		const trimmed = trimTextWithFacets(inputContent());

		if (trimmed.text.length === 0) {
			return false;
		}

		const obj: PostMessageInput = {
			text: trimmed.text,
			facets: trimmed.facets,
			channel: channel(),
			createdAt: new Date().toISOString(),
			parent: messageData.replyingTo?.rkey,
		};

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

		if (error) {
			alert(error.message);
			removePendingMessage(hash);
			return false;
		}

		return true;
	};

	return (
		<div class="w-full flex flex-col gap-0 relative h-fit shrink-0">
			<Show when={messageData.replyingTo !== undefined}>
				<div class="absolute top-0 left-0 transform -translate-y-full border-y border-border w-full px-4 py-2 bg-primary/5 text-foreground flex justify-between items-center">
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
			<div class="w-full min-h-16 h-fit flex flex-row gap-4 px-4 py-3 bg-card">
				<button
					class="w-10 h-10 min-w-10 bg-muted flex items-center justify-center rounded-lg cursor-pointer"
					type="button"
				>
					<span class="w-fit block">
						<Plus />
					</span>
				</button>
				<div
					ref={inputEl}
					class="w-full min-h-10 px-3 py-2 border border-neutral-700 rounded-lg outline-0 focus-within:border-neutral-50 h-fit max-h-40 overflow-auto"
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
						editable
					/>
				</div>
			</div>
		</div>
	);
};
