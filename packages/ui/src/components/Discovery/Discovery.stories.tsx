import { createSignal } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { Button } from "../Button/Button";
import { DiscoveryModal, DiscoveryScreen } from "./Discovery";
import { discoveryFixtures } from "./discovery-fixtures";
import type { DiscoveryPlatform, DiscoverySpace } from "./discovery-model";

const meta = {
	title: "Surfaces/Discovery",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const onJoin = fn((_id: string) => {});
const onRequestJoin = fn((_id: string) => {});
const onOpenSpace = fn((_id: string) => {});

const reset = () => {
	onJoin.mockClear();
	onRequestJoin.mockClear();
	onOpenSpace.mockClear();
};

const JOIN_SETTLE_MS = 350;

type HarnessOptions = {
	spaces?: DiscoverySpace[];
	selectedId?: string;
	query?: string;
	loading?: boolean;
};

const Harness = (props: { platform: DiscoveryPlatform } & HarnessOptions) => {
	const [spaces, setSpaces] = createSignal(props.spaces ?? discoveryFixtures());
	const [busyIds, setBusyIds] = createSignal<string[]>([]);
	const [open, setOpen] = createSignal(true);

	const settle = (id: string, viewer: DiscoverySpace["viewer"]) =>
		setTimeout(() => {
			setSpaces((current) =>
				current.map((space) =>
					space.id === id ? { ...space, viewer } : space,
				),
			);
			setBusyIds((current) => current.filter((busy) => busy !== id));
		}, JOIN_SETTLE_MS);

	const shared = {
		get spaces() {
			return spaces();
		},
		get busyIds() {
			return busyIds();
		},
		loading: props.loading,
		defaultSelectedId: props.selectedId,
		defaultQuery: props.query,
		onJoin: (id: string) => {
			onJoin(id);
			setBusyIds((current) => [...current, id]);
			settle(id, "member");
		},
		onRequestJoin: (id: string) => {
			onRequestJoin(id);
			setBusyIds((current) => [...current, id]);
			settle(id, "pending");
		},
		onOpenSpace: (id: string) => onOpenSpace(id),
	};

	if (props.platform === "mobile")
		return (
			<div class="fixed inset-0">
				<DiscoveryScreen {...shared} />
			</div>
		);

	return (
		<>
			<Button onClick={() => setOpen(true)}>Discover Spaces</Button>
			<DiscoveryModal {...shared} open={open()} onOpenChange={setOpen} />
		</>
	);
};

const desktop =
	(options: HarnessOptions = {}) =>
	() => <Harness platform="desktop" {...options} />;

const mobile =
	(options: HarnessOptions = {}) =>
	() => <Harness platform="mobile" {...options} />;

const mobileViewport = { viewport: { defaultViewport: "iphone" } };

const discoveryDialog = () =>
	screen.findByRole("dialog", { name: "Discover Spaces" });

const card = (scope: HTMLElement, name: string) =>
	within(scope).getByRole("button", { name: new RegExp(`^${name}`) });

const expectFocused = (element: HTMLElement) =>
	waitFor(() => expect(document.activeElement).toBe(element));

const scrollParent = (element: HTMLElement) => {
	let node = element.parentElement;
	while (node) {
		const overflow = getComputedStyle(node).overflowY;
		if (overflow === "auto" || overflow === "scroll") return node;
		node = node.parentElement;
	}
	return document.documentElement;
};

const expectAlignedGrid = async (grid: HTMLElement) => {
	const cards = Array.from(
		grid.querySelectorAll<HTMLElement>("[data-space-id] > button"),
	);
	await expect(cards.length).toBeGreaterThan(1);
	const rows = new Map<number, DOMRect[]>();
	for (const element of cards) {
		const rect = element.getBoundingClientRect();
		const key = Math.round(rect.top);
		rows.set(key, [...(rows.get(key) ?? []), rect]);
	}
	await expect(rows.size).toBeLessThan(cards.length);
	for (const rects of rows.values()) {
		const [first] = rects;
		for (const rect of rects) {
			await expect(Math.abs(rect.top - first.top)).toBeLessThan(1);
			await expect(Math.abs(rect.height - first.height)).toBeLessThan(1);
		}
	}
	for (const element of cards) {
		const banner = element.querySelector("[data-banner]") as HTMLElement;
		await expect(
			Math.abs(
				banner.getBoundingClientRect().top -
					element.getBoundingClientRect().top,
			),
		).toBeLessThan(2);
	}
	const container = scrollParent(grid);
	const bounds = container.getBoundingClientRect();
	await expect(container.scrollWidth).toBeLessThanOrEqual(
		container.clientWidth,
	);
	for (const element of cards) {
		const rect = element.getBoundingClientRect();
		await expect(rect.right).toBeLessThanOrEqual(bounds.right + 0.5);
		await expect(rect.left).toBeGreaterThanOrEqual(bounds.left - 0.5);
	}
};

export const Desktop: Story = {
	render: desktop(),
	play: async () => {
		reset();
		const dialog = await discoveryDialog();
		const grid = dialog.querySelector("[data-discovery-grid]") as HTMLElement;
		await waitFor(() => expectAlignedGrid(grid));
		const flock = card(dialog, "Colibri Social Flock");
		await userEvent.click(flock);
		const preview = await within(dialog).findByRole("region", {
			name: "Colibri Social Flock",
		});
		await expectFocused(preview);
		await expect(
			dialog.querySelector("[data-discovery-results]"),
		).not.toBeVisible();
		await expect(
			within(preview).getByText("180 members · 24 online"),
		).toBeInTheDocument();
		await expect(within(preview).getByText("By @lou.gg")).toBeInTheDocument();
		await userEvent.click(
			within(preview).getByRole("button", { name: "Join Space" }),
		);
		await expect(onJoin).toHaveBeenCalledWith("flock");
		const open = await within(preview).findByRole("button", {
			name: "Open Space",
		});
		await expectFocused(open);
		await userEvent.click(open);
		await expect(onOpenSpace).toHaveBeenCalledWith("flock");
		await userEvent.keyboard("{Escape}");
		await waitFor(() =>
			expect(within(dialog).queryByRole("region")).not.toBeInTheDocument(),
		);
		await expectFocused(card(dialog, "Colibri Social Flock"));
		await expect(screen.getByRole("dialog")).toBeInTheDocument();
		await userEvent.click(card(dialog, "Pixel Garden"));
		const pixel = await within(dialog).findByRole("region", {
			name: "Pixel Garden",
		});
		await userEvent.click(
			within(pixel).getByRole("button", { name: "Request to join" }),
		);
		await expect(onRequestJoin).toHaveBeenCalledWith("pixel");
		await waitFor(() =>
			expect(
				within(pixel).getByRole("button", { name: "Request pending" }),
			).toBeDisabled(),
		);
		await userEvent.click(
			within(pixel).getByRole("button", { name: "Back to Spaces" }),
		);
		await expectFocused(card(dialog, "Pixel Garden"));
		await waitFor(() => expectAlignedGrid(grid));
	},
};

export const Mobile: Story = {
	parameters: mobileViewport,
	render: mobile(),
	play: async ({ canvasElement }) => {
		reset();
		const flock = card(canvasElement, "Colibri Social Flock");
		await userEvent.click(flock);
		const sheet = await screen.findByRole("dialog", {
			name: "Colibri Social Flock",
		});
		await waitFor(() =>
			expect(sheet.contains(document.activeElement)).toBe(true),
		);
		const join = await within(sheet).findByRole("button", {
			name: "Join Space",
		});
		await waitFor(() => expect(join).toBeVisible());
		const initialTop = sheet.getBoundingClientRect().top;
		await waitFor(() =>
			expect(sheet.getBoundingClientRect().top).toBeLessThan(initialTop),
		);
		await waitFor(() => {
			const scroll = sheet.querySelector("[data-drawer-scroll]") as HTMLElement;
			expect(scroll.scrollHeight).toBeLessThanOrEqual(scroll.clientHeight + 1);
			expect(sheet.getBoundingClientRect().bottom).toBeGreaterThanOrEqual(
				window.innerHeight - 1,
			);
		});
		await userEvent.click(join);
		await expect(onJoin).toHaveBeenCalledWith("flock");
		const open = await within(sheet).findByRole("button", {
			name: "Open Space",
		});
		await userEvent.click(open);
		await expect(onOpenSpace).toHaveBeenCalledWith("flock");
		await userEvent.keyboard("{Escape}");
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
		);
		await expectFocused(card(canvasElement, "Colibri Social Flock"));
	},
};

