import { makePersisted } from "@solid-primitives/storage";
import { A, useParams } from "@solidjs/router";
import {
	createSignal,
	For,
	Match,
	type ParentComponent,
	Switch,
} from "solid-js";
import type { CategoryData, ChannelData } from "@/utils/sdk";
import { CaretRight } from "../icons/CaretRight";
import { ChatCircleDots } from "../icons/ChatCircleDots";

export const Category: ParentComponent<{
	category: CategoryData & { channels: ChannelData[] };
}> = (props) => {
	const params = useParams();

	const [open, setOpen] = makePersisted(createSignal(true), {
		name: props.category.rkey,
	});

	return (
		<div class="flex flex-col py-4">
			<button
				type="button"
				onClick={() => setOpen((current) => !current)}
				class="flex flex-row items-center gap-2.5 pb-2 px-4 pl-4.5 text-sm text-muted-foreground hover:text-foreground cursor-pointer"
			>
				<Switch>
					<Match when={open()}>
						<CaretRight className={"rotate-90"} />
					</Match>
					<Match when={!open()}>
						<CaretRight className={"rotate-0"} />
					</Match>
				</Switch>
				<span>{props.category.name}</span>
			</button>
			<div
				class="flex flex-col gap-1 mx-3"
				classList={{
					hidden: !open(),
				}}
			>
				<For each={props.category.channels}>
					{(channel) => (
						// TODO: This doesn't yet account for different channel types
						<A
							href={`/c/${params.community}/${channel.rkey}`}
							class="flex flex-row items-center gap-2 text-muted-foreground hover:bg-card cursor-pointer p-1 py-0.5 rounded-sm"
							activeClass="bg-card"
						>
							<ChatCircleDots />
							<span>{channel.name}</span>
						</A>
					)}
				</For>
			</div>
		</div>
	);
};
