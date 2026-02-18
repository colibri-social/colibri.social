import type { MessageData } from "@/utils/sdk";
import type { Component } from "solid-js";

export const Message: Component<{ data: MessageData }> = ({ data }) => {
	return (
		<div class="w-full h-fit flex flex-row p-4 gap-4">
			<div class="w-10 h-10 min-w-10 min-h-10 bg-indigo-500 rounded-full"></div>
			<div class="flex flex-col gap-1 w-full">
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
				<p class="m-0">{data.text}</p>
			</div>
		</div>
	);
};