const previewIn = async (platform: DiscoveryPlatform, name: string) =>
	platform === "desktop"
		? within(await discoveryDialog()).findByRole("region", { name })
		: screen.findByRole("dialog", { name });

const approvalPlay = (platform: DiscoveryPlatform) => async () => {
	reset();
	const preview = await previewIn(platform, "Pixel Garden");
	const request = await within(preview).findByRole("button", {
		name: "Request to join",
	});
	const note = within(preview).getByText("Requires approval to join");
	await expect(request).toHaveAttribute(
		"aria-describedby",
		note.closest("[data-join-note]")?.id,
	);
	await expect(within(preview).queryByText("Approval required")).toBeNull();
	await userEvent.click(request);
	await expect(onRequestJoin).toHaveBeenCalledWith("pixel");
	await waitFor(() =>
		expect(
			within(preview).getByRole("button", { name: "Request pending" }),
		).toBeDisabled(),
	);
};

export const Approval: Story = {
	render: desktop({ selectedId: "pixel" }),
	play: approvalPlay("desktop"),
};

export const ApprovalOnMobile: Story = {
	parameters: mobileViewport,
	render: mobile({ selectedId: "pixel" }),
	play: approvalPlay("mobile"),
};

const pendingPlay = (platform: DiscoveryPlatform) => async () => {
	const preview = await previewIn(platform, "Night Owls");
	const pending = await within(preview).findByRole("button", {
		name: "Request pending",
	});
	await expect(pending).toBeDisabled();
	await expect(pending).toHaveAccessibleDescription(
		"A moderator reviews your request before you can open the Space.",
	);
};

