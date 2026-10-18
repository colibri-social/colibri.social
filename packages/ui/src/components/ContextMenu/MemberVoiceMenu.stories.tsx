import { createSignal, mergeProps } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import { Button } from "../Button/Button";
import { MemberDrawer } from "../Members/MemberDrawer";
import { MemberRow } from "../Members/MemberRow";
import { MemberContextMenu, type MemberMenuVoice } from "./MemberMenu";

const meta = {
	title: "Overlays/Member voice menu",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const NAME = "Wren";
const MENU = `${NAME} options`;

const spy = {
	viewProfile: fn(),
	kick: fn(),
	ban: fn(),
	copyDid: fn(),
	copyAtUri: fn(),
	volume: fn(),
	streamVolume: fn(),
	serverMuted: fn(),
	serverDeafened: fn(),
	disconnect: fn(),
	selfMuted: fn(),
	selfDeafened: fn(),
	previewCamera: fn(),
	showNonVideo: fn(),
	showOwnCamera: fn(),
};

const resetSpies = () => {
	for (const value of Object.values(spy)) value.mockClear();
};

type VoiceRole = "peer" | "self" | "observer";

const createVoice = (role: VoiceRole) => {
	const [volume, setVolume] = createSignal(100);
	const [streamVolume, setStreamVolume] = createSignal(60);
	const [serverMuted, setServerMuted] = createSignal(false);
	const [serverDeafened, setServerDeafened] = createSignal(true);
	const [selfMuted, setSelfMuted] = createSignal(false);
	const [selfDeafened, setSelfDeafened] = createSignal(false);
	const [showNonVideo, setShowNonVideo] = createSignal(true);
	const [showOwnCamera, setShowOwnCamera] = createSignal(true);
	const moderation: MemberMenuVoice = {
		get serverMuted() {
			return serverMuted();
		},
		onServerMutedChange: (muted) => {
			spy.serverMuted(muted);
			setServerMuted(muted);
		},
		get serverDeafened() {
			return serverDeafened();
		},
		onServerDeafenedChange: (deafened) => {
			spy.serverDeafened(deafened);
			setServerDeafened(deafened);
		},
		onDisconnect: spy.disconnect,
	};
	if (role === "observer") return moderation;
	if (role === "peer") {
		return mergeProps(moderation, {
			get volume() {
				return volume();
			},
			onVolumeChange: (value: number) => {
				spy.volume(value);
				setVolume(value);
			},
			get streamVolume() {
				return streamVolume();
			},
			onStreamVolumeChange: (value: number) => {
				spy.streamVolume(value);
				setStreamVolume(value);
			},
		} satisfies MemberMenuVoice);
	}
	return {
		get selfMuted() {
			return selfMuted();
		},
		onSelfMutedChange: (muted: boolean) => {
			spy.selfMuted(muted);
			setSelfMuted(muted);
		},
		get selfDeafened() {
			return selfDeafened();
		},
		onSelfDeafenedChange: (deafened: boolean) => {
			spy.selfDeafened(deafened);
			setSelfDeafened(deafened);
		},
		onPreviewCamera: spy.previewCamera,
		get showNonVideoParticipants() {
			return showNonVideo();
		},
		onShowNonVideoParticipantsChange: (show: boolean) => {
			spy.showNonVideo(show);
			setShowNonVideo(show);
		},
		get showOwnCamera() {
			return showOwnCamera();
		},
		onShowOwnCameraChange: (show: boolean) => {
			spy.showOwnCamera(show);
			setShowOwnCamera(show);
		},
	} satisfies MemberMenuVoice;
};

const DesktopDemo = (props: { kind: VoiceRole; moderator?: boolean }) => {
	const voice = createVoice(props.kind);
	return (
		<div class="min-h-screen bg-background p-8">
			<div class="w-60 rounded-surface bg-card p-2">
				<MemberContextMenu
					name={NAME}
					voice={voice}
					onViewProfile={spy.viewProfile}
					onKick={props.moderator ? spy.kick : undefined}
					onBan={props.moderator ? spy.ban : undefined}
					onCopyDid={spy.copyDid}
					developerMode
					onCopyAtUri={spy.copyAtUri}
				>
					<MemberRow name={NAME} seed="did:plc:wren" presence="online" />
				</MemberContextMenu>
			</div>
		</div>
	);
};

const rightClick = (element: Element) => {
	const rect = element.getBoundingClientRect();
	element.dispatchEvent(
		new MouseEvent("contextmenu", {
			bubbles: true,
			cancelable: true,
			button: 2,
			clientX: rect.left + 24,
			clientY: rect.top + 16,
		}),
	);
};

const openMenu = async (canvasElement: HTMLElement) => {
	const row = within(canvasElement)
		.getAllByText(NAME)[0]
		?.closest("[data-member-row]") as Element;
	return waitFor(() => {
		if (!screen.queryByRole("menu", { name: MENU })) rightClick(row);
		return screen.getByRole("menu", { name: MENU });
	});
};

const visibleName = (item: Element) => {
	const copy = item.cloneNode(true) as Element;
	for (const hidden of copy.querySelectorAll("[aria-hidden=true]")) {
		hidden.remove();
	}
	return copy.textContent?.trim();
};

const entryNames = (menu: HTMLElement) =>
	Array.from(
		menu.querySelectorAll(
			'[role="menuitem"], [role="menuitemcheckbox"], [role="slider"]',
		),
	).map((item) =>
		item.getAttribute("role") === "slider"
			? `slider:${item.getAttribute("aria-valuetext")}`
			: visibleName(item),
	);

const closeMenu = async () => {
	await userEvent.keyboard("{Escape}");
	await waitFor(() => expect(screen.queryByRole("menu")).toBeNull(), {
		timeout: 3000,
	});
};

const REGULAR_ENTRIES = ["View profile", "Copy DID", "Developer mode"];

export const PeerInCall: Story = {
	render: () => <DesktopDemo kind="peer" moderator />,
	play: async ({ canvasElement }) => {
		resetSpies();
		const menu = await openMenu(canvasElement);
		await expectNoLayoutIssues(menu);
		await expect(entryNames(menu)).toEqual([
			"slider:100%",
			"slider:60%",
			"Server mute",
			"Server deafen",
			`Disconnect ${NAME} from voice`,
			"View profile",
			`Kick ${NAME}`,
			`Ban ${NAME}`,
			"Copy DID",
			"Developer mode",
		]);
		const volume = within(menu).getByRole("slider", { name: "Volume" });
		volume.focus();
		await userEvent.keyboard("{ArrowRight}{ArrowRight}");
		await waitFor(() => expect(spy.volume).toHaveBeenLastCalledWith(102));
		await expect(screen.getByRole("menu", { name: MENU })).toBe(menu);
		await expect(
			within(menu).getByRole("menuitemcheckbox", { name: "Server deafen" }),
		).toHaveAttribute("aria-checked", "true");
		await userEvent.click(
			within(menu).getByRole("menuitemcheckbox", { name: "Server mute" }),
		);
		await expect(spy.serverMuted).toHaveBeenCalledWith(true);
		await waitFor(() =>
			expect(
				within(menu).getByRole("menuitemcheckbox", { name: "Server mute" }),
			).toHaveAttribute("aria-checked", "true"),
		);
		const disconnect = within(menu).getByRole("menuitem", {
			name: `Disconnect ${NAME} from voice`,
		});
		await expect(disconnect).toHaveAttribute("data-tone", "destructive");
		await userEvent.click(disconnect);
		await expect(spy.disconnect).toHaveBeenCalledTimes(1);
		await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
	},
};

export const SelfInCall: Story = {
	render: () => <DesktopDemo kind="self" />,
	play: async ({ canvasElement }) => {
		resetSpies();
		const menu = await openMenu(canvasElement);
		await expectNoLayoutIssues(menu);
		await expect(entryNames(menu)).toEqual([
			"Mute",
			"Deafen",
			"Preview camera",
			"Show non-video participants",
			"Show own camera",
			...REGULAR_ENTRIES,
		]);
		await expect(within(menu).queryByRole("slider")).toBeNull();
		await userEvent.click(
			within(menu).getByRole("menuitemcheckbox", { name: "Mute" }),
		);
		await expect(spy.selfMuted).toHaveBeenCalledWith(true);
		await userEvent.click(
			within(menu).getByRole("menuitemcheckbox", { name: "Show own camera" }),
		);
		await expect(spy.showOwnCamera).toHaveBeenCalledWith(false);
		await userEvent.click(
			within(menu).getByRole("menuitem", { name: "Preview camera" }),
		);
		await expect(spy.previewCamera).toHaveBeenCalledTimes(1);
		await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
	},
};

export const ModeratorOutsideCall: Story = {
	render: () => <DesktopDemo kind="observer" />,
	play: async ({ canvasElement }) => {
		const menu = await openMenu(canvasElement);
		await expectNoLayoutIssues(menu);
		await expect(entryNames(menu)).toEqual([
			"Server mute",
			"Server deafen",
			`Disconnect ${NAME} from voice`,
			...REGULAR_ENTRIES,
		]);
		await closeMenu();
	},
};

const DrawerDemo = (props: { kind: VoiceRole }) => {
	const [open, setOpen] = createSignal(false);
	const voice = createVoice(props.kind);
	return (
		<div class="min-h-dvh bg-background p-4">
			<Button variant="secondary" onClick={() => setOpen(true)}>
				Hold member
			</Button>
			<MemberDrawer
				open={open()}
				onOpenChange={setOpen}
				name={NAME}
				handle="wren.colibri.social"
				avatarSeed="did:plc:wren"
				voice={voice}
				onViewProfile={spy.viewProfile}
				onKick={spy.kick}
				onBan={spy.ban}
				onCopyDid={spy.copyDid}
			/>
		</div>
	);
};

const openDrawer = async (canvasElement: HTMLElement) => {
	await userEvent.click(
		within(canvasElement).getByRole("button", { name: "Hold member" }),
	);
	const dialog = await screen.findByRole("dialog", { name: MENU });
	await waitFor(() => expect(dialog).toBeVisible());
	await new Promise((resolve) => setTimeout(resolve, 400));
	return dialog;
};

export const DrawerPeerInCall: Story = {
	parameters: { viewport: { defaultViewport: "iphone" } },
	render: () => <DrawerDemo kind="peer" />,
	play: async ({ canvasElement }) => {
		resetSpies();
		const dialog = await openDrawer(canvasElement);
		await expectNoLayoutIssues(dialog);
		const volume = within(dialog).getByRole("slider", { name: "Volume" });
		await expect(volume).toHaveAttribute("aria-valuetext", "100%");
		await expect(
			within(dialog).getByRole("slider", { name: "Stream volume" }),
		).toHaveAttribute("aria-valuetext", "60%");
		volume.focus();
		await userEvent.keyboard("{ArrowLeft}");
		await waitFor(() => expect(spy.volume).toHaveBeenLastCalledWith(99));
		await expect(
			within(dialog).getByRole("switch", { name: "Server deafen" }),
		).toBeChecked();
		await userEvent.click(
			within(dialog).getByRole("switch", { name: "Server mute" }),
		);
		await expect(spy.serverMuted).toHaveBeenCalledWith(true);
		await expect(
			within(dialog).getByRole("button", { name: "View profile" }),
		).toBeVisible();
		await expect(
			within(dialog).getByRole("button", { name: `Kick ${NAME}` }),
		).toBeVisible();
		await userEvent.click(
			within(dialog).getByRole("button", {
				name: `Disconnect ${NAME} from voice`,
			}),
		);
		await expect(spy.disconnect).toHaveBeenCalledTimes(1);
		await waitFor(
			() => expect(screen.queryByRole("dialog", { name: MENU })).toBeNull(),
			{ timeout: 3000 },
		);
	},
};

export const DrawerSelfInCall: Story = {
	parameters: { viewport: { defaultViewport: "iphone" } },
	render: () => <DrawerDemo kind="self" />,
	play: async ({ canvasElement }) => {
		resetSpies();
		const dialog = await openDrawer(canvasElement);
		await expectNoLayoutIssues(dialog);
		await expect(within(dialog).queryByRole("slider")).toBeNull();
		await userEvent.click(
			within(dialog).getByRole("switch", { name: "Deafen" }),
		);
		await expect(spy.selfDeafened).toHaveBeenCalledWith(true);
		await expect(
			within(dialog).getByRole("switch", {
				name: "Show non-video participants",
			}),
		).toBeChecked();
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Preview camera" }),
		);
		await expect(spy.previewCamera).toHaveBeenCalledTimes(1);
	},
};
