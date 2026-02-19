import { Match, Show, Switch, type Component } from "solid-js";
import type { PendingMessageData } from "../contexts/GlobalContext";

export const PendingMessage: Component<{
	data: PendingMessageData;
	isSubsequent: boolean;
}> = ({ data, isSubsequent }) => {
	return (
		<div
			class={`w-full h-fit flex flex-row p-4 gap-4 ${isSubsequent ? "pt-0" : "pb-0"}`}
		>
			<Switch>
				<Match when={!isSubsequent}>
					<div class="w-10 h-10 min-w-10 min-h-10 bg-indigo-500 rounded-full"></div>
				</Match>
				<Match when={isSubsequent}>
					<div class="w-10 h-10 min-w-10 min-h-10 text-neutral-400 group-hover:opacity-100 opacity-0 text-xs flex items-center justify-center">
						<span>
							{new Date(data.createdAt).toLocaleTimeString(undefined, {
								hour: "2-digit",
								minute: "2-digit",
							})}
						</span>
					</div>
				</Match>
			</Switch>
			<div class="flex flex-col gap-1 w-full justify-center">
				<Show when={!isSubsequent}>
					<div class="flex gap-2 text-sm items-baseline">
						<span class="font-bold">Username</span>
						<small class="text-neutral-400">
							{new Date(data.createdAt).toLocaleDateString()}{" "}
							{new Date(data.createdAt).toLocaleTimeString(undefined, {
								hour: "2-digit",
								minute: "2-digit",
							})}
						</small>
					</div>
				</Show>
				<p class="m-0 text-neutral-400">{data.text}</p>
			</div>
		</div>
	);
};
