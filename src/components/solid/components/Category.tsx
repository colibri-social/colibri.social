import { actions } from "astro:actions";
import { makePersisted } from "@solid-primitives/storage";
import { A, useParams } from "@solidjs/router";
import {
	type Accessor,
	type Component,
	createSignal,
	For,
	Match,
	type ParentComponent,
	type Setter,
	Show,
	Switch,
} from "solid-js";
import type { CategoryData, ChannelData, ChannelType } from "@/utils/sdk";
import { CaretRight } from "../icons/CaretRight";
import { ChatCircleDots } from "../icons/ChatCircleDots";
import { Chats } from "../icons/Chats";
import { PlusSmall } from "../icons/PlusSmall";
import { SpeakerLow } from "../icons/SpeakerLow";
import { Spinner } from "../icons/Spinner";
import { Button } from "../shadcn-solid/Button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogPortal,
	DialogTrigger,
} from "../shadcn-solid/Dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "../shadcn-solid/Select";
import {
	TextField,
	TextFieldDescription,
	TextFieldInput,
	TextFieldLabel,
} from "../shadcn-solid/text-field";

const ChannelCreationModal: ParentComponent<{
	category: string;
}> = (props) => {
	const [name, setName] = createSignal("");
	const [channelType, setChannelType] = createSignal<string>("Text");
	const [loading, setLoading] = createSignal(false);
	const [open, setOpen] = createSignal(false);

	const createCategory = async () => {
		setLoading(true);

		await actions.createChannel({
			category: props.category,
			name: name(),
			type: channelType().toLowerCase() as ChannelType,
		});

		setLoading(false);
		setOpen(false);
		// TODO: Handle errors, add new channel immediately, don't wait for websocket update
	};

	const ImageForChannelType: Component<{
		channelType: ChannelType | string;
	}> = (props) => {
		return (
			<Switch>
				<Match when={props.channelType === "text"}>
					<ChatCircleDots />
				</Match>
				<Match when={props.channelType === "voice"}>
					<SpeakerLow />
				</Match>
				<Match when={props.channelType === "forum"}>
					<Chats />
				</Match>
			</Switch>
		);
	};

	return (
		<Dialog open={open()} onOpenChange={setOpen}>
			<DialogTrigger>{props.children}</DialogTrigger>
			<DialogPortal>
				<DialogContent class="w-92">
					<DialogHeader>
						<h2 class="m-0 text-center">Create a channel</h2>
					</DialogHeader>
					<div class="flex flex-col gap-4">
						<TextField
							value={name()}
							onChange={setName}
							validationState={
								name() !== undefined &&
								name()!.trim().length < 33 &&
								name()!.trim().length > 0
									? "valid"
									: "invalid"
							}
						>
							<TextFieldLabel>
								Category Name <span class="text-destructive">*</span>
							</TextFieldLabel>
							<TextFieldInput
								maxLength={32}
								minLength={1}
								type="text"
								required
							/>
							<TextFieldDescription>
								Must be between one and 32 characters long.
							</TextFieldDescription>
						</TextField>
						<Select
							options={["Text", "Voice", "Forum"]}
							placeholder="Channel type"
							value={channelType()}
							onChange={setChannelType}
							itemComponent={(props) => (
								<SelectItem
									item={props.item}
									class="[&>div]:flex [&>div]:gap-2 [&>div]:items-center"
								>
									<ImageForChannelType
										channelType={props.item.rawValue.toLowerCase()}
									/>
									{props.item.rawValue}
								</SelectItem>
							)}
						>
							<SelectLabel>Channel type</SelectLabel>
							<SelectTrigger class="w-full" aria-label="Channel type">
								<SelectValue<string>>
									{(state) => (
										<>
											<ImageForChannelType
												channelType={state.selectedOption().toLowerCase()}
											/>
											{state.selectedOption()}
										</>
									)}
								</SelectValue>
							</SelectTrigger>
							<SelectContent class="[&>ul]:m-0 [&>ul]:py-0 [&>ul]:px-2" />
						</Select>
					</div>
					<DialogFooter>
						<Button
							onClick={() => setOpen(false)}
							variant="secondary"
							disabled={loading()}
						>
							Cancel
						</Button>
						<Button disabled={loading()} onClick={createCategory}>
							<Spinner
								classList={{
									hidden: !loading(),
									block: loading(),
								}}
							/>
							Create
						</Button>
					</DialogFooter>
				</DialogContent>
			</DialogPortal>
		</Dialog>
	);
};

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
