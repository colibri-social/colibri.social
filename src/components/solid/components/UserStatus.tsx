import type { Component } from "solid-js";
import { useGlobalContext } from "../contexts/GlobalContext";

export const UserStatus: Component = () => {
	const [globalState] = useGlobalContext();
	return (
		<div class="w-full h-16 flex flex-row gap-3 px-4 py-3 bg-neutral-900">
			<img
				src={globalState.user.avatar || "/logo.png"}
				alt={globalState.user.displayName}
				class="w-10 h-10 min-w-10 min-h-10 bg-neutral-500 rounded-full border border-neutral-800"
			/>
			<div class="flex flex-col">
				<span class="font-bold leading-5">{globalState.user.displayName}</span>
				<div class="flex gap-2 items-center">
					<div class="w-2 h-2 min-w-2 min-h-2 bg-green-300 rounded-full"></div>
					<span class="text-sm text-neutral-400">Online</span>
				</div>
			</div>
		</div>
	);
};
