import { TransferHorizontalIcon } from "@solar-icons/solid/bold/transfer-horizontal";
import { createSignal, For, type JSX, Show } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import { ListGroup, ToggleRow } from "../List/List";
import { ConfirmDialog } from "../Modal/ConfirmDialog";
import { Select, type SelectPlatform } from "../Select/Select";
import { TextField } from "../TextField/TextField";

const meta = {
	title: "Surfaces/Bridge Setup",
	decorators: [
		(Story) => (
			<div class="min-h-dvh bg-popover p-4 text-foreground">
				<Story />
			</div>
		),
	],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const iphone = { viewport: { defaultViewport: "iphone" } };

const UNLINKED = "unlinked";
const OPEN = "open";
const ADDRESS = "bolt.example.com";

const CODE_OR_ADDRESS_DESCRIPTION =
	"Enter the code the other service gave you, or the address of a bridge, like bolt.example.com.";
const ADDRESS_NOT_FOUND =
	"We couldn't find a bridge at that address. Check the spelling and try again.";
const ALREADY_CONNECTED = "This bridge is already connected to this Space.";
const INSTALL_DESCRIPTION = `${ADDRESS} can read and post only in the channels you pick next. Every member can see which bridges are connected.`;
const INSTALLED_INTRO = `Pick the channels ${ADDRESS} can read and post in. Then set the bridge up from inside those channels, following its own instructions.`;

const HISTORY_DEPTHS = [
	{ value: "none", label: "Don't import" },
	{ value: "day", label: "Last day" },
	{ value: "week", label: "Last 7 days" },
	{ value: "month", label: "Last 30 days" },
	{ value: "all", label: "All history" },
];

type Room = { id: string; label: string };

const channels = [
	{ space: "general", name: "general" },
	{ space: "dev", name: "dev" },
	{ space: "announcements", name: "announcements" },
];

const rooms: Room[] = [
	{ id: "1", label: "general (Text Channels)" },
	{ id: "2", label: "development (Text Channels)" },
	{ id: "3", label: "news (Info)" },
];

const onConfirm = fn();

const CodeOrAddressField = (props: { initial?: string; error?: string }) => {
	const [value, setValue] = createSignal(props.initial ?? "");

	return (
		<form
			class="mx-auto flex w-full max-w-[640px] flex-col gap-4"
			onSubmit={(event) => event.preventDefault()}
		>
			<TextField
				label="Code or Address"
				placeholder="ABCD1234 or bolt.example.com"
				description={CODE_OR_ADDRESS_DESCRIPTION}
				value={value()}
				onChange={setValue}
				error={props.error}
			/>
		</form>
	);
};

const InstallConfirm = () => {
	const [open, setOpen] = createSignal(true);

	return (
		<ConfirmDialog
			open={open()}
			onOpenChange={setOpen}
			title={`Connect ${ADDRESS}?`}
			description={INSTALL_DESCRIPTION}
			confirmLabel="Connect"
			onConfirm={onConfirm}
		/>
	);
};

const ChannelRows = (props: {
	platform: SelectPlatform;
	rooms: readonly Room[];
	initial: Record<string, string>;
}) => {
	const [values, setValues] = createSignal(props.initial);
	const options = () => {
		return [
			{ value: UNLINKED, label: "Not linked" },
			{ value: OPEN, label: "Let the bridge read and reply" },
			...props.rooms.map((room) => ({ value: room.id, label: room.label })),
		];
	};
	const selection = (channel: string) => {
		return values()[channel] ?? UNLINKED;
	};
	const linkedToRoom = (channel: string) => {
		return selection(channel) !== UNLINKED && selection(channel) !== OPEN;
	};

	return (
		<div class="flex flex-col gap-4">
			<For each={channels}>
				{(channel) => (
					<div data-bridge-link="" class="flex min-w-0 flex-col gap-2">
						<Select
							platform={props.platform}
							label={`#${channel.name}`}
							aria-label={`Room linked to ${channel.name}`}
							options={options()}
							value={selection(channel.space)}
							onChange={(value) =>
								setValues((current) => ({
									...current,
									[channel.space]: value,
								}))
							}
						/>
						<Show when={linkedToRoom(channel.space)}>
							<Select
								platform={props.platform}
								aria-label={`Import earlier messages into ${channel.name}`}
								options={HISTORY_DEPTHS}
								value="none"
								onChange={() => undefined}
							/>
						</Show>
					</div>
				)}
			</For>
		</div>
	);
};

const LinksSection = (props: { children: JSX.Element }) => (
	<section aria-labelledby="bridge-links" class="flex flex-col gap-3">
		<h2 id="bridge-links" class="m-0 text-sm font-semibold">
			Linked channels
		</h2>
		{props.children}
	</section>
);

const PairedBridgePage = (props: {
	platform: SelectPlatform;
	initial: Record<string, string>;
}) => (
	<div class="mx-auto flex w-full max-w-[640px] flex-col gap-6">
		<LinksSection>
			<ChannelRows
				platform={props.platform}
				rooms={rooms}
				initial={props.initial}
			/>
		</LinksSection>
	</div>
);

const InstalledBridgePage = (props: { platform: SelectPlatform }) => (
	<div class="mx-auto flex w-full max-w-[640px] flex-col gap-6">
		<div class="flex items-center gap-3">
			<span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground [&>svg]:size-5">
				<TransferHorizontalIcon aria-hidden="true" />
			</span>
			<div class="flex min-w-0 flex-col">
				<span class="truncate font-semibold">{ADDRESS}</span>
				<span class="truncate text-xs text-muted-foreground">
					Connected by address
				</span>
			</div>
		</div>
		<ListGroup>
			<ToggleRow
				title="Relay messages"
				description="Pausing keeps the linked channels, so you can resume later."
				checked
				onChange={() => undefined}
			/>
			<ToggleRow
				title="Mirror moderation"
				description="Hiding a relayed message here also removes it on the other services, and messages their moderators remove are hidden here."
				checked={false}
				onChange={() => undefined}
			/>
		</ListGroup>
		<LinksSection>
			<p class="m-0 text-sm text-muted-foreground">{INSTALLED_INTRO}</p>
			<ChannelRows
				platform={props.platform}
				rooms={[]}
				initial={{ general: OPEN }}
			/>
		</LinksSection>
	</div>
);

const optionNames = async (trigger: HTMLElement) => {
	await userEvent.click(trigger);

	const listbox = await screen.findByRole("listbox");
	const names = within(listbox)
		.getAllByRole("option")
		.map((option) => option.textContent?.trim());

	await userEvent.click(
		within(listbox).getByRole("option", { name: "Not linked" }),
	);
	await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());

	return names;
};

