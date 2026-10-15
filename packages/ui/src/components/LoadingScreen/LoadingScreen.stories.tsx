import { onCleanup } from "solid-js";
import { expect, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import {
	emulateWindowChrome,
	expectClearOfWindowChrome,
	expectNoLayoutIssues,
} from "../../foundations/layout-test";
import { LoadingScreen } from "./LoadingScreen";

const TIPS = [
	"Type @ to mention someone, or # to link to a channel.",
	"Put two vertical bars on each side of some words, like ||this||, to hide them as a spoiler.",
	"Mentions and replies to your messages land in your Inbox.",
];

const meta: Meta = {
	title: "Surfaces/Loading screen",
	parameters: { viewport: { defaultViewport: "iphone" } },
};

export default meta;
type Story = StoryObj;

const tipText = (root: HTMLElement) =>
	root.querySelector("[data-loading-tip-text]")?.textContent ?? null;

const centerOf = (element: Element) => {
	const rect = element.getBoundingClientRect();
	return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
};

export const Mobile: Story = {
	render: () => (
		<div class="h-[640px] w-full max-w-[402px]">
			<LoadingScreen label="Starting Colibri" tips={TIPS} tipDelay={0} />
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const screen = canvas.getByRole("status", { name: "Starting Colibri" });
		await expect(canvas.getByText(TIPS[0])).toBeVisible();
		const bird = screen.querySelector("[data-hummingbird]");
		const tip = screen.querySelector("[data-loading-tip]");
		if (!bird || !tip) throw new Error("loading screen missing parts");
		const center = centerOf(screen);
		const birdCenter = centerOf(bird);
		await expect(Math.abs(birdCenter.y - center.y)).toBeLessThan(16);
		await expect(tip.getBoundingClientRect().top).toBeGreaterThan(
			bird.getBoundingClientRect().bottom,
		);
		await expectNoLayoutIssues(canvasElement.firstElementChild as HTMLElement);
	},
};

export const RotatesTips: Story = {
	name: "Rotates tips",
	render: () => (
		<div class="h-[640px] w-full max-w-[402px]">
			<LoadingScreen
				tips={TIPS}
				tipStart={1}
				tipDelay={300}
				tipInterval={500}
			/>
		</div>
	),
	play: async ({ canvasElement }) => {
		const root = canvasElement.firstElementChild as HTMLElement;
		await expect(tipText(root)).toBeNull();
		await waitFor(() => expect(tipText(root)).toBe(TIPS[1]), {
			timeout: 3000,
		});
		await waitFor(() => expect(tipText(root)).toBe(TIPS[2]), {
			timeout: 3000,
		});
		await waitFor(() => expect(tipText(root)).toBe(TIPS[0]), {
			timeout: 3000,
		});
	},
};

export const CoarseClock: Story = {
	name: "Keeps rotating on a coarse clock",
	render: () => {
		const realNow = performance.now.bind(performance);
		performance.now = () => Math.floor(realNow() / 100) * 100;
		onCleanup(() => {
			performance.now = realNow;
		});
		return (
			<div class="h-[640px] w-full max-w-[402px]">
				<LoadingScreen
					tips={TIPS}
					tipStart={0}
					tipDelay={0}
					tipInterval={130}
				/>
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		const root = canvasElement.firstElementChild as HTMLElement;
		const seen = new Set<string>();
		await waitFor(
			() => {
				const text = tipText(root);
				if (text) seen.add(text);
				expect(seen.size).toBe(TIPS.length);
			},
			{ timeout: 3000, interval: 20 },
		);
	},
};

export const ResumesWithoutFade: Story = {
	name: "Resumes without a fade",
	render: () => {
		const since = performance.now() - 10000;
		return (
			<div class="h-[640px] w-full max-w-[402px]">
				<LoadingScreen
					tips={TIPS}
					since={since}
					tipDelay={1000}
					tipInterval={4000}
				/>
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		const root = canvasElement.firstElementChild as HTMLElement;
		await expect(tipText(root)).toBe(TIPS[2]);
		const text = root.querySelector("[data-loading-tip-text]") as HTMLElement;
		await expect(getComputedStyle(text).animationName).toBe("none");
		await expect(
			root.querySelector("[data-loading-bird]")?.hasAttribute("data-tired"),
		).toBe(true);
	},
};

export const Desktop: Story = {
	parameters: { viewport: { defaultViewport: "responsive" } },
	render: () => {
		onCleanup(emulateWindowChrome());
		return (
			<div class="h-[720px] w-full">
				<LoadingScreen
					label="Starting Colibri"
					tips={["Press Shift and Enter to start a new line without sending."]}
					tipDelay={0}
				/>
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		await expect(
			within(canvasElement).getByText(
				"Press Shift and Enter to start a new line without sending.",
			),
		).toBeVisible();
		await expectClearOfWindowChrome(canvasElement);
		await expectNoLayoutIssues(canvasElement.firstElementChild as HTMLElement);
	},
};

export const ShortWindow: Story = {
	name: "Short window",
	render: () => (
		<div class="h-[400px] w-full max-w-[740px]">
			<LoadingScreen tips={TIPS} tipDelay={0} />
		</div>
	),
	play: async ({ canvasElement }) => {
		const tip = canvasElement.querySelector("[data-loading-tip]");
		await expect(tip ? getComputedStyle(tip).display : null).toBe("none");
	},
};

export const ReducedMotion: Story = {
	name: "Reduced motion",
	globals: { reducedMotion: "on" },
	render: () => (
		<div class="h-[640px] w-full max-w-[402px]">
			<LoadingScreen tips={TIPS} tipDelay={200} />
		</div>
	),
	play: async ({ canvasElement }) => {
		const root = canvasElement.firstElementChild as HTMLElement;
		await waitFor(() => expect(tipText(root)).toBe(TIPS[0]), {
			timeout: 1000,
		});
		const rig = root.querySelector(".hb-rig") as HTMLElement;
		await expect(getComputedStyle(rig).animationName).toBe("none");
		const tip = root.querySelector("[data-loading-tip] > div") as HTMLElement;
		await expect(getComputedStyle(tip).animationName).toBe("none");
		for (const fan of Array.from(root.querySelectorAll(".hb-fan"))) {
			await expect(getComputedStyle(fan).display).toBe("none");
		}
	},
};
