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
import BugIcon from "~icons/ph/bug";
import ShieldIcon from "~icons/ph/shield";
import WarningDiamondIcon from "~icons/ph/warning-diamond";
import WrenchIcon from "~icons/ph/wrench";
import { colibri } from "../../../atproto/lexicons";
import type { ChannelView } from "../../../atproto/views";
import { clientForManagingApp } from "../../../atproto/xrpc";
import {
	useCommunityContext,
	usePermissions,
} from "../../../contexts/Community";
import { useUserContext } from "../../../contexts/User";
import { showError } from "../../../errors/show-error";
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

const sameSet = (a: ReadonlyArray<string>, b: ReadonlyArray<string>) =>
	a.length === b.length && a.every((x) => b.includes(x));

const GeneralChannelSettings: Component<{ channel: ChannelView }> = (props) => {
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
		const trimmed = name().trim();
		const choice = linkEmbeds();
		const client = clientForManagingApp(
			user.atproto.agent,
			community().community.managingApp,
		);
		const res = await client.call(colibri.channel.update.main, {
			body: {
				channel: props.channel.space,
				name: trimmed !== initialName() ? trimmed : undefined,
				description:
					description() !== initialDesc() ? description() : undefined,
				linkEmbeds: choice === "inherit" ? undefined : choice === "on",
			},
		});
		setLoading(false);
		if (!res.ok) {
			showError(res.error, {
				fallbackTitle: "Failed to save channel settings.",
			});
			return;
		}
		community().utils.patchChannel(props.channel.space, {
			name: trimmed,
			description: description(),
			linkEmbeds: choice === "inherit" ? undefined : choice === "on",
		});
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

const PermissionsPage: Component<{ channel: ChannelView }> = (props) => {
	const user = useUserContext();
	const community = useCommunityContext();
	const { isAdmin: _isAdmin } = usePermissions();

	const isAdmin = () => _isAdmin(user.did);

	const initialOwnerOnly = () => props.channel.ownerOnly || false;
	const initialAllowedRoles = () => props.channel.allowedRoles ?? [];
	const initialAllowedMembers = () => props.channel.allowedMembers ?? [];
	const initialVisibleToRoles = () => props.channel.visibleToRoles ?? [];
	const initialVisibleToMembers = () => props.channel.visibleToMembers ?? [];

	const [loading, setLoading] = createSignal(false);
	const [ownerOnly, setOwnerOnly] = createSignal(initialOwnerOnly());
	const [allowedRoles, setAllowedRoles] = createSignal<string[]>(
		initialAllowedRoles(),
	);
	const [allowedMembers, setAllowedMembers] = createSignal<string[]>(
		initialAllowedMembers(),
	);
	const [visibleToRoles, setVisibleToRoles] = createSignal<string[]>(
		initialVisibleToRoles(),
	);
	const [visibleToMembers, setVisibleToMembers] = createSignal<string[]>(
		initialVisibleToMembers(),
	);

	createEffect(on(initialOwnerOnly, (o) => setOwnerOnly(o), { defer: true }));
	createEffect(
		on(initialAllowedRoles, (r) => setAllowedRoles(r), { defer: true }),
	);
	createEffect(
		on(initialAllowedMembers, (m) => setAllowedMembers(m), { defer: true }),
	);
	createEffect(
		on(initialVisibleToRoles, (r) => setVisibleToRoles(r), { defer: true }),
	);
	createEffect(
		on(initialVisibleToMembers, (m) => setVisibleToMembers(m), {
			defer: true,
		}),
	);

	const handleSave = async () => {
		setLoading(true);
		const roles = allowedRoles();
		const members = allowedMembers();
		const visRoles = visibleToRoles();
		const visMembers = visibleToMembers();
		const client = clientForManagingApp(
			user.atproto.agent,
			community().community.managingApp,
		);
		const res = await client.call(colibri.channel.update.main, {
			body: {
				channel: props.channel.space,
				ownerOnly: ownerOnly() !== initialOwnerOnly() ? ownerOnly() : undefined,
				allowedRoles: sameSet(roles, initialAllowedRoles()) ? undefined : roles,
				allowedMembers: sameSet(members, initialAllowedMembers())
					? undefined
					: members,
				visibleToRoles: sameSet(visRoles, initialVisibleToRoles())
					? undefined
					: visRoles,
				visibleToMembers: sameSet(visMembers, initialVisibleToMembers())
					? undefined
					: visMembers,
			},
		});
		setLoading(false);
		if (!res.ok) {
			showError(res.error, { fallbackTitle: "Failed to save permissions." });
			return;
		}
		community().utils.patchChannel(props.channel.space, {
			ownerOnly: ownerOnly(),
			allowedRoles: roles,
			allowedMembers: members as ChannelView["allowedMembers"],
			visibleToRoles: visRoles,
			visibleToMembers: visMembers as ChannelView["visibleToMembers"],
		});
	};

	const isDirty = () =>
		ownerOnly() !== initialOwnerOnly() ||
		!sameSet(allowedRoles(), initialAllowedRoles()) ||
		!sameSet(allowedMembers(), initialAllowedMembers()) ||
		!sameSet(visibleToRoles(), initialVisibleToRoles()) ||
		!sameSet(visibleToMembers(), initialVisibleToMembers());

	const handleReset = () => {
		setLoading(false);
		setOwnerOnly(initialOwnerOnly());
		setAllowedRoles(initialAllowedRoles());
		setAllowedMembers(initialAllowedMembers());
		setVisibleToRoles(initialVisibleToRoles());
		setVisibleToMembers(initialVisibleToMembers());
	};

	return (
		<SettingsPage
			loading={loading}
			canReset={isDirty()}
			title="Permissions"
			description="Control who can see this channel and who can chat in it. If a user or role is not specified, they are still allowed."
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
				visibleToRoles={visibleToRoles}
				setVisibleToRoles={setVisibleToRoles}
				visibleToMembers={visibleToMembers}
				setVisibleToMembers={setVisibleToMembers}
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
	channel: ChannelView;
}> = (props) => {
	const user = useUserContext();
	const community = useCommunityContext();

	const [loading, setLoading] = createSignal<boolean>(false);
	const [channelNameReset, setChannelNameReset] = createSignal("");

	const isValid = () => channelNameReset() === props.channel.name;

	const deleteChannel = async () => {
		setLoading(true);
		const client = clientForManagingApp(
			user.atproto.agent,
			community().community.managingApp,
		);
		const res = await client.call(colibri.channel.delete.main, {
			body: { channel: props.channel.space },
		});
		setLoading(false);
		if (!res.ok) {
			showError(res.error, { fallbackTitle: "Failed to delete channel." });
			return;
		}
		props.setOpen(false);
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
	channel: ChannelView;
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
				component: () => <SettingsInfoPage uri={props.channel.space} />,
				icon: () => <BugIcon />,
			}}
		/>
	);
};
