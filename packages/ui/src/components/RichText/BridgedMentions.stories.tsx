import { expect } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import type { RichTextResolvers } from "./context";
import { BridgedMentionFacet, MentionFacet } from "./facets";

const meta = {
	title: "Messaging/Bridged mentions",
	parameters: { viewport: { defaultViewport: "iphone" } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const KNOWN: Record<string, string> = {
	"reg 1001": "Robin",
};

const bridged: RichTextResolvers = {
	bridgePlatformName: (platform) => (platform === "chat" ? "Chat" : platform),
	bridgedMember: ({ registration, remoteId }) => {
		const name = KNOWN[`${registration} ${remoteId}`];
		return name ? { did: `${registration} ${remoteId}`, name } : undefined;
	},
	plainUnresolvedMentions: true,
};

const legacy: RichTextResolvers = {
	bridgePlatformName: (platform) => (platform === "chat" ? "Chat" : platform),
};

export const ResolvedAndUnresolved: Story = {
	render: () => (
		<p class="m-0 max-w-sm text-sm leading-6">
			<span data-case="resolved">
				<BridgedMentionFacet
					platform="chat"
					registration="reg"
					remoteId="1001"
					text="<@1001>"
					ctx={bridged}
				/>
			</span>{" "}
			<span data-case="unresolved">
				<BridgedMentionFacet
					platform="chat"
					registration="reg"
					remoteId="2002"
					text="<@2002>"
					ctx={bridged}
				/>
			</span>{" "}
			<span data-case="unknown-did">
				<MentionFacet did="did:plc:nobody" text="@nobody" ctx={bridged} />
			</span>{" "}
			<span data-case="legacy">
				<BridgedMentionFacet platform="chat" text="@Sam" ctx={legacy} />
			</span>{" "}
			<span data-case="legacy-did">
				<MentionFacet did="did:plc:nobody" text="@nobody" ctx={legacy} />
			</span>
		</p>
	),
	play: async ({ canvasElement }) => {
		const at = (name: string) =>
			canvasElement.querySelector<HTMLElement>(
				`[data-case='${name}'] [data-facet-type]`,
			);
		await expect(at("resolved")).toHaveTextContent("@Robin");
		await expect(at("resolved")).toHaveAttribute("data-chip");
		await expect(at("resolved")).toHaveAttribute("title", "On Chat");
		await expect(at("unresolved")).toHaveTextContent("<@2002>");
		await expect(at("unresolved")).not.toHaveAttribute("data-chip");
		await expect(at("unknown-did")).toHaveTextContent("@nobody");
		await expect(at("unknown-did")).not.toHaveAttribute("data-chip");
		await expect(at("legacy")).toHaveAttribute("data-chip");
		await expect(at("legacy")).toHaveTextContent("@Sam");
		await expect(at("legacy-did")).toHaveAttribute(
			"data-mention-kind",
			"unknown",
		);
	},
};
