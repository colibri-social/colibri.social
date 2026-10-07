import { For } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { storyImages } from "../Banner/story-images";
import { Button } from "../Button/Button";
import { DeveloperModeCard } from "../DeveloperMode/DeveloperModeCard";
import { Drawer, DrawerContent, DrawerTrigger } from "../Drawer/Drawer";
import { SearchField } from "../TextField/TextField";
import { SpaceCard } from "./SpaceCard";
import { SpaceProfileHeader } from "./SpaceProfileHeader";

const meta = {
	title: "Surfaces/Space",
	parameters: { viewport: { defaultViewport: "iphone" } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const description =
	"A cozy corner for people who build things on the AT Protocol. Share projects, ask questions, and hang out in voice on Fridays.";

const spaces = () => [
	{
		name: "Colibri Social Flock",
		iconSrc: storyImages.violetIcon(),
		bannerSrc: storyImages.sunsetBanner(),
		memberCount: 180,
		description,
	},
	{
		name: "Pixel Garden",
		iconSrc: storyImages.tealIcon(),
		memberCount: 1,
		description: "Pixel art, palettes, and weekly prompts.",
	},
	{
		name: "Night Owls",
		memberCount: 12480,
		bannerColor: "linear-gradient(135deg, #1e3a8a, #0f172a)",
		description,
	},
];

const onOpen = fn((_name: string) => {});

export const DiscoveryFeed: Story = {
	render: () => (
		<div class="flex min-h-screen flex-col gap-4 bg-background px-4 py-4">
			<h1 class="text-2xl font-extrabold">Discovery feed</h1>
			<SearchField placeholder="Search Spaces" aria-label="Search Spaces" />
			<For each={spaces()}>
				{(space) => <SpaceCard {...space} onClick={() => onOpen(space.name)} />}
			</For>
		</div>
	),
	play: async ({ canvasElement }) => {
		onOpen.mockClear();
		const canvas = within(canvasElement);
		const card = canvas.getByRole("button", {
			name: /^Colibri Social Flock 180 members/,
		});
		await userEvent.click(card);
		await expect(onOpen).toHaveBeenCalledTimes(1);
		await expect(onOpen).toHaveBeenCalledWith("Colibri Social Flock");
		await expect(canvas.getByText("1 member")).toBeInTheDocument();
		await expect(canvas.getByText("12,480 members")).toBeInTheDocument();
		card.dispatchEvent(
			new PointerEvent("pointerdown", {
				bubbles: true,
				button: 0,
				pointerType: "touch",
				clientX: card.getBoundingClientRect().left + 40,
				clientY: card.getBoundingClientRect().top + 40,
			}),
		);
		const layer = card.querySelector("[data-ripple-layer]");
		await expect(layer).toHaveAttribute("data-placement", "over");
		await expect(layer?.querySelector("[data-ripple-wave]")).not.toBeNull();
		card.dispatchEvent(
			new PointerEvent("pointerup", { bubbles: true, pointerType: "touch" }),
		);
		await waitFor(() =>
			expect(card.querySelector("[data-ripple-wave]")).toBeNull(),
		);
	},
};

export const SpaceDrawer: Story = {
	render: () => (
		<div class="min-h-screen bg-background p-4">
			<Drawer>
				<DrawerTrigger as={Button} variant="secondary">
					Open Space
				</DrawerTrigger>
				<DrawerContent
					aria-label="Colibri Social Flock"
					header={
						<SpaceProfileHeader
							name="Colibri Social Flock"
							iconSrc={storyImages.violetIcon()}
							memberCount={20}
							ownerHandle="lou.gg"
							description={description}
							actions={
								<Button variant="primary" block>
									Join this Space
								</Button>
							}
						>
							<DeveloperModeCard
								copyLabel="Copy DID"
								copyValue="did:plc:colibrisocialflock"
								pdslsHref="https://pdsls.dev/at://did:plc:colibrisocialflock"
							/>
						</SpaceProfileHeader>
					}
				/>
			</Drawer>
		</div>
	),
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Open Space" }),
		);
		const dialog = await screen.findByRole("dialog");
		await waitFor(() =>
			expect(
				within(dialog).getByRole("heading", { name: "Colibri Social Flock" }),
			).toBeVisible(),
		);
		await expect(within(dialog).getByText("By @lou.gg")).toBeInTheDocument();
		await expect(
			within(dialog).getByRole("button", { name: "Join this Space" }),
		).toBeInTheDocument();
		const clipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: undefined,
		});
		const execCommand = document.execCommand;
		const copyCommand = fn(() => true);
		document.execCommand = copyCommand;
		try {
			const copy = within(dialog).getByRole("button", { name: /Copy DID/ });
			await userEvent.click(copy);
			await expect(copyCommand).toHaveBeenCalledWith("copy");
			await waitFor(() => expect(copy).toHaveAttribute("data-copied"));
		} finally {
			document.execCommand = execCommand;
			if (clipboard) Object.defineProperty(navigator, "clipboard", clipboard);
			else Reflect.deleteProperty(navigator, "clipboard");
		}
	},
};
