import type { CategoryData, ChannelData } from "@/utils/sdk";
import { A, useParams } from "@solidjs/router";
import {
	createSignal,
	For,
	Match,
	Switch,
	type ParentComponent,
} from "solid-js";
import { CaretRight } from "../icons/CaretRight";
import { ChatCircleDots } from "../icons/ChatCircleDots";
import { makePersisted } from "@solid-primitives/storage";

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
				class="flex flex-row items-center gap-2.5 pb-2 px-4 pl-4.5 text-sm text-neutral-400 hover:text-neutral-50 cursor-pointer"
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
							class="flex flex-row items-center gap-2 text-neutral-400 hover:bg-neutral-800 cursor-pointer p-1 py-0.5 rounded-sm"
							activeClass="bg-neutral-800"
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
