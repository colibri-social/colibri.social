import { createMemo, createSignal, For, Show } from "solid-js";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { storyImages } from "../Banner/story-images";
import { SectionLabel } from "../List/List";
import type { MemberIdentityData } from "../Members/MemberIdentity";
import type { RoleIdentity } from "../Roles/RoleBadge";
import { matchesMember } from "../Roles/RoleMembers";
import { SearchField } from "../TextField/TextField";
import {
	EmojiSelectRow,
	MemberSelectRow,
	RoleSelectRow,
} from "./SelectionRows";

const meta = {
	title: "Primitives/Selectable rows",
	parameters: { viewport: { defaultViewport: "iphone" } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const roles: RoleIdentity[] = [
	{ id: "mods", name: "Moderators", color: "#4ade80" },
	{
		id: "helpers",
		name: "Helpers",
		color: "#c4a7ff",
		badge: { kind: "icon", name: "shield-check", color: "#76c4e5" },
	},
	{ id: "artists", name: "Artists", color: "#ffd857" },
];

const members: MemberIdentityData[] = [
	{
		id: "did:plc:kris",
		name: "Kris",
		handle: "kris.kralsei.stream",
		presence: "online",
		role: roles[1],
	},
	{
		id: "did:plc:tim",
		name: "Tim",
		handle: "timtinkers.online",
		presence: "idle",
		avatarSrc: storyImages.tealIcon(),
	},
	{
		id: "did:plc:mod",
		name: "Modbot",
		handle: "modbot.colibri.social",
		presence: "online",
		bot: true,
	},
];

const AudiencePicker = () => {
	const [query, setQuery] = createSignal("");
	const [selected, setSelected] = createSignal<string[]>(["mods"]);
	const toggle = (id: string, on: boolean) =>
		setSelected((current) =>
			on
				? [...current.filter((entry) => entry !== id), id]
				: current.filter((entry) => entry !== id),
		);
	const needle = () => query().trim().toLowerCase();
	const visibleRoles = createMemo(() =>
		roles.filter((role) => role.name.toLowerCase().includes(needle())),
	);
	const visibleMembers = createMemo(() =>
		members.filter((member) => matchesMember(member, query())),
	);

	return (
		<div class="flex min-h-dvh flex-col gap-6 bg-popover p-4 text-foreground">
			<SearchField
				aria-label="Search members and roles"
				placeholder="Search members and roles..."
				value={query()}
				onChange={setQuery}
			/>
			<Show when={visibleRoles().length > 0}>
				<section data-section="roles" class="flex flex-col gap-2">
					<SectionLabel label="Roles" />
					<div class="flex flex-col">
						<For each={visibleRoles()}>
							{(role) => (
								<RoleSelectRow
									role={role}
									checked={selected().includes(role.id ?? "")}
									onChange={(on) => toggle(role.id ?? "", on)}
								/>
							)}
						</For>
					</div>
				</section>
			</Show>
			<Show when={visibleMembers().length > 0}>
				<section data-section="members" class="flex flex-col gap-2">
					<SectionLabel label="Members" />
					<div class="flex flex-col">
						<For each={visibleMembers()}>
							{(member) => (
								<MemberSelectRow
									member={member}
									checked={selected().includes(member.id)}
									onChange={(on) => toggle(member.id, on)}
								/>
							)}
						</For>
					</div>
				</section>
			</Show>
			<output data-selected="">{selected().join(",")}</output>
		</div>
	);
};

const rowBox = (row: Element) => row.getBoundingClientRect();

export const RolesAndMembers: Story = {
	render: () => <AudiencePicker />,
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);
		const rows = () =>
			Array.from(
				canvasElement.querySelectorAll<HTMLElement>("[data-selectable-row]"),
			);
		await step("Rows are 56px with the checkbox flush right", async () => {
			await expect(rows().length).toBe(6);
			const section = canvasElement.querySelector(
				'[data-section="roles"]',
			) as HTMLElement;
			for (const row of rows()) {
				await expect(Math.round(rowBox(row).height)).toBe(56);
				const control = row.querySelector(
					"[data-selectable-control]",
				) as HTMLElement;
				await expect(
					Math.round(
						section.getBoundingClientRect().right - rowBox(control).right,
					),
				).toBe(0);
			}
			const firstMark = rows()[0].querySelector(
				"[data-role-color-dot]",
			) as HTMLElement;
			await expect(
				Math.round(
					rowBox(firstMark).left - section.getBoundingClientRect().left,
				),
			).toBe(0);
			await expect(
				rows()[1].querySelector("[data-role-badge-glyph]"),
			).not.toBeNull();
		});
		await step("Clicking the row text toggles the checkbox", async () => {
			await userEvent.click(
				Array.from(
					canvasElement.querySelectorAll<HTMLElement>("[data-member-name]"),
				).find((name) => name.textContent === "Kris") as HTMLElement,
			);
			await expect(
				canvas.getByRole("checkbox", { name: "Kris" }),
			).toBeChecked();
			await userEvent.click(canvas.getByText("Moderators"));
			await expect(
				canvas.getByRole("checkbox", { name: "Moderators" }),
			).not.toBeChecked();
			await expect(
				canvasElement.querySelector("[data-selected]"),
			).toHaveTextContent("did:plc:kris");
		});
		await step("Members show handle and badges", async () => {
			const kris = rows().find((row) => row.textContent?.includes("Kris"));
			await expect(kris).toHaveTextContent("@kris.kralsei.stream");
			await expect(kris?.querySelector("[data-role-badge]")).not.toBeNull();
			const bot = rows().find((row) => row.textContent?.includes("Modbot"));
			await expect(bot).toHaveTextContent("BOT");
		});
		await step("Search filters roles and members together", async () => {
			await userEvent.type(
				canvas.getByRole("searchbox", { name: "Search members and roles" }),
				"mod",
			);
			await waitFor(() => expect(rows().length).toBe(2));
			await expect(rows()[0]).toHaveTextContent("Moderators");
			await expect(rows()[1]).toHaveTextContent("Modbot");
			await userEvent.clear(
				canvas.getByRole("searchbox", { name: "Search members and roles" }),
			);
			await userEvent.type(
				canvas.getByRole("searchbox", { name: "Search members and roles" }),
				"@tim",
			);
			await waitFor(() => expect(rows().length).toBe(1));
			await expect(
				canvasElement.querySelector('[data-section="roles"]'),
			).toBeNull();
		});
	},
};