export const Pending: Story = {
	render: desktop({ selectedId: "owls" }),
	play: pendingPlay("desktop"),
};

export const PendingOnMobile: Story = {
	parameters: mobileViewport,
	render: mobile({ selectedId: "owls" }),
	play: pendingPlay("mobile"),
};

const memberPlay = (platform: DiscoveryPlatform) => async () => {
	reset();
	const preview = await previewIn(platform, "Trail Runners");
	await userEvent.click(
		await within(preview).findByRole("button", { name: "Open Space" }),
	);
	await expect(onOpenSpace).toHaveBeenCalledWith("trail");
	await expect(onJoin).not.toHaveBeenCalled();
};

export const Member: Story = {
	render: desktop({ selectedId: "trail" }),
	play: memberPlay("desktop"),
};

export const MemberOnMobile: Story = {
	parameters: mobileViewport,
	render: mobile({ selectedId: "trail" }),
	play: memberPlay("mobile"),
};

export const NoSearchResults: Story = {
	name: "No search results",
	render: desktop({ query: "lighthouse keepers" }),
	play: async () => {
		const dialog = await discoveryDialog();
		const empty = within(dialog).getByRole("status");
		await expect(empty).toHaveTextContent(
			'No Spaces match "lighthouse keepers". Try a different name or topic.',
		);
		const search = within(dialog).getByRole("searchbox", {
			name: "Search Spaces",
		});
		await userEvent.clear(search);
		await userEvent.type(search, "owls");
		await waitFor(() =>
			expect(
				dialog.querySelectorAll("[data-discovery-grid] [data-space-id]"),
			).toHaveLength(1),
		);
	},
};

export const NoSearchResultsOnMobile: Story = {
	name: "No search results on mobile",
	parameters: mobileViewport,
	render: mobile({ query: "lighthouse keepers" }),
};

export const Loading: Story = {
	render: desktop({ loading: true }),
	play: async () => {
		const dialog = await discoveryDialog();
		await expect(within(dialog).getByRole("status")).toHaveTextContent(
			"Loading Spaces",
		);
		await waitFor(() =>
			expect(
				dialog.querySelector("[data-loadable]")?.getAttribute("data-phase"),
			).toBe("skeleton"),
		);
	},
};

export const LoadingOnMobile: Story = {
	name: "Loading on mobile",
	parameters: mobileViewport,
	render: mobile({ loading: true }),
};
