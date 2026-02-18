import type { Component } from "solid-js";
import { actions } from "astro:actions";
import { createStore } from "solid-js/store";
import { useParams } from "@solidjs/router";

// text, community, category, channel
export const MessageInput: Component = () => {
	const params = useParams();

	const [formData, setFormData] = createStore({
		community: () => params.community!,
		channel: () => params.channel!,
		text: "",
	});

	const sendMessage = async () => {
		const { error } = await actions.postMessage({
			text: formData.text,
			community: formData.community(),
			channel: formData.channel()
		});

		if (error) {
			return alert(error.message);
		}
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
						(event.target as HTMLInputElement).value = "";
						sendMessage();
					}
				}}
			/>
		</div>
	);
};
