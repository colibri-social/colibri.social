import { actions } from "astro:actions";
import {
	type Component,
	createMemo,
	createSignal,
	For,
	type ParentComponent,
} from "solid-js";
import type { CommunityInfo } from "@/pages/api/v1/community/[community]";
import type { ChannelData } from "@/utils/sdk";
import { Plus } from "../icons/Plus";
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
	TextField,
	TextFieldDescription,
	TextFieldInput,
	TextFieldLabel,
} from "../shadcn-solid/text-field";
import { Category } from "./Category";

const CategoryCreationModal: ParentComponent<{ community: string }> = (
	props,
) => {
	const [name, setName] = createSignal("");
	const [loading, setLoading] = createSignal(false);
	const [open, setOpen] = createSignal(false);

	const createCategory = async () => {
		setLoading(true);

		const _category = await actions.createCategory({
			community: props.community,
			name: name(),
		});

		setLoading(false);
		setOpen(false);
		// TODO: Handle errors, add new category immediately, don't wait for websocket update
	};

	return (
		<Dialog open={open()} onOpenChange={setOpen}>
			<DialogTrigger>{props.children}</DialogTrigger>
			<DialogPortal>
				<DialogContent class="w-92">
					<DialogHeader>
						<h2 class="m-0 text-center">Create a category</h2>
					</DialogHeader>
					<div>
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
								Channel Name <span class="text-destructive">*</span>
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
					</div>
					<DialogFooter>
						<Button
							variant="secondary"
							disabled={loading()}
							onClick={() => setOpen(false)}
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

export const ChannelList: Component<{
	data: CommunityInfo;
	community: string;
}> = (props) => {
	const processed = createMemo(() => {
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
				category.channels.push(channel);
				continue;
			}

			channelsWithoutCategory.push(channel);
		}

		return { categories, channelsWithoutCategory };
	});

	return (
		<nav class="w-full h-full flex flex-col">
			<For each={processed().channelsWithoutCategory}>
				{(channel) => <div>{channel.name}</div>}
			</For>
			<For each={processed().categories}>
				{(category) => <Category category={category} />}
			</For>
			<CategoryCreationModal community={props.community}>
				<Button size="sm" class="w-[calc(100%-2rem)] mx-4 mt-4" variant="ghost">
					<Plus />
					<span>Add new category</span>
				</Button>
			</CategoryCreationModal>
		</nav>
	);
};
