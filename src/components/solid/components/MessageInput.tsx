import { actions } from "astro:actions";
import { useParams } from "@solidjs/router";
import type { Component } from "solid-js";
import { createStore } from "solid-js/store";
import { generateHash } from "@/utils/generate-hash";
import { useGlobalContext } from "../contexts/GlobalContext";

// text, community, category, channel
export const MessageInput: Component = () => {
	const params = useParams();
	const [globalData, { addPendingMessage, removePendingMessage }] =
		useGlobalContext();

	const [formData, setFormData] = createStore({
		community: () => params.community!,
		channel: () => params.channel!,
		text: "",
	});

	const sendMessage = async (): Promise<boolean> => {
		const obj = {
			text: formData.text,
			community: formData.community(),
			channel: formData.channel(),
			createdAt: new Date().toISOString(),
		};

		const hash = await generateHash(
			JSON.stringify({
				...obj,
				community: undefined,
			}),
		);

		addPendingMessage({
			channel: obj.channel,
			createdAt: obj.createdAt,
			hash,
			text: obj.text,
			author_did: globalData.user.sub,
			display_name: globalData.user.displayName!,
			avatar_url: globalData.user.avatar!,
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
		<div class="w-full h-16 flex flex-row gap-4 px-4 py-3 bg-neutral-900">
			<button
				class="w-10 h-10 min-w-10 bg-neutral-800 flex items-center justify-center rounded-lg"
				type="button"
			>
				<span class="w-fit block">+</span>
			</button>
			<input
				type="text"
				class="w-full h-10 px-3 border border-neutral-700 rounded-lg outline-0 focus:border-neutral-50"
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
	);
};
