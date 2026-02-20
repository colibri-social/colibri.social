import { type Component, Match, Show, Switch } from "solid-js";
import type { IndexedMessageData } from "@/utils/sdk";
import type { PendingMessageData } from "../contexts/GlobalContext";

export const Message: Component<{
	data: IndexedMessageData | PendingMessageData;
	isSubsequent: boolean;
}> = ({ data, isSubsequent }) => {
	const isPending = "hash" in data;
	return (
		<div
			class={`w-full h-fit flex flex-row p-4 gap-4 group`}
			classList={{
				"py-0": isSubsequent,
				"pb-0": !isSubsequent,
			}}
		>
			<Switch>
				<Match when={!isSubsequent}>
					<img
						src={data.avatar_url || "/logo.png"}
						alt={data.display_name}
						class="w-10 h-10 min-w-10 min-h-10 bg-muted rounded-full border border-border"
						loading="lazy"
					/>
				</Match>
				<Match when={isSubsequent}>
					<div class="w-10 h-8 min-w-10 min-h-8 text-muted-foreground group-hover:opacity-100 opacity-0 text-xs flex items-center justify-center">
						<span>
							{new Date(
								isPending ? data.createdAt : data.created_at,
							).toLocaleTimeString(undefined, {
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
						<span class="font-bold">{data.display_name}</span>
						<small class="text-muted-foreground">
							{new Date(
								isPending ? data.createdAt : data.created_at,
							).toLocaleDateString()}{" "}
							{new Date(
								isPending ? data.createdAt : data.created_at,
							).toLocaleTimeString(undefined, {
								hour: "2-digit",
								minute: "2-digit",
							})}
						</small>
					</div>
				</Show>
				<p
					class="m-0"
					classList={{
						"text-muted-foreground": isPending,
						"text-foreground": !isPending,
					}}
				>
					{data.text}
				</p>
			</div>
		</div>
	);
};
