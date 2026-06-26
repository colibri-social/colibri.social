import {
	type Accessor,
	type Component,
	createSignal,
	For,
	type ParentComponent,
	type Setter,
	Show,
} from "solid-js";
import { toast } from "somoto";
import type { Channel } from "../../../atproto/xrpc/social/colibri/community/listChannels";
import { usePermissions } from "../../../contexts/Community";
import { useUserContext } from "../../../contexts/User";
import { Button } from "../../ui/Button";
import { TextField, TextFieldInput, TextFieldLabel } from "../../ui/TextField";
import { SettingsModal, SettingsPage } from "../common/SettingsModal";
import { Spinner } from "../../icons/Spinner";
import BugIcon from "~icons/ph/bug";
import PlusIcon from "~icons/ph/plus";
import ShieldIcon from "~icons/ph/shield";
import WarningDiamondIcon from "~icons/ph/warning-diamond";
import WrenchIcon from "~icons/ph/wrench";
import { SettingsInfoPage } from "../common/SettingsInfoPage";
import {
	Switch,
	SwitchControl,
	SwitchDescription,
	SwitchInput,
	SwitchLabel,
	SwitchThumb,
} from "../../ui/Switch";

const GeneralChannelSettings: Component<{ channel: Channel }> = (props) => {
	const user = useUserContext();

	const initialName = () => props.channel.name;
	const initialDesc = () => props.channel.description || "";

	const [loading, setLoading] = createSignal(false);
	const [name, setName] = createSignal(initialName());
	const [description, setDescription] = createSignal(initialDesc());

	const handleSave = async () => {
		setLoading(true);
		try {
			await user.xrpc.social.colibri.channel.update(
				props.channel.uri,
				name().trim(),
			);
		} catch {
			toast.error("Failed to save channel.");
		} finally {
			setLoading(false);
		}
	};

	const isDirty = () => {
		return name() !== initialName() || description() !== initialDesc();
	};

	const handleReset = () => {
		setLoading(false);
		setName(initialName());
		setDescription(initialDesc());
	};

	return (
		<SettingsPage
			loading={loading}
			canReset={isDirty()}
			title="Channel Settings"
			onSave={handleSave}
			onReset={handleReset}
		>
			<TextField class="gap-1.5">
				<TextFieldLabel>Name</TextFieldLabel>
				<TextFieldInput
					value={name()}
					maxLength={32}
					min={1}
					required
					onInput={(e) => setName(e.currentTarget.value)}
				/>
			</TextField>
			<TextField class="gap-1.5">
				<TextFieldLabel>Description</TextFieldLabel>
				<TextFieldInput
					value={description()}
					maxLength={256}
					onInput={(e) => setDescription(e.currentTarget.value)}
				/>
			</TextField>
		</SettingsPage>
	);
};

