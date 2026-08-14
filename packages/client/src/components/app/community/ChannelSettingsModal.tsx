import {
	type Accessor,
	type Component,
	createEffect,
	createSignal,
	For,
	on,
	type ParentComponent,
	type Setter,
	Show,
} from "solid-js";
import { toast } from "somoto";
import BugIcon from "~icons/ph/bug";
import ShieldIcon from "~icons/ph/shield";
import WarningDiamondIcon from "~icons/ph/warning-diamond";
import WrenchIcon from "~icons/ph/wrench";
import type { Channel } from "../../../atproto/xrpc/social/colibri/community/listChannels";
import {
	useCommunityContext,
	usePermissions,
} from "../../../contexts/Community";
import { useUserContext } from "../../../contexts/User";
import { Spinner } from "../../icons/Spinner";
import { Button } from "../../ui/Button";
import {
	RadioGroup,
	RadioGroupDescription,
	RadioGroupItem,
	RadioGroupItemInput,
	RadioGroupItemLabel,
	RadioGroupItems,
	RadioGroupLabel,
} from "../../ui/RadioGroup";
import {
	Switch,
	SwitchControl,
	SwitchDescription,
	SwitchInput,
	SwitchLabel,
	SwitchThumb,
} from "../../ui/Switch";
import { TextField, TextFieldInput, TextFieldLabel } from "../../ui/TextField";
import { SettingsInfoPage } from "../common/SettingsInfoPage";
import { SettingsModal, SettingsPage } from "../common/SettingsModal";
import { ChannelAllowListEditor } from "./ChannelAllowListEditor";

type LinkEmbedsChoice = "inherit" | "on" | "off";

const LINK_EMBED_CHOICES: Array<{
	value: LinkEmbedsChoice;
	label: string;
	description: string;
}> = [
	{
		value: "inherit",
		label: "Community default",
		description: "Follow the community setting.",
	},
	{ value: "on", label: "Show", description: "Always show previews here." },
	{ value: "off", label: "Hide", description: "Never show previews here." },
];

const GeneralChannelSettings: Component<{ channel: Channel }> = (props) => {
	const user = useUserContext();
	const community = useCommunityContext();

	const initialName = () => props.channel.name;
	const initialDesc = () => props.channel.description || "";
	const initialLinkEmbeds = (): LinkEmbedsChoice =>
		props.channel.linkEmbeds === undefined
			? "inherit"
			: props.channel.linkEmbeds
				? "on"
				: "off";

	const [loading, setLoading] = createSignal(false);
	const [name, setName] = createSignal(initialName());
	const [description, setDescription] = createSignal(initialDesc());
	const [linkEmbeds, setLinkEmbeds] = createSignal<LinkEmbedsChoice>(
		initialLinkEmbeds(),
	);

	createEffect(on(initialName, (n) => setName(n), { defer: true }));
	createEffect(on(initialDesc, (d) => setDescription(d), { defer: true }));
	createEffect(on(initialLinkEmbeds, (l) => setLinkEmbeds(l), { defer: true }));

	const handleSave = async () => {
		setLoading(true);
		try {
			const trimmed = name().trim();
			const choice = linkEmbeds();
			const res = await user.xrpc.social.colibri.channel.update(
				props.channel.uri,
				trimmed,
				{
					description: description(),
					linkEmbeds: choice === "inherit" ? undefined : choice === "on",
					clearLinkEmbeds: choice === "inherit",
				},
			);
			if (!res) {
				toast.error("Failed to save channel settings.");
				return;
			}
			// Optimistically reflect the save so the form leaves its dirty state
			// immediately; the `channel_event` echo re-applies the same fields.
			community().utils.patchChannel(props.channel.uri, {
				name: trimmed,
				description: description(),
				linkEmbeds: choice === "inherit" ? undefined : choice === "on",
			});
		} catch {
			toast.error("Failed to save channel settings.");
		} finally {
			setLoading(false);
		}
	};

	const isDirty = () => {
		return (
			name() !== initialName() ||
			description() !== initialDesc() ||
			linkEmbeds() !== initialLinkEmbeds()
		);
	};

	const handleReset = () => {
		setLoading(false);
		setName(initialName());
		setDescription(initialDesc());
		setLinkEmbeds(initialLinkEmbeds());
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
			<RadioGroup
				class="w-full gap-1.5"
				value={linkEmbeds()}
				onChange={(v) => setLinkEmbeds(v as LinkEmbedsChoice)}
			>
				<RadioGroupLabel>Link previews</RadioGroupLabel>
				<RadioGroupDescription>
					Whether messages in this channel show a preview card for the links
					they contain.
				</RadioGroupDescription>
				<RadioGroupItems class="w-full flex-col md:flex-row">
					<For each={LINK_EMBED_CHOICES}>
						{(choice) => (
							<RadioGroupItem class="w-full md:flex-1" value={choice.value}>
								<RadioGroupItemInput />
								<RadioGroupItemLabel class="flex w-full flex-col text-center text-pretty rounded-md p-2 border border-border outline-2 outline-transparent gap-1 data-checked:border-primary data-checked:outline-primary/50 data-checked:bg-primary/10">
									<strong>{choice.label}</strong>
									<span class="font-normal text-sm text-muted-foreground">
										{choice.description}
									</span>
								</RadioGroupItemLabel>
							</RadioGroupItem>
						)}
					</For>
				</RadioGroupItems>
			</RadioGroup>
		</SettingsPage>
	);
};

