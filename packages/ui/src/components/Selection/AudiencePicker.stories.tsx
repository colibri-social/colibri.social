import { createSignal } from "solid-js";
import { expect, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import type { MemberIdentityData } from "../Members/MemberIdentity";
import { AudiencePicker, type AudienceRole } from "./AudiencePicker";

const meta = {
	title: "Primitives/Audience picker",
	parameters: { viewport: { defaultViewport: "iphone" } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const roles: AudienceRole[] = [
	{ id: "mods", name: "Moderators", color: "#4ade80" },
	{
		id: "helpers",
		name: "Helpers who answer questions in the support channels every day",
		color: "#c4a7ff",
	},
	{ id: "owner", name: "Owner", color: "#ffd857" },
];

const members: MemberIdentityData[] = Array.from({ length: 140 }, (_, i) => ({
	id: `did:plc:member${i}`,
	name: i === 0 ? "Kris" : `Member number ${i} with a fairly long display name`,
	handle: i === 0 ? "kris.kralsei.stream" : `member${i}.colibri.social`,
	presence: "online",
}));

const Demo = () => {
	const [selectedRoles, setSelectedRoles] = createSignal<string[]>(["mods"]);
	const [selectedMembers, setSelectedMembers] = createSignal<string[]>([
		"did:plc:member120",
	]);
	return (
		<div class="min-h-dvh bg-popover p-4 text-foreground">
			<AudiencePicker
				roles={roles}
				members={members}
				selectedRoles={selectedRoles()}
				selectedMembers={selectedMembers()}
				onRolesChange={setSelectedRoles}
				onMembersChange={setSelectedMembers}
				canSelectRole={(id) => id !== "owner"}
			/>
			<output data-selected="">
				{[...selectedRoles(), ...selectedMembers()].join(",")}
			</output>
		</div>
	);
};

const rows = (root: HTMLElement) =>
	Array.from(root.querySelectorAll<HTMLElement>("[data-selectable-row]"));

export const RolesAndMembers: Story = {
	render: () => <Demo />,
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);
		await step(
			"Selected members come first and the list is capped",
			async () => {
				const memberRows = Array.from(
					canvasElement.querySelectorAll<HTMLElement>(
						'[data-section="members"] [data-selectable-row]',
					),
				);
				await expect(memberRows.length).toBe(100);
				await expect(memberRows[0]).toHaveTextContent("Member number 120");
				await expect(
					canvas.getByText("Search to find more members."),
				).toBeVisible();
			},
		);
		await step("Roles that can't be picked are disabled", async () => {
			await expect(
				canvas.getByRole("checkbox", { name: "Owner" }),
			).toBeDisabled();
		});
		await step("Search filters both groups", async () => {
			const search = canvas.getByRole("searchbox", {
				name: "Search members and roles",
			});
			await userEvent.type(search, "kris");
			await waitFor(() => expect(rows(canvasElement).length).toBe(1));
			await userEvent.click(canvas.getByRole("checkbox", { name: "Kris" }));
			await expect(
				canvasElement.querySelector("[data-selected]"),
			).toHaveTextContent("did:plc:member0");
			await userEvent.clear(search);
			await userEvent.type(search, "zzz");
			await waitFor(() =>
				expect(
					canvas.getByText('No roles or members match "zzz".'),
				).toBeVisible(),
			);
		});
		await expectNoLayoutIssues(canvasElement);
	},
};
