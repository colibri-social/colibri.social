import { createSignal } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import { Button } from "../Button/Button";
import { ListGroup } from "../List/List";
import { EmojiRow } from "../Settings/Settings";
import { CustomEmojiDrawer } from "./CustomEmojiDrawer";
import {
	EMOJI_POPOVER_WIDTH,
	EmojiDrawer,
	EmojiPopover,
	EmojiUploadModal,
} from "./EmojiDrawer";
import { emojiNameFromFile, uniqueEmojiName } from "./emoji-name";

const meta = {
	title: "Surfaces/Emoji packs",
	parameters: { viewport: { defaultViewport: "iphone" } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const glyph = (fill: string, face: string) =>
	`data:image/svg+xml,${encodeURIComponent(
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="${fill}"/><text x="12" y="17" font-size="13" text-anchor="middle" font-family="sans-serif" fill="#111">${face}</text></svg>`,
	)}`;

const parrot = glyph("#9c66ff", "p");
const LONG_NAME = "extremely_long_party_parrot_name";
const LONG_HANDLE = "someone.with.a.really.long.handle.example.social";
const LONG_PACK =
	"Pixelart by Lis and friends from the late night sketching sessions";

const spy = {
	rename: fn(),
	remove: fn(),
	delete: fn(),
	select: fn(),
};

const resetSpies = () => {
	for (const value of Object.values(spy)) value.mockClear();
};

const DrawerDemo = (props: {
	initialView?: "actions" | "rename";
	name?: string;
	fail?: boolean;
}) => {
	const [open, setOpen] = createSignal(false);
	const [name, setName] = createSignal(props.name ?? "party_parrot");
	return (
		<div class="min-h-dvh bg-popover p-4">
			<Button variant="secondary" onClick={() => setOpen(true)}>
				Open emoji
			</Button>
			<EmojiDrawer
				open={open()}
				onOpenChange={setOpen}
				name={name()}
				src={parrot}
				packName={LONG_PACK}
				initialView={props.initialView}
				renameTitle={
					props.initialView === "rename" ? "Name your emoji" : undefined
				}
				renameLabel={
					props.initialView === "rename" ? "Upload emoji" : undefined
				}
				takenNames={new Set(["tux", "opsec", name()])}
				onRename={async (next) => {
					spy.rename(next);
					await new Promise((resolve) => setTimeout(resolve, 80));
					if (props.fail) throw new Error("offline");
					setName(next);
				}}
				onRemoveFromPack={spy.remove}
				onDelete={spy.delete}
			/>
		</div>
	);
};

const openDrawer = async (canvasElement: HTMLElement, label: string) => {
	await userEvent.click(
		within(canvasElement).getByRole("button", { name: "Open emoji" }),
	);
	const dialog = await screen.findByRole("dialog", { name: label });
	await waitFor(() => expect(dialog).toBeVisible());
	await new Promise((resolve) => setTimeout(resolve, 400));
	return dialog;
};

const waitForClosed = () =>
	waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), {
		timeout: 3000,
	});

export const EmojiOptions: Story = {
	render: () => <DrawerDemo name={LONG_NAME} />,
	play: async ({ canvasElement }) => {
		resetSpies();
		const dialog = await openDrawer(canvasElement, `:${LONG_NAME}: options`);
		await expectNoLayoutIssues(dialog);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Remove from pack" }),
		);
		await expect(spy.remove).toHaveBeenCalledTimes(1);
		await waitForClosed();
	},
};

export const RenameInPlace: Story = {
	render: () => <DrawerDemo />,
	play: async ({ canvasElement }) => {
		resetSpies();
		const dialog = await openDrawer(canvasElement, ":party_parrot: options");
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Rename emoji" }),
		);
		const field = await within(dialog).findByRole("textbox", { name: "Name" });
		await new Promise((resolve) => setTimeout(resolve, 300));
		await userEvent.clear(field);
		await userEvent.type(field, "tux");
		await expect(field).toHaveValue("tux");
		await expect(
			await within(dialog).findByText(":tux: is already taken."),
		).toBeVisible();
		await expect(
			within(dialog).getByRole("button", { name: "Save" }),
		).toBeDisabled();
		await userEvent.clear(field);
		await userEvent.type(field, "Dancing Parrot");
		await expectNoLayoutIssues(dialog);
		await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
		await expect(spy.rename).toHaveBeenCalledWith("dancing_parrot");
		await waitForClosed();
	},
};

export const NameNewUpload: Story = {
	render: () => (
		<DrawerDemo
			initialView="rename"
			name={uniqueEmojiName(
				emojiNameFromFile("Party Parrot.gif"),
				new Set(["party_parrot"]),
			)}
		/>
	),
	play: async ({ canvasElement }) => {
		resetSpies();
		const dialog = await openDrawer(canvasElement, "Name your emoji");
		const field = within(dialog).getByRole("textbox", { name: "Name" });
		await expect(field).toHaveValue("party_parrot_2");
		await expect(
			within(dialog).queryByRole("button", { name: "Back to emoji options" }),
		).toBeNull();
		await expectNoLayoutIssues(dialog);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Upload emoji" }),
		);
		await expect(spy.rename).toHaveBeenCalledWith("party_parrot_2");
		await waitForClosed();
	},
};

export const RenameFailure: Story = {
	render: () => <DrawerDemo initialView="rename" fail />,
	play: async ({ canvasElement }) => {
		resetSpies();
		const dialog = await openDrawer(canvasElement, "Name your emoji");
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Upload emoji" }),
		);
		await expect(
			await within(dialog).findByText("Couldn't save the emoji. Try again."),
		).toBeVisible();
		await expect(screen.queryByRole("dialog")).not.toBeNull();
	},
};

const PopoverDemo = () => {
	const [open, setOpen] = createSignal(false);
	const [anchor, setAnchor] = createSignal<HTMLElement>();
	const [name, setName] = createSignal("party_parrot");
	return (
		<div class="min-h-dvh bg-popover p-4">
			<div class="mx-auto flex max-w-xl flex-col gap-4">
				<ListGroup>
					<EmojiRow
						name={name()}
						src={parrot}
						uploader={{ handle: "lou.gg" }}
						onMenu={(event) => {
							setAnchor(event.currentTarget as HTMLElement);
							setOpen(true);
						}}
					/>
				</ListGroup>
			</div>
			<EmojiPopover
				open={open()}
				onOpenChange={setOpen}
				anchor={anchor()}
				name={name()}
				src={parrot}
				packName="Party pack"
				takenNames={new Set(["tux", name()])}
				onRename={async (next) => {
					spy.rename(next);
					await new Promise((resolve) => setTimeout(resolve, 80));
					setName(next);
				}}
				onRemoveFromPack={spy.remove}
				onDelete={spy.delete}
			/>
		</div>
	);
};

const desktopViewport = { viewport: { defaultViewport: "responsive" } };

export const EmojiOptionsPopover: Story = {
	name: "Emoji options popover",
	parameters: desktopViewport,
	render: () => <PopoverDemo />,
	play: async ({ canvasElement }) => {
		resetSpies();
		const trigger = within(canvasElement).getByRole("button", {
			name: "More actions for :party_parrot:",
		});
		await userEvent.click(trigger);
		const popover = await screen.findByRole("dialog", {
			name: ":party_parrot: options",
		});
		await waitFor(() =>
			expect(popover.getBoundingClientRect().width).toBe(EMOJI_POPOVER_WIDTH),
		);
		const rows = Array.from(
			popover.querySelectorAll<HTMLElement>("[data-emoji-popover-row]"),
		);
		await expect(rows.map((row) => row.textContent?.trim())).toEqual([
			"Rename emoji",
			"Remove from pack",
			"Delete emoji",
		]);
		for (const row of rows) {
			await expect(row.getBoundingClientRect().height).toBe(32);
		}
		const box = popover.getBoundingClientRect();
		const anchor = trigger.getBoundingClientRect();
		await expect(Math.abs(box.right - anchor.right)).toBeLessThan(1);
		await expect(box.top).toBeGreaterThanOrEqual(anchor.bottom);
		await expectNoLayoutIssues(popover);
		await userEvent.click(
			within(popover).getByRole("button", { name: "Rename emoji" }),
		);
		const field = await within(popover).findByRole("textbox", {
			name: "Name",
		});
		await userEvent.keyboard("{Escape}");
		await waitFor(() =>
			expect(
				within(popover).getByRole("button", { name: "Rename emoji" }),
			).toBeVisible(),
		);
		await expect(field).not.toBeInTheDocument();
		await userEvent.click(
			within(popover).getByRole("button", { name: "Rename emoji" }),
		);
		const again = await within(popover).findByRole("textbox", { name: "Name" });
		await userEvent.clear(again);
		await userEvent.type(again, "Dancing Parrot");
		await userEvent.click(
			within(popover).getByRole("button", { name: "Save" }),
		);
		await expect(spy.rename).toHaveBeenCalledWith("dancing_parrot");
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		await waitFor(() => expect(document.activeElement).toBe(trigger));
	},
};

const drawerOverlay = () =>
	document.querySelector("[data-corvu-drawer-overlay]") as HTMLElement;

export const RenameDrawerGuardsDraft: Story = {
	render: () => <DrawerDemo />,
	play: async ({ canvasElement }) => {
		resetSpies();
		const dialog = await openDrawer(canvasElement, ":party_parrot: options");
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Rename emoji" }),
		);
		const field = await within(dialog).findByRole("textbox", { name: "Name" });
		await userEvent.clear(field);
		await userEvent.type(field, "sleepy_parrot");
		await userEvent.click(drawerOverlay());
		const prompt = await screen.findByRole("dialog", {
			name: "Discard changes?",
		});
		await expect(prompt).toHaveTextContent("The new name won't be saved.");
		await expectNoLayoutIssues(prompt);
		await userEvent.click(
			within(prompt).getByRole("button", { name: "Cancel" }),
		);
		await waitFor(() =>
			expect(
				screen.queryByRole("dialog", { name: "Discard changes?" }),
			).toBeNull(),
		);
		await expect(field).toHaveValue("sleepy_parrot");
		await userEvent.click(drawerOverlay());
		await userEvent.click(
			within(
				await screen.findByRole("dialog", { name: "Discard changes?" }),
			).getByRole("button", { name: "Discard changes" }),
		);
		await waitForClosed();
		await waitFor(() =>
			expect(document.body.style.pointerEvents).not.toBe("none"),
		);
		await expect(spy.rename).not.toHaveBeenCalled();
	},
};

export const RenamePopoverGuardsDraft: Story = {
	parameters: desktopViewport,
	render: () => <PopoverDemo />,
	play: async ({ canvasElement }) => {
		resetSpies();
		await userEvent.click(
			within(canvasElement).getByRole("button", {
				name: "More actions for :party_parrot:",
			}),
		);
		const popover = await screen.findByRole("dialog", {
			name: ":party_parrot: options",
		});
		await userEvent.click(
			within(popover).getByRole("button", { name: "Rename emoji" }),
		);
		const field = await within(popover).findByRole("textbox", {
			name: "Name",
		});
		await userEvent.clear(field);
		await userEvent.type(field, "sleepy_parrot");
		await userEvent.click(document.body);
		const prompt = await screen.findByRole("dialog", {
			name: "Discard changes?",
		});
		await userEvent.click(
			within(prompt).getByRole("button", { name: "Cancel" }),
		);
		await waitFor(() =>
			expect(
				screen.queryByRole("dialog", { name: "Discard changes?" }),
			).toBeNull(),
		);
		await expect(popover).toBeInTheDocument();
		await expect(field).toHaveValue("sleepy_parrot");
		await userEvent.click(document.body);
		await userEvent.click(
			within(
				await screen.findByRole("dialog", { name: "Discard changes?" }),
			).getByRole("button", { name: "Discard changes" }),
		);
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		await expect(spy.rename).not.toHaveBeenCalled();
	},
};

const UploadDemo = () => {
	const [open, setOpen] = createSignal(false);
	const [src, setSrc] = createSignal<string>();
	return (
		<div class="min-h-dvh bg-popover p-4">
			<Button onClick={() => setOpen(true)}>Upload Emoji</Button>
			<EmojiUploadModal
				open={open()}
				onOpenChange={setOpen}
				src={src()}
				suggestedName={src() ? "party_parrot" : ""}
				takenNames={new Set(["tux"])}
				packName="Party pack"
				imageHint="Square images work best. Bigger ones are scaled down to fit."
				onPickImage={() => setSrc(parrot)}
				onUpload={async (name) => {
					spy.rename(name);
					await new Promise((resolve) => setTimeout(resolve, 80));
				}}
			/>
		</div>
	);
};

export const UploadEmojiModal: Story = {
	name: "Upload emoji modal",
	parameters: desktopViewport,
	render: () => <UploadDemo />,
	play: async ({ canvasElement }) => {
		resetSpies();
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Upload Emoji" }),
		);
		const modal = await screen.findByRole("dialog", { name: "Upload emoji" });
		await waitFor(() => expect(modal).toBeVisible());
		const current = () =>
			modal.querySelector('[aria-current="step"]')?.textContent?.trim();
		await expect(current()).toBe("1. Image");
		const next = () => within(modal).getByRole("button", { name: "Next" });
		await expect(next()).toBeDisabled();
		await expect(
			within(modal).queryByRole("button", { name: "Back" }),
		).toBeNull();
		await userEvent.click(
			within(modal).getByRole("button", { name: "Choose image" }),
		);
		await expect(
			within(modal).getByRole("img", { name: "Emoji preview" }),
		).toBeVisible();
		await expectNoLayoutIssues(modal);
		await userEvent.click(next());
		await expect(current()).toBe("2. Name");
		const field = within(modal).getByRole("textbox", { name: "Name" });
		await expect(field).toHaveValue("party_parrot");
		await userEvent.clear(field);
		await userEvent.type(field, "tux");
		await expect(
			await within(modal).findByText(":tux: is already taken."),
		).toBeVisible();
		await expect(next()).toBeDisabled();
		await userEvent.clear(field);
		await userEvent.type(field, "Dancing Parrot");
		await expectNoLayoutIssues(modal);
		await userEvent.click(next());
		await expect(current()).toBe("3. Review");
		await expect(within(modal).getByText(":dancing_parrot:")).toBeVisible();
		await expect(
			within(modal).getByText("It's added to Party pack."),
		).toBeVisible();
		await expectNoLayoutIssues(modal);
		await userEvent.click(within(modal).getByRole("button", { name: "Back" }));
		await expect(
			within(modal).getByRole("textbox", { name: "Name" }),
		).toHaveValue("Dancing Parrot");
		await userEvent.click(next());
		await userEvent.click(
			within(modal).getByRole("button", { name: "Upload emoji" }),
		);
		await expect(spy.rename).toHaveBeenCalledWith("dancing_parrot");
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
	},
};

export const SelectForPack: Story = {
	render: () => {
		const [selected, setSelected] = createSignal(new Set(["tux"]));
		const toggle = (name: string, next: boolean) => {
			spy.select(name, next);
			setSelected((current) => {
				const copy = new Set(current);
				if (next) copy.add(name);
				else copy.delete(name);
				return copy;
			});
		};
		return (
			<div class="min-h-dvh bg-popover p-4">
				<ListGroup label={LONG_PACK}>
					{["tux", LONG_NAME].map((name) => (
						<EmojiRow
							name={name}
							src={parrot}
							uploader={{ handle: LONG_HANDLE }}
							selectable
							selected={selected().has(name)}
							onSelectedChange={(next) => toggle(name, next)}
						/>
					))}
				</ListGroup>
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		resetSpies();
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole("checkbox", { name: "Include :tux:" }),
		).toBeChecked();
		await userEvent.click(
			canvas.getByRole("checkbox", { name: `Include :${LONG_NAME}:` }),
		);
		await expect(spy.select).toHaveBeenCalledWith(LONG_NAME, true);
		await expect(
			canvas.queryByRole("button", { name: /More actions/ }),
		).toBeNull();
		await expectNoLayoutIssues(canvasElement);
	},
};

const FollowDemo = (props: { fail?: boolean; withPack?: boolean }) => {
	const [open, setOpen] = createSignal(false);
	const [followed, setFollowed] = createSignal(false);
	const [packFollowed, setPackFollowed] = createSignal(false);
	const settle = async () => {
		await new Promise((resolve) => setTimeout(resolve, 80));
		if (props.fail) throw new Error("offline");
	};
	return (
		<div class="min-h-dvh bg-popover p-4">
			<Button variant="secondary" onClick={() => setOpen(true)}>
				Open emoji
			</Button>
			<CustomEmojiDrawer
				open={open()}
				onOpenChange={setOpen}
				name={LONG_NAME}
				src={parrot}
				alt="A parrot dancing"
				source="The Night Owls Art Club and Friends Collective"
				packName={props.withPack === false ? undefined : LONG_PACK}
				followed={followed()}
				packFollowed={packFollowed()}
				onFollowChange={async (next) => {
					spy.select(next);
					await settle();
					setFollowed(next);
				}}
				onPackFollowChange={async (next) => {
					await settle();
					setPackFollowed(next);
				}}
			/>
		</div>
	);
};

export const FollowEmoji: Story = {
	render: () => <FollowDemo />,
	play: async ({ canvasElement }) => {
		resetSpies();
		const dialog = await openDrawer(canvasElement, `:${LONG_NAME}:`);
		await expect(
			dialog.querySelector("[data-custom-emoji-preview]"),
		).toHaveAttribute("alt", "A parrot dancing");
		await expectNoLayoutIssues(dialog);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Follow emoji" }),
		);
		await within(dialog).findByRole("button", { name: "Unfollow emoji" });
		await expect(spy.select).toHaveBeenCalledWith(true);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Follow pack" }),
		);
		await within(dialog).findByRole("button", { name: "Unfollow pack" });
	},
};

export const FollowEmojiWithoutPack: Story = {
	render: () => <FollowDemo withPack={false} fail />,
	play: async ({ canvasElement }) => {
		const dialog = await openDrawer(canvasElement, `:${LONG_NAME}:`);
		await expect(
			within(dialog).queryByRole("button", { name: "Follow pack" }),
		).toBeNull();
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Follow emoji" }),
		);
		await within(dialog).findByRole("alert");
		await expect(
			within(dialog).getByRole("button", { name: "Follow emoji" }),
		).toBeInTheDocument();
		await new Promise((resolve) => setTimeout(resolve, 500));
		await expectNoLayoutIssues(dialog);
	},
};

const DesktopEmojiInfo = () => {
	const [anchor, setAnchor] = createSignal<HTMLElement>();
	const [followed, setFollowed] = createSignal(false);
	return (
		<div class="flex min-h-dvh items-center justify-center bg-card p-4 text-foreground">
			<p class="m-0 text-base">
				Look at this{" "}
				<button
					type="button"
					aria-label={`:${LONG_NAME}:`}
					class="inline-flex size-6 cursor-pointer border-0 bg-transparent p-0 align-middle"
					onClick={(event) => setAnchor(event.currentTarget)}
				>
					<img src={parrot} alt="" class="size-6" />
				</button>
			</p>
			<CustomEmojiDrawer
				platform="desktop"
				open={!!anchor()}
				onOpenChange={(open) => {
					if (!open) setAnchor(undefined);
				}}
				anchorElement={anchor()}
				name={LONG_NAME}
				src={parrot}
				source="The Night Owls Art Club"
				packName={LONG_PACK}
				followed={followed()}
				packFollowed={false}
				onFollowChange={(next) => {
					spy.select(next);
					setFollowed(next);
				}}
				onPackFollowChange={() => {}}
			/>
		</div>
	);
};

export const EmojiInfoDesktop: Story = {
	name: "Emoji info on desktop",
	parameters: { viewport: { defaultViewport: "responsive" } },
	render: () => <DesktopEmojiInfo />,
	play: async ({ canvasElement }) => {
		resetSpies();
		const trigger = within(canvasElement).getByRole("button", {
			name: `:${LONG_NAME}:`,
		});
		await userEvent.click(trigger);
		const popover = await screen.findByRole("dialog", {
			name: `:${LONG_NAME}:`,
		});
		await waitFor(() => expect(popover).toBeVisible());
		await expect(
			popover.querySelector("[data-custom-emoji-drawer]"),
		).toHaveAttribute("data-platform", "desktop");
		await expect(
			document.querySelector("[data-corvu-drawer-content]"),
		).toBeNull();
		const box = popover.getBoundingClientRect();
		const anchorBox = trigger.getBoundingClientRect();
		await expect(box.bottom).toBeLessThanOrEqual(anchorBox.top);
		await expect(
			within(popover).getByText(LONG_PACK, { exact: false }),
		).toBeVisible();
		await expectNoLayoutIssues(popover);
		await userEvent.click(
			within(popover).getByRole("button", { name: "Follow emoji" }),
		);
		await expect(spy.select).toHaveBeenCalledWith(true);
		await expect(
			within(popover).getByRole("button", { name: "Unfollow emoji" }),
		).toBeVisible();
		await userEvent.keyboard("{Escape}");
		await waitFor(() =>
			expect(
				screen.queryByRole("dialog", { name: `:${LONG_NAME}:` }),
			).toBeNull(),
		);
	},
};