const PermissionsPage: Component<{ channel: Channel }> = (props) => {
	const user = useUserContext();
	const community = useCommunityContext();
	const { isAdmin: _isAdmin } = usePermissions();

	const isAdmin = () => _isAdmin(user.did);

	const initialOwnerOnly = () => props.channel.ownerOnly || false;
	const initialAllowedRoles = () => props.channel.allowedRoles ?? [];
	const initialAllowedMembers = () => props.channel.allowedMembers ?? [];

	const [loading, setLoading] = createSignal(false);
	const [ownerOnly, setOwnerOnly] = createSignal(initialOwnerOnly());
	// Allow-lists are edited in local state and only committed on save, so adding
	// or removing a role/member stages the change rather than hitting the server.
	const [allowedRoles, setAllowedRoles] = createSignal(initialAllowedRoles());
	const [allowedMembers, setAllowedMembers] = createSignal(
		initialAllowedMembers(),
	);

	// Re-sync when the channel record changes underneath us (see the matching
	// note in GeneralChannelSettings).
	createEffect(on(initialOwnerOnly, (o) => setOwnerOnly(o), { defer: true }));
	createEffect(
		on(initialAllowedRoles, (r) => setAllowedRoles(r), { defer: true }),
	);
	createEffect(
		on(initialAllowedMembers, (m) => setAllowedMembers(m), { defer: true }),
	);

	const handleSave = async () => {
		setLoading(true);
		try {
			const roles = allowedRoles();
			const members = allowedMembers();
			const res = await user.xrpc.social.colibri.channel.update(
				props.channel.uri,
				undefined,
				{
					// Only send ownerOnly when it actually changed: the server gates
					// any ownerOnly write behind an admin check, so sending it on an
					// allow-list-only edit would reject the whole save for non-admins.
					ownerOnly:
						ownerOnly() !== initialOwnerOnly() ? ownerOnly() : undefined,
					// An empty array appends no params, which the server reads as "no
					// change"; the explicit clear flags wipe an allow-list instead.
					allowedRoles: roles.length ? roles : undefined,
					clearAllowedRoles: roles.length === 0,
					allowedMembers: members.length ? members : undefined,
					clearAllowedMembers: members.length === 0,
				},
			);
			if (!res) {
				toast.error("Failed to save permissions.");
				return;
			}
			community().utils.patchChannel(props.channel.uri, {
				ownerOnly: ownerOnly(),
				allowedRoles: roles,
				allowedMembers: members,
			});
		} catch {
			toast.error("Failed to save permissions.");
		} finally {
			setLoading(false);
		}
	};

	const sameSet = (a: string[], b: string[]) =>
		a.length === b.length && a.every((x) => b.includes(x));

	const isDirty = () =>
		ownerOnly() !== initialOwnerOnly() ||
		!sameSet(allowedRoles(), initialAllowedRoles()) ||
		!sameSet(allowedMembers(), initialAllowedMembers());

	const handleReset = () => {
		setLoading(false);
		setOwnerOnly(initialOwnerOnly());
		setAllowedRoles(initialAllowedRoles());
		setAllowedMembers(initialAllowedMembers());
	};

	return (
		<SettingsPage
			loading={loading}
			canReset={isDirty()}
			title="Permissions"
			description="Permissions control who can chat in this channel. If a user or role is not specified here, they will still see the channel."
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
			<ChannelAllowListEditor
				allowedRoles={allowedRoles}
				setAllowedRoles={setAllowedRoles}
				allowedMembers={allowedMembers}
				setAllowedMembers={setAllowedMembers}
				disabled={ownerOnly}
			/>
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
			dangerPages={[
				{
					title: "Danger Zone",
					id: "danger",
					component: () => (
						<DangerSettingsPage setOpen={setOpen} channel={props.channel} />
					),
					icon: () => <WarningDiamondIcon />,
					visible: canDeleteChannel,
				},
			]}
			debugPage={{
				title: "Debug Information",
				id: "info",
				component: () => <SettingsInfoPage uri={props.channel.uri} />,
				icon: () => <BugIcon />,
			}}
		/>
	);
};
