import { actions } from "astro:actions";
import { useParams } from "@solidjs/router";
import { type Component, Show } from "solid-js";
import { createStore } from "solid-js/store";
import { generateHash } from "@/utils/generate-hash";
import { useGlobalContext } from "../contexts/GlobalContext";
import { useMessageContext } from "../contexts/MessageContext";
import { Plus } from "../icons/Plus";
import { XCircle } from "../icons/XCircle";

// const content = {
// 	text: "This is some text content containing @lou.gg mentions, #channel mentions, bold, italic, underlined and strikethrough text, as well as code. It also contains a https://example.com url.",
// 	facets: [
// 		{
// 			$type: "app.bsky.richtext.facet",
// 			index: { byteStart: 37, byteEnd: 44 },
// 			features: [
// 				{
// 					$type: "app.bsky.richtext.facet#mention",
// 					did: "did:plc:w64dlsa4zwjv2wljlvmymldc",
// 				},
// 			],
// 		},
// 		{
// 			index: { byteStart: 55, byteEnd: 63 },
// 			features: [
// 				{ $type: "social.colibri.richtext.facet#channel", channel: "channel" },
// 			],
// 		},
// 		{
// 			index: { byteStart: 159, byteEnd: 178 },
// 			features: [
// 				{ $type: "app.bsky.richtext.facet#link", uri: "https://example.com" },
// 			],
// 		},
// 	],
// };

// text, community, category, channel
export const MessageInput: Component = () => {
	const params = useParams();

	const [messageData, { clearReplyingTo }] = useMessageContext();
	const [globalData, { addPendingMessage, removePendingMessage }] =
		useGlobalContext();

	const [formData, setFormData] = createStore({
		channel: () => params.channel!,
		text: "",
	});

	// let inputEl!: HTMLDivElement;
	// const [inputContent, setInputContent] = makePersisted(createSignal(), {
	// 	name: `${params.channel}-input`,
	// });

	// onMount(() => {
	// 	// 1. Initialize the editor. Place the placeholder, make sure it's editable.
	// 	// 2. Add event listeners for typing. When text is added, place it in a span.
	// 	// 3. On select, show a floating toolbar above. This needs to have buttons for
	// 	//    bold text, italics, strikethrough, underline and code.
	// 	//    There should also be options behind a separator which change the line to be a
	// 	//    heading (h1 - h6).
	// 	// 4. Content is rendered using facets, this needs to be constructed using the atproto
	// 	//    libs. Custom facets are needed for
	// });

	const sendMessage = async (): Promise<boolean> => {
		const obj = {
			text: formData.text,
			channel: formData.channel(),
			createdAt: new Date().toISOString(),
			parent: messageData.replyingTo?.rkey,
		};

		const hash = await generateHash(JSON.stringify(obj));

		addPendingMessage({
			channel: obj.channel,
			createdAt: obj.createdAt,
			hash,
			text: obj.text,
			author_did: globalData.user.sub,
			display_name: globalData.user.displayName!,
			avatar_url: globalData.user.avatar!,
			parent: messageData.replyingTo?.rkey,
			parent_message: messageData.replyingTo || undefined,
			reactions: [],
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
		<div class="w-full flex flex-col gap-0 relative">
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
			<div class="w-full h-16 flex flex-row gap-4 px-4 py-3 bg-card">
				<button
					class="w-10 h-10 min-w-10 bg-muted flex items-center justify-center rounded-lg cursor-pointer"
					type="button"
				>
					<span class="w-fit block">
						<Plus />
					</span>
				</button>
				{/*<div
					ref={inputEl}
					class="w-full min-h-10 px-3 border border-neutral-700 rounded-lg outline-0 focus:border-neutral-50"
				/>*/}
				<input
					type="text"
					class="w-full h-10 px-3 border border-border rounded-lg outline-0 focus:border-foreground"
					placeholder="Write some text..."
					id="text"
					name="text"
					onInput={(e) =>
						setFormData((current) => ({ ...current, text: e.target.value }))
					}
					onKeyDown={(event) => {
						if (event.key === "Enter") {
							sendMessage();
							(event.target as HTMLInputElement).value = "";
						}
					}}
				/>
			</div>
		</div>
	);
};
