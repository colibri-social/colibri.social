import { createSignal, For } from "solid-js";
import {
	expect,
	fireEvent,
	fn,
	screen,
	userEvent,
	waitFor,
	within,
} from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { contrastRatio } from "../../utils/name-color";
import { storyImages } from "../Banner/story-images";
import { ListGroup, SectionLabel, ToggleRow } from "../List/List";
import {
	ROLE_BADGE_ICONS,
	RoleBadge,
	type RoleBadgeValue,
	type RoleIdentity,
} from "./RoleBadge";
import { RoleBadgeSetting } from "./RoleBadgePicker";
import { RoleRow } from "./RoleRow";

const meta = {
	title: "Surfaces/Roles",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const iphone = { viewport: { defaultViewport: "iphone" } };

const moderators: RoleIdentity = {
	id: "mods",
	name: "Moderators",
	color: "#c4a7ff",
	badge: { kind: "icon", name: "shield-check", color: "#76c4e5" },
};

const artists: RoleIdentity = {
	id: "artists",
	name: "Artists",
	color: "#ffd857",
	badge: { kind: "icon", name: "palette" },
};

const founders: RoleIdentity = {
	id: "founders",
	name: "Founders",
	color: "#4ade80",
	badge: { kind: "image", url: storyImages.tealIcon() },
};

const members: RoleIdentity = {
	id: "members",
	name: "Members",
	color: "#ff7a90",
};

const tap = async (element: HTMLElement) => {
	await fireEvent.pointerDown(element, { pointerType: "touch", button: 0 });
	await fireEvent.pointerUp(element, { pointerType: "touch", button: 0 });
	await fireEvent.click(element, { detail: 1 });
};

const glyphBox = (root: ParentNode, selector = "[data-role-badge-glyph]") => {
	const glyph = root.querySelector<HTMLElement>(selector);
	const rect = glyph?.getBoundingClientRect();
	return { glyph, width: Math.round(rect?.width ?? 0) };
};

export const Badges: Story = {
	render: () => (
		<div class="flex flex-col gap-4 p-8 text-foreground">
			<For each={[moderators, artists, founders]}>
				{(role) => (
					<div class="flex items-center gap-3 text-sm font-semibold">
						<RoleBadge role={role} size="sm" />
						<RoleBadge role={role} size="md" />
						<RoleBadge role={role} size="lg" />
						{role.name}
					</div>
				)}
			</For>
			<div
				data-icon-gallery=""
				class="grid w-fit grid-cols-8 gap-3 rounded-control bg-card p-3"
			>
				<For each={ROLE_BADGE_ICONS}>
					{(entry) => (
						<RoleBadge
							role={{
								name: entry.label,
								color: "#c4a7ff",
								badge: { kind: "icon", name: entry.name },
							}}
							size="md"
						/>
					)}
				</For>
			</div>
		</div>
	),
	play: async ({ canvasElement }) => {
		const badges = canvasElement.querySelectorAll("[data-role-badge-glyph]");
		await expect(badges.length).toBe(9 + ROLE_BADGE_ICONS.length);
		const sizes = Array.from(badges)
			.slice(0, 3)
			.map((badge) => Math.round(badge.getBoundingClientRect().width));
		await expect(sizes).toEqual([16, 20, 24]);
		const shield = badges[0] as HTMLElement;
		await expect(getComputedStyle(shield).color).toBe("rgb(118, 196, 229)");
		const gallery = canvasElement.querySelector("[data-icon-gallery]");
		const tinted = gallery?.querySelector<HTMLElement>(
			"[data-role-badge-glyph]",
		);
		await expect(getComputedStyle(tinted as Element).color).toBe(
			"rgb(196, 167, 255)",
		);
		for (const glyph of Array.from(
			gallery?.querySelectorAll("[data-role-badge-glyph] svg") ?? [],
		)) {
			await expect(glyph.getBoundingClientRect().width).toBeGreaterThan(0);
		}
	},
};

export const BadgeHint: Story = {
	render: () => (
		<div class="flex items-center gap-1.5 p-16 text-sm font-semibold text-foreground">
			Lou
			<RoleBadge role={moderators} />
		</div>
	),
	play: async ({ canvasElement, step }) => {
		const badge = within(canvasElement).getByRole("button", {
			name: "Moderators role",
		});

		await step("Hover names the role on desktop", async () => {
			await userEvent.hover(badge);
			const tooltip = await screen.findByRole("tooltip", {}, { timeout: 3000 });
			await expect(tooltip).toHaveTextContent("Moderators");
			await expect(tooltip).toHaveTextContent("Role");
			await userEvent.unhover(badge);
			await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
		});

		await step("A tap opens a popover on touch", async () => {
			await tap(badge);
			const dialog = await screen.findByRole("dialog", { name: "Moderators" });
			await expect(dialog).toHaveTextContent("Role");
			await tap(badge);
			await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		});
	},
};

export const LightTheme: Story = {
	globals: { theme: "light" },
	render: () => (
		<div class="flex items-center gap-2 bg-background p-8 text-sm font-semibold text-foreground">
			<RoleBadge
				role={{
					name: "Sunshine",
					badge: { kind: "icon", name: "star", color: "#ffff00" },
				}}
			/>
			Sunshine
		</div>
	),
	play: async ({ canvasElement }) => {
		await waitFor(() =>
			expect(document.documentElement.dataset.theme).toBe("light"),
		);
		const { glyph } = glyphBox(canvasElement);
		const color = getComputedStyle(glyph as Element).color;
		const [r, g, b] = (color.match(/\d+/g) ?? []).map(Number);
		await expect(r).toBe(g);
		await expect(b).toBe(0);
		await expect(
			contrastRatio(
				`#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`,
				"#e4e4e6",
			),
		).toBeGreaterThanOrEqual(4.5);
	},
};

const RolesScreen = () => {
	const [override, setOverride] = createSignal(false);
	return (
		<div class="flex min-h-dvh flex-col gap-4 bg-popover p-4 text-foreground">
			<ListGroup>
				<ToggleRow
					title="Override user name colors"
					description="Always shows a white color for online users without a role"
					checked={override()}
					onChange={setOverride}
				/>
			</ListGroup>
			<section class="flex flex-col gap-2">
				<SectionLabel label="Roles" count={4} />
				<div class="flex flex-col divide-y divide-border overflow-hidden rounded-control bg-secondary">
					<For each={[moderators, artists, founders, members]}>
						{(role) => <RoleRow role={role} onClick={fn()} />}
					</For>
				</div>
			</section>
		</div>
	);
};

export const SpaceSettingsRoles: Story = {
	parameters: iphone,
	render: () => <RolesScreen />,
	play: async ({ canvasElement }) => {
		const rows = canvasElement.querySelectorAll<HTMLElement>("[data-role-row]");
		await expect(rows.length).toBe(4);
		for (const row of Array.from(rows)) {
			await expect(Math.round(row.getBoundingClientRect().height)).toBe(40);
			const mark = row.firstElementChild as HTMLElement;
			const name = mark.nextElementSibling as HTMLElement;
			await expect(Math.round(mark.getBoundingClientRect().width)).toBe(16);
			await expect(
				Math.round(
					name.getBoundingClientRect().left - row.getBoundingClientRect().left,
				),
			).toBe(36);
		}
		await expect(rows[0].firstElementChild).toHaveAttribute(
			"data-role-badge-glyph",
			"icon",
		);
		await expect(rows[3].querySelector("[data-role-color-dot]")).not.toBeNull();
		await expect(rows[0].querySelectorAll("button").length).toBe(0);
	},
};

const BadgeEditor = (props: {
	platform?: "desktop" | "mobile";
	initial?: RoleBadgeValue;
	upload?: (file: File) => Promise<string>;
}) => {
	const [badge, setBadge] = createSignal<RoleBadgeValue | undefined>(
		props.initial,
	);
	return (
		<div class="flex flex-col gap-4 p-4 text-foreground">
			<div class="overflow-hidden rounded-control bg-secondary">
				<RoleBadgeSetting
					role={{ ...moderators, badge: badge() }}
					value={badge()}
					onChange={setBadge}
					platform={props.platform}
					onUploadImage={props.upload}
				/>
			</div>
			<output data-badge-value="">{JSON.stringify(badge() ?? null)}</output>
		</div>
	);
};

const readValue = (canvasElement: HTMLElement) =>
	JSON.parse(
		canvasElement.querySelector("[data-badge-value]")?.textContent ?? "null",
	);

export const BadgeSettingIcons: Story = {
	render: () => <BadgeEditor initial={moderators.badge} />,
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);
		const row = canvas.getByRole("button", { name: /badge/i });
		await expect(Math.round(row.getBoundingClientRect().height)).toBe(40);
		await expect(row.querySelector("[data-role-badge-glyph]")).not.toBeNull();

		await step("Open the picker and choose an icon", async () => {
			await userEvent.click(row);
			const dialog = await screen.findByRole("dialog", { name: "Role badge" });
			const crown = within(dialog).getByRole("radio", { name: "Crown" });
			await userEvent.click(crown);
			await expect(readValue(canvasElement)).toEqual({
				kind: "icon",
				name: "crown",
				color: "#76c4e5",
			});
			await expect(crown).toBeChecked();
		});

		await step("Arrow keys move through the icons", async () => {
			const dialog = screen.getByRole("dialog", { name: "Role badge" });
			const crown = within(dialog).getByRole("radio", { name: "Crown" });
			crown.focus();
			await userEvent.keyboard("{ArrowRight}");
			await waitFor(() =>
				expect(readValue(canvasElement).name).toBe("crown-star"),
			);
		});

		await step("Pick the role color", async () => {
			const dialog = screen.getByRole("dialog", { name: "Role badge" });
			await userEvent.click(
				within(dialog).getByRole("radio", { name: "Role color" }),
			);
			await expect(readValue(canvasElement)).toEqual({
				kind: "icon",
				name: "crown-star",
			});
			const preview = dialog.querySelector<HTMLElement>(
				"[data-role-badge-preview] [data-role-badge-glyph]",
			);
			await expect(getComputedStyle(preview as Element).color).toBe(
				"rgb(196, 167, 255)",
			);
		});

		await step("Remove the badge", async () => {
			const dialog = screen.getByRole("dialog", { name: "Role badge" });
			await userEvent.click(
				within(dialog).getByRole("button", { name: "Remove badge" }),
			);
			await expect(readValue(canvasElement)).toBeNull();
			await expect(
				within(dialog).queryByRole("button", { name: "Remove badge" }),
			).toBeNull();
			await userEvent.click(
				within(dialog).getByRole("button", { name: "Done" }),
			);
			await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
			await expect(row).toHaveTextContent("None");
		});
	},
};

