import "../../../app.css";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, expect, it, vi } from "vitest";
import { AccessError, type InvitationPreview } from "../../../data/access";
import { DataContext, type DataStore } from "../../../data/store";
import type { CommunityView } from "../../../data/types";
import { InviteEmbed, inviteCodeOf } from "./invite-embed";
import { MessageAttachments } from "./MessageAttachments";

const split = { media: [], audio: [], files: [] };

const community = (overrides: Partial<CommunityView> = {}) =>
	({
		did: "did:plc:flock",
		name: "The Flock",
		description: "Birds and friends.",
		memberCount: 12,
		requiresApprovalToJoin: false,
		viewer: { isMember: false },
		...overrides,
	}) as CommunityView;

const preview = (
	overrides: Partial<CommunityView> = {},
	invitation: Partial<InvitationPreview["invitation"]> = {},
) =>
	({
		invitation: { code: "flock", uses: 0, ...invitation },
		community: community(overrides),
	}) as InvitationPreview;

let stop: (() => void) | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
	stop?.();
	host?.remove();
});

const mount = (
	access: {
		resolveInvitation: (code: string) => Promise<InvitationPreview>;
		join?: (did: string, code?: string) => Promise<{ status: string }>;
	},
	view: () => ReturnType<typeof InviteEmbed>,
) => {
	const [communities, setCommunities] = createSignal<CommunityView[]>([]);
	const store = {
		access: {
			join: async () => ({ status: "joined" }),
			...access,
		},
		communities: { value: communities },
	} as unknown as DataStore;
	host = document.createElement("div");
	document.body.append(host);
	stop = render(
		() => <DataContext.Provider value={store}>{view()}</DataContext.Provider>,
		host,
	);
	return { root: host, setCommunities };
};

const until = async (check: () => boolean) => {
	await vi.waitFor(() => expect(check()).toBe(true), { timeout: 3000 });
};

it("reads invite codes from app links only", () => {
	expect(inviteCodeOf("https://colibri.social/invite/flock")).toBe("flock");
	expect(inviteCodeOf("https://next.colibri.social/invite/flock")).toBe(
		"flock",
	);
	expect(inviteCodeOf("https://example.com/invite/flock")).toBeUndefined();
	expect(inviteCodeOf("https://colibri.social/about")).toBeUndefined();
});

it("joins from the card and opens the Space right away", async () => {
	const join = vi.fn(async () => ({ status: "joined" }));
	const onOpenSpace = vi.fn();
	const { root } = mount(
		{ resolveInvitation: async () => preview(), join },
		() => (
			<InviteEmbed
				url="https://colibri.social/invite/join-1"
				code="join-1"
				onOpenSpace={onOpenSpace}
			/>
		),
	);
	await until(() => !!root.querySelector('[data-invite-state="ready"]'));
	[...root.querySelectorAll("button")]
		.find((entry) => entry.textContent === "Join this Space")
		?.click();
	await until(() => onOpenSpace.mock.calls.length === 1);
	expect(join).toHaveBeenCalledWith("did:plc:flock", "join-1");
	expect(onOpenSpace).toHaveBeenCalledWith(
		expect.objectContaining({ did: "did:plc:flock" }),
	);
});

it("opens the Space when the viewer already joined it elsewhere", async () => {
	const join = vi.fn(async () => {
		throw new AccessError("AlreadyMember");
	});
	const onOpenSpace = vi.fn();
	const { root } = mount(
		{ resolveInvitation: async () => preview(), join },
		() => (
			<InviteEmbed
				url="https://colibri.social/invite/already-1"
				code="already-1"
				onOpenSpace={onOpenSpace}
			/>
		),
	);
	await until(() => !!root.querySelector('[data-invite-state="ready"]'));
	[...root.querySelectorAll("button")]
		.find((entry) => entry.textContent === "Join this Space")
		?.click();
	await until(() => onOpenSpace.mock.calls.length === 1);
	expect(onOpenSpace).toHaveBeenCalledWith(
		expect.objectContaining({ did: "did:plc:flock" }),
	);
});

it("shows an expired invite without the Space", async () => {
	const { root } = mount(
		{
			resolveInvitation: async () =>
				preview({}, { expiresAt: "2020-01-01T00:00:00.000Z" }),
		},
		() => (
			<InviteEmbed url="https://colibri.social/invite/old-1" code="old-1" />
		),
	);
	await until(() => !!root.querySelector('[data-invite-state="expired"]'));
	expect(root.textContent).not.toContain("The Flock");
});

it("treats a missing invite as invalid and a network failure as retryable", async () => {
	const missing = mount(
		{
			resolveInvitation: async () => {
				throw new AccessError("InvitationNotFound");
			},
		},
		() => (
			<InviteEmbed url="https://colibri.social/invite/gone-1" code="gone-1" />
		),
	);
	await until(
		() => !!missing.root.querySelector('[data-invite-state="invalid"]'),
	);
	stop?.();
	host?.remove();

	let calls = 0;
	const { root } = mount(
		{
			resolveInvitation: async () => {
				calls += 1;
				if (calls === 1) throw new TypeError("Failed to fetch");
				return preview();
			},
		},
		() => (
			<InviteEmbed url="https://colibri.social/invite/flaky-1" code="flaky-1" />
		),
	);
	await until(() => !!root.querySelector('[data-invite-state="failed"]'));
	[...root.querySelectorAll("button")]
		.find((entry) => entry.textContent === "Try again")
		?.click();
	await until(() => !!root.querySelector('[data-invite-state="ready"]'));
});

it("shows Open Space when the viewer is already in the Space", async () => {
	const { root, setCommunities } = mount(
		{ resolveInvitation: async () => preview() },
		() => (
			<InviteEmbed
				url="https://colibri.social/invite/member-1"
				code="member-1"
			/>
		),
	);
	await until(() => !!root.querySelector('[data-invite-state="ready"]'));
	setCommunities([community()]);
	await until(() =>
		[...root.querySelectorAll("button")].some(
			(entry) => entry.textContent === "Open Space",
		),
	);
});

it("renders invite links in message attachments", async () => {
	const { root } = mount({ resolveInvitation: async () => preview() }, () => (
		<MessageAttachments
			split={split}
			embeds={[]}
			inviteLinks={[
				{ url: "https://colibri.social/invite/attach-1", code: "attach-1" },
			]}
		/>
	));
	await until(() => !!root.querySelector("[data-invite-card]"));
});
