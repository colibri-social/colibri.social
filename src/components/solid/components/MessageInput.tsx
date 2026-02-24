import { actions } from "astro:actions";
import { useParams } from "@solidjs/router";
import { type Component, createSignal, Show } from "solid-js";
import { generateHash } from "@/utils/generate-hash";
import { useGlobalContext } from "../contexts/GlobalContext";
import { useMessageContext } from "../contexts/MessageContext";
import { Plus } from "../icons/Plus";
import { XCircle } from "../icons/XCircle";
import { makePersisted } from "@solid-primitives/storage";
import {
	RichTextRenderer,
	trimTextWithFacets,
	type TextWithFacets,
} from "./RichTextRenderer";
import type { PostMessageInput } from "@/actions/message/post";
import stringify from "json-stable-stringify";

const content: TextWithFacets = {
	text: "This is some text content containing @lou.gg mentions, #channel mentions, bold, italic, underlined and strikethrough text, as well as code. It also contains a https://example.com url. 😁",
	facets: [
		{
			$type: "social.colibri.richtext.facet",
			index: { byteStart: 37, byteEnd: 44 },
			features: [
				{
					$type: "social.colibri.richtext.facet#mention",
					did: "did:plc:w64dlsa4zwjv2wljlvmymldc",
				},
			],
		},
		{
			index: { byteStart: 55, byteEnd: 63 },
			features: [
				{ $type: "social.colibri.richtext.facet#channel", channel: "channel" },
			],
		},
		{
			index: { byteStart: 74, byteEnd: 78 },
			features: [{ $type: "social.colibri.richtext.facet#bold" }],
		},
		{
			index: { byteStart: 80, byteEnd: 86 },
			features: [{ $type: "social.colibri.richtext.facet#italic" }],
		},
		{
			index: { byteStart: 88, byteEnd: 98 },
			features: [{ $type: "social.colibri.richtext.facet#underline" }],
		},
		{
			index: { byteStart: 103, byteEnd: 116 },
			features: [{ $type: "social.colibri.richtext.facet#strikethrough" }],
		},
		{
			index: { byteStart: 134, byteEnd: 138 },
			features: [{ $type: "social.colibri.richtext.facet#code" }],
		},
		{
			index: { byteStart: 159, byteEnd: 178 },
			features: [
				{
					$type: "social.colibri.richtext.facet#link",
					uri: "https://example.com",
				},
			],
		},
	],
};

// text, community, category, channel
export const MessageInput: Component = () => {
	const params = useParams();
	const channel = () => params.channel!;

	const [messageData, { clearReplyingTo }] = useMessageContext();
	const [globalData, { addPendingMessage, removePendingMessage }] =
		useGlobalContext();

	let inputEl!: HTMLDivElement;
	const [inputContent, setInputContent] = makePersisted(
		createSignal<TextWithFacets>(content),
		{
			name: `${params.channel}-input`,
		},
	);

	// onMount(() => {
	// 	// 1. Initialize the editor. Render the placeholder, make sure it's editable.
	// 	// 2. Add event listeners for typing. When text is added, place it in a span.
	// 	// 3. On select, show a floating toolbar above. This needs to have buttons for
	// 	//    bold text, italics, strikethrough, underline and code.
	// 	//    There should also be options behind a separator which change the line to be a
	// 	//    heading (h1 - h6).
	// 	// 4. Content is rendered using facets, this needs to be constructed using the atproto
	// 	//    libs. Custom facets are needed for
	// });

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
							// TODO(rich-text): Send message with facets. Implement this in appview, then in actions and then here.
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