const failingFile = (name: string, type: string, bytes: number) =>
	new File([new Uint8Array(bytes)], name, { type });

const uploadLocally = async (file: File) => {
	await new Promise((resolve) => setTimeout(resolve, 400));
	return URL.createObjectURL(file);
};

export const BadgeSettingImage: Story = {
	render: () => <BadgeEditor upload={uploadLocally} />,
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: /badge/i }),
		);
		const dialog = await screen.findByRole("dialog", { name: "Role badge" });
		await userEvent.click(within(dialog).getByRole("radio", { name: "Image" }));
		await waitFor(
			() =>
				expect(
					within(dialog).getByRole("button", { name: "Choose image" }),
				).toBeVisible(),
			{ timeout: 3000 },
		);
	},
};

export const BadgeSettingImageFlow: Story = {
	render: () => (
		<BadgeEditor
			upload={async (file) => {
				await new Promise((resolve) => setTimeout(resolve, 50));
				return URL.createObjectURL(file);
			}}
		/>
	),
	play: async ({ canvasElement, step }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: /badge/i }),
		);
		const dialog = await screen.findByRole("dialog", { name: "Role badge" });
		await userEvent.click(within(dialog).getByRole("radio", { name: "Image" }));
		const input = await waitFor(() => {
			const element =
				dialog.querySelector<HTMLInputElement>('input[type="file"]');
			if (!element) throw new Error("no file input");
			return element;
		});

		await step(
			"The upload row shows the limits and a choose button",
			async () => {
				const card = dialog.querySelector<HTMLElement>(
					"[data-badge-image-card]",
				);
				await expect(card).not.toBeNull();
				await expect(card).toHaveTextContent("Choose image");
				await expect(card).toHaveTextContent(
					"PNG, JPEG, WebP or GIF, up to 256 KB. Square works best.",
				);
				await waitFor(() =>
					expect(
						within(dialog).getByRole("button", { name: "Choose image" }),
					).toBeVisible(),
				);
				await expect(
					within(dialog).queryByRole("button", { name: "Remove" }),
				).toBeNull();
			},
		);

		await step("A file that is too large is rejected", async () => {
			await fireEvent.change(input, {
				target: { files: [failingFile("big.png", "image/png", 300 * 1024)] },
			});
			const alert = await within(dialog).findByRole(
				"alert",
				{},
				{ timeout: 3000 },
			);
			await expect(alert).toHaveTextContent(/under 256 KB/i);
			const card = dialog.querySelector<HTMLElement>(
				"[data-badge-image-card]",
			) as HTMLElement;
			const alertBox = alert.getBoundingClientRect();
			const cardBox = card.getBoundingClientRect();
			await expect(alert.offsetWidth).toBe(card.offsetWidth);
			await expect(alertBox.top).toBeGreaterThanOrEqual(cardBox.bottom);
			await expect(
				within(dialog).getByRole("button", { name: "Choose image" }),
			).toHaveAttribute("aria-invalid", "true");
			await expect(readValue(canvasElement)).toBeNull();
		});

		await step("A valid image uploads and becomes the badge", async () => {
			const canvas = document.createElement("canvas");
			canvas.width = 16;
			canvas.height = 16;
			const context = canvas.getContext("2d");
			if (context) {
				context.fillStyle = "#76c4e5";
				context.fillRect(0, 0, 16, 16);
			}
			const blob = await new Promise<Blob>((resolve) =>
				canvas.toBlob((value) => resolve(value as Blob), "image/png"),
			);
			await fireEvent.change(input, {
				target: {
					files: [new File([blob], "badge.png", { type: "image/png" })],
				},
			});
			await waitFor(
				() => expect(readValue(canvasElement)?.kind).toBe("image"),
				{ timeout: 3000 },
			);
			await expect(
				dialog.querySelector(
					'[data-role-badge-preview] [data-role-badge-glyph="image"]',
				),
			).not.toBeNull();
			await expect(within(dialog).queryByRole("alert")).toBeNull();
			await expect(
				within(dialog).getByRole("button", { name: "Replace image" }),
			).toBeVisible();
			await expect(
				within(dialog).getByRole("button", { name: "Remove image" }),
			).toBeVisible();
			const preview = dialog.querySelector<HTMLElement>(
				"[data-badge-image-preview]",
			) as HTMLElement;
			await expect(preview.offsetWidth).toBe(48);
			const cardBox = (
				dialog.querySelector("[data-badge-image-card]") as HTMLElement
			).getBoundingClientRect();
			const previewBox = preview.getBoundingClientRect();
			await expect(previewBox.top - cardBox.top).toBeCloseTo(
				previewBox.left - cardBox.left,
				0,
			);
			await expect(
				dialog.querySelector("[data-badge-image-card] [data-role-badge-glyph]"),
			).toBeNull();
		});

		await step("A wrong format is rejected", async () => {
			await fireEvent.change(input, {
				target: { files: [failingFile("badge.heic", "image/heic", 2000)] },
			});
			await waitFor(
				() =>
					expect(within(dialog).getByRole("alert")).toHaveTextContent(/HEIC/),
				{ timeout: 3000 },
			);
			await expect(readValue(canvasElement)?.kind).toBe("image");
		});

		await step("Dropping an image onto the card uploads it", async () => {
			const card = dialog.querySelector<HTMLElement>(
				"[data-badge-image-card]",
			) as HTMLElement;
			const canvas = document.createElement("canvas");
			canvas.width = 8;
			canvas.height = 8;
			const blob = await new Promise<Blob>((resolve) =>
				canvas.toBlob((value) => resolve(value as Blob), "image/png"),
			);
			const transfer = new DataTransfer();
			transfer.items.add(new File([blob], "drop.png", { type: "image/png" }));
			const drag = (type: string) =>
				card.dispatchEvent(
					new DragEvent(type, {
						dataTransfer: transfer,
						bubbles: true,
						cancelable: true,
					}),
				);
			drag("dragenter");
			await expect(card).toHaveAttribute("data-dragging");
			drag("drop");
			await waitFor(
				() => expect(within(dialog).queryByRole("alert")).toBeNull(),
				{
					timeout: 3000,
				},
			);
			await expect(card).not.toHaveAttribute("data-dragging");
		});

		await step("Remove clears the image badge", async () => {
			const remove = within(dialog).getByRole("button", {
				name: "Remove image",
			});
			await waitFor(() => expect(remove).toBeEnabled(), { timeout: 3000 });
			await userEvent.click(remove);
			await expect(readValue(canvasElement)).toBeNull();
			await expect(
				within(dialog).getByRole("button", { name: "Choose image" }),
			).toBeVisible();
		});
	},
};

export const BadgeSettingMobile: Story = {
	parameters: iphone,
	render: () => (
		<BadgeEditor
			platform="mobile"
			initial={artists.badge}
			upload={uploadLocally}
		/>
	),
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: /badge/i }),
		);
		const dialog = await screen.findByRole("dialog", { name: "Role badge" });
		await expect(
			within(dialog).getByRole("radio", { name: "Icons" }),
		).toBeChecked();
		await expect(
			within(dialog).queryByRole("radio", { name: "Emoji" }),
		).toBeNull();
		await expect(
			within(dialog).getByRole("radio", { name: "Image" }),
		).toBeInTheDocument();
		await userEvent.click(
			within(dialog).getByRole("radio", { name: "Rocket" }),
		);
		await expect(readValue(canvasElement)).toEqual({
			kind: "icon",
			name: "rocket",
		});
	},
};