const PermissionsPage: Component<{ channel: Channel }> = (props) => {
	const user = useUserContext();
	const { isAdmin: _isAdmin } = usePermissions();

	const isAdmin = () => _isAdmin(user.did);

	const initialOwnerOnly = () => props.channel.ownerOnly || false;

	const [loading, setLoading] = createSignal(false);
	const [ownerOnly, setOwnerOnly] = createSignal(initialOwnerOnly());

	const handleSave = async () => {
		setLoading(true);
		try {
			await user.xrpc.social.colibri.channel.update(
				props.channel.uri,
				undefined,
				{
					ownerOnly: ownerOnly(),
				},
			);
		} catch {
			toast.error("Failed to save channel.");
		} finally {
			setLoading(false);
		}
	};

	const isDirty = () => {
		return false;
	};

	const handleReset = () => {
		setLoading(false);
	};

	return (
		<SettingsPage
			loading={loading}
			canReset={isDirty()}
			title="Permissions"
			description="Permissions control who can write in this channel. If a user or role is not specified here, they will still see the channel."
			onSave={handleSave}
			onReset={handleReset}
		>
			<Show when={isAdmin()}>
				<div class="w-full border border-border rounded-sm flex flex-row p-4">
					<Switch
						onChange={setOwnerOnly}
						checked={ownerOnly()}
						class="flex justify-between items-center gap-x-2 w-full"
					>
						<div>
							<SwitchLabel>Owner-only</SwitchLabel>
							<SwitchDescription>
								Means only you can chat here.
							</SwitchDescription>
						</div>
						<SwitchInput />
						<SwitchControl>
							<SwitchThumb />
						</SwitchControl>
					</Switch>
				</div>
			</Show>
			<div
				classList={{
					"opacity-50 pointer-events-none": ownerOnly(),
				}}
				class="flex flex-col gap-4"
			>
				<div class="flex flex-col gap-2">
					<div class="flex flex-row items-center w-full justify-between">
						<h4 class="m-0 font-semibold">Roles</h4>
						{/* Popover with all roles the user can manage, searchable. Checkbox-system from member context menu. */}
						<div class="flex items-center justify-center w-6 h-6 hover:bg-muted/50 cursor-pointer rounded-sm text-foreground">
							<PlusIcon />
						</div>
					</div>
					<For each={[]}>{(role) => <div>{role}</div>}</For>
				</div>
				<div class="flex flex-col gap-2">
					<div class="flex flex-row items-center w-full justify-between">
						{/* Popover with all users the user can manage, searchable. Checkbox-system from member context menu. */}
						<h4 class="m-0 font-semibold">Members</h4>
						<div class="flex items-center justify-center w-6 h-6 hover:bg-muted/50 cursor-pointer rounded-sm text-foreground">
							<PlusIcon />
						</div>
					</div>
					<For each={[]}>{(member) => <div>{member}</div>}</For>
				</div>
			</div>
		</SettingsPage>
	);
};

const DangerSettingsPage: Component<{
	setOpen: Setter<boolean>;
	channel: Channel;
}> = (props) => {
	const user = useUserContext();

	const [loading, setLoading] = createSignal<boolean>(false);
	const [channelNameReset, setChannelNameReset] = createSignal("");

	const isValid = () => channelNameReset() === props.channel.name;

	const deleteChannel = async () => {
		setLoading(true);
		try {
			await user.xrpc.social.colibri.channel.delete(props.channel.uri);
			props.setOpen(false);
		} catch {
			toast.error("Failed to delete channel.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<SettingsPage loading={loading} title="Danger Zone">
			<h3 class="m-0 font-semibold">Delete this Channel?</h3>
			<p class="m-0">
				To delete this channel, first type in the name of the channel below.{" "}
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
	channel: Channel;
	class?: string;
	open?: Accessor<boolean>;
	setOpen?: Setter<boolean>;
}> = (props) => {
	const user = useUserContext();
	const {
		canDeleteChannel: _canDeleteChannel,
		canUpdateChannel: _canUpdateChannel,
	} = usePermissions();

	const [internalOpen, setInternalOpen] = createSignal(false);

	const open = () => props.open?.() ?? internalOpen();
	const setOpen: Setter<boolean> = (value) =>
		props.setOpen ? props.setOpen(value) : setInternalOpen(value);

	const canManageChannel = () => _canUpdateChannel(user.did);
	const canDeleteChannel = () => _canDeleteChannel(user.did);

	return (
		<SettingsModal
			open={open}
			setOpen={setOpen}
			pages={[
				{
					title: "General",
					id: "general",
					component: () => <GeneralChannelSettings channel={props.channel} />,
					icon: () => <WrenchIcon />,
					visible: canManageChannel,
				},
				{
					title: "Permissions",
					id: "members",
					component: () => <PermissionsPage channel={props.channel} />,
					icon: () => <ShieldIcon />,
				},
			]}
			dangerPage={{
				title: "Danger Zone",
				id: "danger",
				component: () => (
					<DangerSettingsPage setOpen={setOpen} channel={props.channel} />
				),
				icon: () => <WarningDiamondIcon />,
				visible: canDeleteChannel,
			}}
			debugPage={{
				title: "Debug Information",
				id: "info",
				component: () => <SettingsInfoPage uri={props.channel.uri} />,
				icon: () => <BugIcon />,
			}}
		/>
	);
};
