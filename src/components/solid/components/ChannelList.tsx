import { A, useParams } from "@solidjs/router";
import { type Component, For } from "solid-js";
import type { CommunityInfo } from "@/pages/api/v1/community/[community]";
import type { ChannelData } from "@/utils/sdk";

export const ChannelList: Component<{ data: CommunityInfo }> = (props) => {
	const params = useParams();

	const categories = props.data.categories.map((category) => ({
		...category,
		channels: [] as Array<ChannelData>,
	}));

	const channelsWithoutCategory: Array<ChannelData> = [];

	for (const channel of props.data.channels) {
		const category = categories.find(
			(category) => category.rkey === channel.category,
		);

		if (category) {
			category?.channels.push(channel);
			continue;
		}

		channelsWithoutCategory.push(channel);
	}

	return (
		<nav class="w-full h-full flex flex-col p-4">
			<For each={channelsWithoutCategory}>
				{(channel) => <div>{channel.name}</div>}
			</For>
			<For each={categories}>
				{(category) => (
					<>
						<div>
							{">"} {category.name}
						</div>
						<For each={category.channels}>
							{(channel) => (
								<A
									href={`/c/${params.community}/${channel.rkey}`}
									class="whitespace-pre"
								>
									{"    "}
									{channel.name}
								</A>
							)}
						</For>
					</>
				)}
			</For>
		</nav>
	);
};
