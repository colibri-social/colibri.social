import { BellIcon } from "@solar-icons/solid/bold/bell";
import { HomeIcon } from "@solar-icons/solid/bold/home";
import { createSignal } from "solid-js";
import { expect, fn, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { ListGroup, NavRow } from "../components/List/List";
import { TabBar, TabBarItem } from "../components/TabBar/TabBar";
import { HapticsProvider } from "../utils/haptics";
import { createRipple, type RipplePointerType } from "../utils/ripple";

const meta = {
	title: "Foundations/Ripple",
	parameters: { viewport: { defaultViewport: "iphone" } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const haptics = { impact: fn(), selection: fn(), notification: fn() };

const Surface = (props: {
	label: string;
	pointerTypes?: RipplePointerType[];
	haptic?: boolean;
}) => {
	const ripple = createRipple({
		pointerTypes: props.pointerTypes,
		haptic: props.haptic ? "light" : undefined,
	});
	return (
		<button
			ref={ripple}
			type="button"
			class="ripple focus-ring flex h-24 w-full cursor-pointer items-center justify-center rounded-surface border border-border bg-card text-sm font-semibold text-foreground"
		>
			{props.label}
		</button>
	);
};

const touch = (target: Element, type: string, init: PointerEventInit = {}) =>
	target.dispatchEvent(
		new PointerEvent(type, {
			bubbles: true,
			pointerType: "touch",
			button: 0,
			isPrimary: true,
			...init,
		}),
	);

export const Showcase: Story = {
	render: () => {
		const [tab, setTab] = createSignal("home");
		return (
			<HapticsProvider haptics={haptics}>
				<div class="flex w-full flex-col gap-6 pb-24">
					<p class="max-w-[60ch] text-sm text-muted-foreground">
						Touch and pen presses grow a tint from the finger. Mouse presses
						rely on hover, so they only ripple when opted in. Enter and Space
						grow it from the center.
					</p>
					<Surface label="Touch or pen" />
					<Surface
						label="Mouse too, with a light haptic"
						pointerTypes={["touch", "pen", "mouse"]}
						haptic
					/>
					<ListGroup label="Row">
						<NavRow icon={<BellIcon />} label="Notifications" />
					</ListGroup>
					<TabBar value={tab()} onChange={setTab} class="static">
						<TabBarItem value="home" label="Home" icon={<HomeIcon />} />
						<TabBarItem value="inbox" label="Inbox" icon={<BellIcon />} />
					</TabBar>
				</div>
			</HapticsProvider>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const row = canvas.getByRole("button", { name: "Notifications" });
		const tab = canvas.getByRole("button", { name: "Inbox" });
		for (const host of [row, tab]) {
			touch(host, "pointerdown");
			await expect(host.querySelector("[data-ripple-wave]")).not.toBeNull();
			touch(host, "pointerup");
			await waitFor(
				() => expect(host.querySelector("[data-ripple-wave]")).toBeNull(),
				{ timeout: 3000 },
			);
		}
		const tabLayer = tab.querySelector(":scope > [data-ripple-layer]");
		await expect(
			tab.querySelectorAll(":scope > [data-ripple-layer]"),
		).toHaveLength(1);
		await expect(tabLayer?.previousElementSibling).toHaveAttribute(
			"data-tab-bar-pill",
		);
	},
};

export const TouchLifecycle: Story = {
	render: () => (
		<div class="w-full">
			<Surface label="Press me" />
		</div>
	),
	play: async ({ canvasElement }) => {
		const surface = within(canvasElement).getByRole("button", {
			name: "Press me",
		});
		const rect = surface.getBoundingClientRect();
		touch(surface, "pointerdown", {
			clientX: rect.left + 20,
			clientY: rect.top + 20,
		});
		const wave = surface.querySelector("[data-ripple-wave]");
		await expect(wave).not.toBeNull();
		await expect(surface.querySelector("[data-ripple-layer]")).toHaveAttribute(
			"aria-hidden",
			"true",
		);
		touch(surface, "pointerup");
		await waitFor(
			() => expect(surface.querySelector("[data-ripple-wave]")).toBeNull(),
			{ timeout: 3000 },
		);
	},
};

export const MouseSkipsByDefault: Story = {
	render: () => (
		<div class="w-full">
			<Surface label="Mouse target" />
		</div>
	),
	play: async ({ canvasElement }) => {
		const surface = within(canvasElement).getByRole("button", {
			name: "Mouse target",
		});
		touch(surface, "pointerdown", { pointerType: "mouse" });
		await expect(surface.querySelector("[data-ripple-wave]")).toBeNull();
		touch(surface, "pointerup", { pointerType: "mouse" });
	},
};

export const HapticOptIn: Story = {
	render: () => (
		<HapticsProvider haptics={haptics}>
			<div class="w-full">
				<Surface label="Haptic target" haptic />
			</div>
		</HapticsProvider>
	),
	play: async ({ canvasElement }) => {
		haptics.impact.mockClear();
		const surface = within(canvasElement).getByRole("button", {
			name: "Haptic target",
		});
		touch(surface, "pointerdown");
		await expect(haptics.impact).toHaveBeenCalledWith("light");
		touch(surface, "pointerup");
	},
};
