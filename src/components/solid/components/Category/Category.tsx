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
import type { SidebarCategoryData } from "@/utils/sdk";
import { CaretRight } from "../../icons/CaretRight";
import { ChatCircleDots } from "../../icons/ChatCircleDots";
import { Gear } from "../../icons/Gear";
import { PlusSmall } from "../../icons/PlusSmall";
import { Button } from "../../shadcn-solid/Button";
import { CategorySettingsModal } from "./CategorySettingsModal";
import { ChannelCreationModal } from "./ChannelCreationModal";
import { ChannelSettingsModal } from "./ChannelSettingsModal";

/**
 * A single category on the sidebar.
 */
export const Category: ParentComponent<{
	category: SidebarCategoryData;
	community: string;
}> = (props) => {
	const params = useParams();

	const [open, setOpen] = makePersisted(createSignal(true), {
		name: props.category.rkey,
	});

	return (
		<div class="flex flex-col py-4">
			<button
				type="button"
				class="flex flex-row items-center justify-between pb-2 px-4 pl-4.5 text-sm text-muted-foreground group/category hover:text-foreground"
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
				<div class="flex flex-row gap-1 items-center">
					<CategorySettingsModal category={props.category}>
						<Button
							size="sm"
							class="w-5 h-5 cursor-pointer opacity-0 group-hover/category:opacity-100"
							variant="ghost"
						>
							<Gear size={16} />
						</Button>
					</CategorySettingsModal>
					<ChannelCreationModal
						category={props.category.rkey}
						community={props.community}
					>
						<Button size="sm" class="w-5 h-5 cursor-pointer" variant="ghost">
							<PlusSmall />
						</Button>
					</ChannelCreationModal>
				</div>
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
							class="flex flex-row items-center gap-2 justify-between text-muted-foreground hover:bg-card cursor-pointer p-1 pr-1.25 py-0.5 rounded-sm group/channel"
							activeClass="bg-card"
						>
							<div class="flex flex-row items-center gap-2">
								<ChatCircleDots />
								<span>{channel.name}</span>
							</div>
							<ChannelSettingsModal class="w-5 h-5.5 p-0" channel={channel}>
								<Button
									size="sm"
									class="w-5 h-5 cursor-pointer opacity-0 group-hover/channel:opacity-100"
									classList={{
										"opacity-100!": params.channel === channel.rkey,
									}}
									variant="ghost"
									onClick={(e) => e.preventDefault()}
								>
									<Gear size={16} />
								</Button>
							</ChannelSettingsModal>
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
