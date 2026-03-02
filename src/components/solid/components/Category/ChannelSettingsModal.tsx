import { createSignal, type Component } from "solid-js";
import {
	TextField,
	TextFieldInput,
	TextFieldLabel,
} from "../../shadcn-solid/text-field";
import { useGlobalContext } from "../../contexts/GlobalContext";
import { Button } from "../../shadcn-solid/Button";
import { Spinner } from "../../icons/Spinner";
import { actions } from "astro:actions";
import { SettingsModal, SettingsPage } from "../SettingsModal";
import type { ParentComponent } from "solid-js";
import { toast } from "somoto";
import type { SidebarChannelData } from "@/utils/sdk";
import { parseZodToErrorOrDisplay } from "@/utils/parse-zod-to-error-or-display";

const GeneralSettingsPage: Component<{ channel: SidebarChannelData }> = (
	props,
) => {
	const [, { addChannel }] = useGlobalContext();

	console.log(props.channel);

	const [loading, setLoading] = createSignal<boolean>(false);
	const [name, setName] = createSignal(props.channel.name);
	const [description, setDescription] = createSignal(
		props.channel.description || "",
	);

	const hasEdited = (): boolean =>
		name() !== props.channel.name ||
		description() !== props.channel.description;

	const editChannelData = async () => {
		setLoading(true);

		const channelData = await actions.editChannel({
			name: name(),
			description: description(),
			rkey: props.channel.rkey,
		});

		if (channelData.error) {
			setLoading(false);
			toast.error("Failed to update channel", {
				description: parseZodToErrorOrDisplay(channelData.error.message),
			});
			return;
		}

		addChannel(channelData.data!);
		setLoading(false);
	};

	const resetChannelData = () => {
		setName(props.channel.name);
		setDescription(props.channel.description);
	};

	return (
		<SettingsPage
			loading={loading}
			canReset={hasEdited()}
			title="General"
			onSave={editChannelData}
			onReset={resetChannelData}
		>
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
				<TextFieldLabel>Channel Name</TextFieldLabel>
				<TextFieldInput maxLength={32} minLength={1} type="text" required />
			</TextField>
			<TextField
				value={description()}
				onChange={setDescription}
				validationState={
					name() !== undefined && name()!.trim().length < 256
						? "valid"
						: "invalid"
				}
			>
				<TextFieldLabel>Channel Description</TextFieldLabel>
				<TextFieldInput maxLength={255} type="text" required />
			</TextField>
		</SettingsPage>
	);
};

const DangerSettingsPage: Component<{ channel: SidebarChannelData }> = (
	props,
) => {
	const [, { removeCategory }] = useGlobalContext();

	const [loading, setLoading] = createSignal<boolean>(false);
	const [categoryNameReset, setCategoryNameReset] = createSignal("");

	const isValid = () => categoryNameReset() === props.channel.name;

	const deleteCategory = async () => {
		setLoading(true);

		const deletedCategory = await actions.deleteCategory({
			rkey: props.channel.rkey,
		});

		setLoading(false);

		if (deletedCategory.error) {
			toast.error("Failed to delete category", {
				description: parseZodToErrorOrDisplay(deletedCategory.error.message),
			});
			return;
		}

		removeCategory(props.channel.rkey);
	};

	return (
		<SettingsPage loading={loading} title="Danger Zone">
			<h3 class="m-0 font-semibold">Delete this category</h3>
			<p class="m-0">
				To delete this category and all associated data, first type in the name
				of the category below. Channels within this category will also be
				deleted. <strong>This action cannot be undone.</strong>
			</p>
			<div class="flex flex-row gap-2 items-baseline-last">
				<TextField
					value={categoryNameReset()}
					onChange={setCategoryNameReset}
					validationState={isValid() ? "valid" : "invalid"}
					disabled={loading()}
				>
					<TextFieldInput
						placeholder={props.channel.name}
						maxLength={32}
						minLength={1}
						type="text"
						required
					/>
				</TextField>
				<Button
					variant="destructive"
					disabled={loading() || !isValid()}
					onClick={deleteCategory}
				>
					<Spinner
						classList={{
							hidden: !loading(),
							block: loading(),
						}}
					/>
					Delete Category
				</Button>
			</div>
		</SettingsPage>
	);
};

export const ChannelSettingsModal: ParentComponent<{
	channel: SidebarChannelData;
	class?: string;
}> = (props) => {
	return (
		<SettingsModal
			class={props.class}
			pages={[
				{
					title: "Channel Details",
					id: "general",
					component: () => <GeneralSettingsPage channel={props.channel} />,
				},
			]}
			dangerPage={{
				title: "Danger Zone",
				id: "danger",
				component: () => <DangerSettingsPage channel={props.channel} />,
			}}
		>
			{props.children}
		</SettingsModal>
	);
};
