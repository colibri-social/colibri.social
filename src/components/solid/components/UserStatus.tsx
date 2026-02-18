import type { Component } from "solid-js";

export const UserStatus: Component = () => {
	return (
		<div class="w-full h-16 flex flex-row gap-4 px-4 py-3 bg-neutral-900">
			<div class="w-10 h-10 min-w-10 min-h-10 bg-indigo-500 rounded-full"></div>
			<div class="flex flex-col">
				<span class="font-bold leading-5">Username</span>
				<div class="flex gap-2 items-center">
					<div class="w-2 h-2 min-w-2 min-h-2 bg-green-300 rounded-full"></div>
					<span class="text-sm text-neutral-400">Online</span>
				</div>
			</div>
		</div>
	);
};