export const CodeOrAddress: Story = {
	name: "Code or address",
	render: () => <CodeOrAddressField />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const field = canvas.getByRole("textbox", { name: "Code or Address" });

		await userEvent.type(field, ADDRESS);
		await expect(field).toHaveValue(ADDRESS);
		await expectNoLayoutIssues(canvasElement);
	},
};

export const CodeOrAddressNotFound: Story = {
	name: "Code or address, not found",
	render: () => (
		<CodeOrAddressField initial="bolt.exmaple.com" error={ADDRESS_NOT_FOUND} />
	),
	play: async ({ canvasElement }) => {
		await expect(
			within(canvasElement).getByText(ADDRESS_NOT_FOUND),
		).toBeVisible();
		await expectNoLayoutIssues(canvasElement);
	},
};

export const CodeOrAddressAlreadyConnected: Story = {
	name: "Code or address, already connected",
	render: () => (
		<CodeOrAddressField initial={ADDRESS} error={ALREADY_CONNECTED} />
	),
	play: async ({ canvasElement }) => {
		await expect(
			within(canvasElement).getByText(ALREADY_CONNECTED),
		).toBeVisible();
	},
};

export const CodeOrAddressMobile: Story = {
	name: "Code or address, mobile",
	parameters: iphone,
	render: () => <CodeOrAddressField initial={ADDRESS} />,
	play: async ({ canvasElement }) => {
		await expectNoLayoutIssues(canvasElement);
	},
};

export const ConfirmByAddress: Story = {
	name: "Confirm by address",
	render: () => <InstallConfirm />,
	play: async () => {
		onConfirm.mockClear();

		const dialog = await screen.findByRole("dialog", {
			name: `Connect ${ADDRESS}?`,
		});

		await waitFor(() =>
			expect(within(dialog).getByText(INSTALL_DESCRIPTION)).toBeVisible(),
		);
		await waitFor(() => expectNoLayoutIssues(dialog), { timeout: 3000 });
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Connect" }),
		);
		await expect(onConfirm).toHaveBeenCalledTimes(1);
	},
};

export const ConfirmByAddressMobile: Story = {
	name: "Confirm by address, mobile",
	parameters: iphone,
	render: () => <InstallConfirm />,
	play: async () => {
		const dialog = await screen.findByRole("dialog", {
			name: `Connect ${ADDRESS}?`,
		});

		await waitFor(() => expectNoLayoutIssues(dialog), { timeout: 3000 });
	},
};

export const PairedBridgeChannels: Story = {
	name: "Paired bridge channels",
	render: () => (
		<PairedBridgePage
			platform="desktop"
			initial={{ general: "1", dev: OPEN }}
		/>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole("button", {
				name: /Import earlier messages into general/,
			}),
		).toBeVisible();
		await expect(
			canvas.queryByRole("button", {
				name: /Import earlier messages into dev/,
			}),
		).not.toBeInTheDocument();
		await expect(
			await optionNames(
				canvas.getByRole("button", { name: /Room linked to announcements/ }),
			),
		).toEqual([
			"Not linked",
			"Let the bridge read and reply",
			"general (Text Channels)",
			"development (Text Channels)",
			"news (Info)",
		]);
		await expectNoLayoutIssues(canvasElement);
	},
};

export const PairedBridgeChannelsMobile: Story = {
	name: "Paired bridge channels, mobile",
	parameters: iphone,
	render: () => <PairedBridgePage platform="mobile" initial={{ dev: OPEN }} />,
	play: async ({ canvasElement }) => {
		await expectNoLayoutIssues(canvasElement);
	},
};

export const InstalledBridge: Story = {
	name: "Bridge added by address",
	render: () => <InstalledBridgePage platform="desktop" />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByText(INSTALLED_INTRO)).toBeVisible();
		await expect(
			canvas.getByRole("button", { name: /Room linked to dev/ }),
		).toHaveTextContent("Not linked");
		await expect(
			await optionNames(
				canvas.getByRole("button", { name: /Room linked to dev/ }),
			),
		).toEqual(["Not linked", "Let the bridge read and reply"]);
		await expect(
			canvas.queryByRole("button", { name: /Import earlier messages/ }),
		).not.toBeInTheDocument();
		await expectNoLayoutIssues(canvasElement);
	},
};

export const InstalledBridgeMobile: Story = {
	name: "Bridge added by address, mobile",
	parameters: iphone,
	render: () => <InstalledBridgePage platform="mobile" />,
	play: async ({ canvasElement }) => {
		await expectNoLayoutIssues(canvasElement);
	},
};