const onEmojiChange = fn();

export const EmojiPack: Story = {
	render: () => {
		const [picked, setPicked] = createSignal<string[]>(["tux"]);
		const toggle = (name: string, on: boolean) => {
			onEmojiChange(name, on);
			setPicked((current) =>
				on ? [...current, name] : current.filter((entry) => entry !== name),
			);
		};
		return (
			<div class="flex min-h-dvh flex-col gap-2 bg-popover p-4 text-foreground">
				<SectionLabel label="Ungrouped" />
				<div class="flex flex-col divide-y divide-border overflow-hidden rounded-control bg-secondary">
					<EmojiSelectRow
						name="tux"
						src={storyImages.tealIcon()}
						uploader={{
							handle: "timtinkers.online",
							avatar: storyImages.amberIcon(),
						}}
						checked={picked().includes("tux")}
						onChange={(on) => toggle("tux", on)}
					/>
					<EmojiSelectRow
						name="opsec"
						src={storyImages.violetIcon()}
						uploader={{ handle: "kris.kralsei.stream" }}
						checked={picked().includes("opsec")}
						onChange={(on) => toggle("opsec", on)}
					/>
					<EmojiSelectRow
						name="disabled"
						src={storyImages.amberIcon()}
						disabled
					/>
				</div>
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const rows = Array.from(
			canvasElement.querySelectorAll<HTMLElement>("[data-selectable-row]"),
		);
		for (const row of rows) {
			await expect(Math.round(row.getBoundingClientRect().height)).toBe(40);
		}
		const tux = canvas.getByRole("checkbox", { name: ":tux:" });
		await expect(tux).toBeChecked();
		await userEvent.click(canvas.getByText("timtinkers.online"));
		await expect(tux).not.toBeChecked();
		await expect(onEmojiChange).toHaveBeenLastCalledWith("tux", false);
		const control = rows[0].querySelector(
			"[data-selectable-control]",
		) as HTMLElement;
		await expect(
			Math.round(
				rows[0].getBoundingClientRect().right -
					control.getBoundingClientRect().right,
			),
		).toBe(8);
		await userEvent.click(canvas.getByText(":disabled:"));
		await expect(
			canvas.getByRole("checkbox", { name: ":disabled:" }),
		).not.toBeChecked();
	},
};
