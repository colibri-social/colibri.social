import { actions } from "astro:actions";
import type { ParentComponent } from "solid-js";
import { type Component, createSignal } from "solid-js";
import { toast } from "somoto";
import { RECORD_IDs } from "@/utils/atproto/lexicons";
import { parseZodToErrorOrDisplay } from "@/utils/parse-zod-to-error-or-display";
import type { SidebarChannelData } from "@/utils/sdk";
import { useGlobalContext } from "../../contexts/GlobalContext";
import { Spinner } from "../../icons/Spinner";
import { Button } from "../../shadcn-solid/Button";
import {
	TextField,
	TextFieldInput,
	TextFieldLabel,
} from "../../shadcn-solid/text-field";
import { SettingsInfoPage } from "../SettingsInfoPage";
import { SettingsModal, SettingsPage } from "../SettingsModal";

const GeneralSettingsPage: Component<{ channel: SidebarChannelData }> = (
	props,
) => {
	const [, { addChannel }] = useGlobalContext();

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
	const [, { removeChannel }] = useGlobalContext();

	const [loading, setLoading] = createSignal<boolean>(false);
	const [channelNameReset, setChannelNameReset] = createSignal("");

	const isValid = () => channelNameReset() === props.channel.name;

	const deleteChannel = async () => {
		setLoading(true);

		const deletedChannel = await actions.deleteChannel({
			rkey: props.channel.rkey,
		});

		setLoading(false);

		if (deletedChannel.error) {
			toast.error("Failed to delete channel", {
				description: parseZodToErrorOrDisplay(deletedChannel.error.message),
			});
			return;
		}

		removeChannel(props.channel.rkey);
	};

	return (
		<SettingsPage loading={loading} title="Danger Zone">
			<h3 class="m-0 font-semibold">Delete this channel</h3>
			<p class="m-0">
				To delete this category and all associated messages and reactions, first
				type in the name of the channel below.{" "}
				<strong>This action cannot be undone.</strong>
			</p>
			<div class="flex flex-row gap-2 items-baseline-last">
				<TextField
					value={channelNameReset()}
					onChange={setChannelNameReset}
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
					onClick={deleteChannel}
				>
					<Spinner
						classList={{
							hidden: !loading(),
							block: loading(),
						}}
					/>
					Delete Channel
				</Button>
			</div>
		</SettingsPage>
	);
};

export const ChannelSettingsModal: ParentComponent<{
	channel: SidebarChannelData;
	class?: string;
}> = (props) => {
	const did = props.channel.uri?.split("/")[2];

	return (
		<SettingsModal
			class={props.class}
			pages={[
				{
					title: "Channel Details",
					id: "general",
					component: () => <GeneralSettingsPage channel={props.channel} />,
					icon: "wrench-icon",
				},
			]}
			dangerPage={{
				title: "Danger Zone",
				id: "danger",
				component: () => <DangerSettingsPage channel={props.channel} />,
				icon: "warning-diamond-icon",
			}}
			debugPage={{
				title: "Debug Information",
				id: "info",
				component: () => (
					<SettingsInfoPage
						did={did}
						collection={RECORD_IDs.CHANNEL}
						rkey={props.channel.rkey}
					/>
				),
				icon: "bug-icon",
			}}
		>
			{props.children}
		</SettingsModal>
	);
};
