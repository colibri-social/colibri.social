import { makePersisted } from "@solid-primitives/storage";
import { A, useParams } from "@solidjs/router";
import {
	createSignal,
	For,
	Match,
	type ParentComponent,
	Show,
	Switch,
} from "solid-js";
import type { CategoryData, ChannelData } from "@/utils/sdk";
import { CaretRight } from "../../icons/CaretRight";
import { ChatCircleDots } from "../../icons/ChatCircleDots";
import { PlusSmall } from "../../icons/PlusSmall";
import { Button } from "../../shadcn-solid/Button";
import { ChannelCreationModal } from "./ChannelCreationModal";

/**
 * A single category on the sidebar.
 */
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
				class="flex flex-row items-center justify-between pb-2 px-4 pl-4.5 text-sm text-muted-foreground hover:text-foreground"
			>
				<div
					class="flex flex-row gap-2.5 cursor-pointer items-center"
					onClick={() => setOpen((current) => !current)}
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
				</div>
				<ChannelCreationModal category={props.category.rkey}>
					<Button size="sm" class="w-5 h-5 cursor-pointer" variant="ghost">
						<PlusSmall />
					</Button>
				</ChannelCreationModal>
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
				<Show when={props.category.channels.length === 0}>
					<span class="text-xs text-muted-foreground ml-8">
						This category is empty.
					</span>
				</Show>
			</div>
		</div>
	);
};
