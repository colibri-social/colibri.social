import type { Component } from "solid-js";

export const MessageInput: Component = () => {
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
				class="w-full h-10 pl-3 border border-neutral-700 rounded-lg outline-0 focus:border-neutral-50"
				placeholder="Write some text..."
			/>
		</div>
	);
};
