import { createSignal, Show } from "solid-js";
import { expect, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { setAppActive } from "../../utils/playback";
import { MediaGrid } from "../Attachments/MediaGrid";
import { Avatar } from "../Avatar/Avatar";
import { Lightbox } from "../Lightbox/Lightbox";
import { AnimatedImage } from "./AnimatedImage";
import { bouncingDotGif } from "./fixtures";

const staticImage =
	"data:image/svg+xml;utf8," +
	encodeURIComponent(
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#8e51ff"/></svg>',
	);

const meta = {
	title: "Primitives/Animated image",
	component: AnimatedImage,
	parameters: { layout: "centered" },
} satisfies Meta<typeof AnimatedImage>;

export default meta;
type Story = StoryObj<typeof meta>;

const Frame = (props: { label: string; src: string; animated?: boolean }) => (
	<figure class="flex flex-col items-center gap-2">
		<span
			data-host=""
			class="relative block size-32 overflow-hidden rounded-surface bg-muted"
		>
			<AnimatedImage
				src={props.src}
				animated={props.animated}
				alt={props.label}
				class="absolute inset-0 size-full object-cover"
			/>
		</span>
		<figcaption class="text-sm text-muted-foreground">{props.label}</figcaption>
	</figure>
);

const visibleMedia = (root: HTMLElement) =>
	Array.from(
		root.querySelectorAll<HTMLElement>("[data-animated-image]"),
	).filter((element) => getComputedStyle(element).display !== "none");

const withReducedMotion = async (run: () => Promise<void>) => {
	const root = document.documentElement;
	const previous = root.dataset.reducedMotion;
	root.dataset.reducedMotion = "true";
	try {
		await run();
	} finally {
		root.dataset.reducedMotion = previous ?? "false";
	}
};

const withAppInactive = async (run: () => Promise<void>) => {
	setAppActive(false);
	try {
		await run();
	} finally {
		setAppActive(undefined);
	}
};

const loaded = async (root: HTMLElement) => {
	await waitFor(
		() => {
			const image = root.querySelector("img");
			expect(image?.complete && image.naturalWidth > 0).toBe(true);
		},
		{ timeout: 3000 },
	);
};

export const Gallery: Story = {
	render: () => (
		<div class="flex gap-6">
			<Frame label="Animated GIF" src={bouncingDotGif} />
			<Frame label="Static image" src={staticImage} />
		</div>
	),
};

export const PausesWhenAppInactive: Story = {
	render: () => <Frame label="Animated GIF" src={bouncingDotGif} />,
	play: async ({ canvasElement }) => {
		await loaded(canvasElement);
		const host = canvasElement.querySelector<HTMLElement>("[data-host]");
		if (!host) throw new Error("Missing host");
		const playingBox = host
			.querySelector("[data-animated-image]")
			?.getBoundingClientRect();
		await expect(visibleMedia(host)[0]).toHaveAttribute(
			"data-animated-image",
			"playing",
		);
		await withAppInactive(async () => {
			await waitFor(() =>
				expect(visibleMedia(host)[0]).toHaveAttribute(
					"data-animated-image",
					"paused",
				),
			);
			const frame = visibleMedia(host)[0];
			await expect(visibleMedia(host)).toHaveLength(1);
			await expect(frame.tagName).toBe("CANVAS");
			await expect(frame).toHaveAttribute("role", "img");
			await expect(frame).toHaveAttribute("aria-label", "Animated GIF");
			const box = frame.getBoundingClientRect();
			await expect(box.width).toBe(playingBox?.width);
			await expect(box.height).toBe(playingBox?.height);
			await expect(box.top).toBe(playingBox?.top);
			await expect(box.left).toBe(playingBox?.left);
		});
		await waitFor(() =>
			expect(visibleMedia(host)[0]).toHaveAttribute(
				"data-animated-image",
				"playing",
			),
		);
		await expect(host.querySelector("canvas")).toBeNull();
	},
};

export const PausesForReducedMotion: Story = {
	render: () => <Frame label="Animated GIF" src={bouncingDotGif} />,
	play: async ({ canvasElement }) => {
		await loaded(canvasElement);
		const host = canvasElement.querySelector<HTMLElement>("[data-host]");
		if (!host) throw new Error("Missing host");
		await withReducedMotion(async () => {
			await waitFor(() =>
				expect(visibleMedia(host)[0]).toHaveAttribute(
					"data-animated-image",
					"paused",
				),
			);
			await userEvent.hover(host);
			await waitFor(() =>
				expect(visibleMedia(host)[0]).toHaveAttribute(
					"data-animated-image",
					"playing",
				),
			);
			await userEvent.unhover(host);
			await waitFor(() =>
				expect(visibleMedia(host)[0]).toHaveAttribute(
					"data-animated-image",
					"paused",
				),
			);
		});
		await waitFor(() =>
			expect(visibleMedia(host)[0]).toHaveAttribute(
				"data-animated-image",
				"playing",
			),
		);
	},
};

export const StaticImagesAreUntouched: Story = {
	render: () => <Frame label="Static image" src={staticImage} />,
	play: async ({ canvasElement }) => {
		await loaded(canvasElement);
		await withAppInactive(async () => {
			const image = within(canvasElement).getByRole("img", {
				name: "Static image",
			});
			await expect(image.tagName).toBe("IMG");
			await expect(image).not.toHaveAttribute("data-animated-image");
			await expect(canvasElement.querySelector("canvas")).toBeNull();
		});
	},
};

const mediaState = (root: HTMLElement) =>
	visibleMedia(root)[0]?.getAttribute("data-animated-image");

export const ChatGifToggle: Story = {
	render: () => (
		<div class="w-80">
			<MediaGrid
				items={[
					{
						src: bouncingDotGif,
						kind: "gif",
						width: 64,
						height: 64,
						alt: "Bouncing dot",
					},
				]}
			/>
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await loaded(canvasElement);
		await expect(canvas.queryByRole("button", { name: "Play GIF" })).toBeNull();
		await withReducedMotion(async () => {
			await waitFor(() => expect(mediaState(canvasElement)).toBe("paused"));
			const toggle = await canvas.findByRole("button", { name: "Play GIF" });
			await expect(toggle).toHaveAttribute("aria-pressed", "false");
			await userEvent.click(toggle);
			await waitFor(() => expect(mediaState(canvasElement)).toBe("playing"));
			await expect(
				canvas.getByRole("button", { name: "Pause GIF" }),
			).toHaveAttribute("aria-pressed", "true");
			await withAppInactive(async () => {
				await waitFor(() => expect(mediaState(canvasElement)).toBe("paused"));
			});
			await waitFor(() => expect(mediaState(canvasElement)).toBe("playing"));
			await userEvent.click(canvas.getByRole("button", { name: "Pause GIF" }));
			await waitFor(() => expect(mediaState(canvasElement)).toBe("paused"));
		});
	},
};

export const AvatarHover: Story = {
	render: () => <Avatar name="Lou Escher" size="xl" src={bouncingDotGif} />,
	play: async ({ canvasElement }) => {
		await loaded(canvasElement);
		await expect(mediaState(canvasElement)).toBe("playing");
		await withReducedMotion(async () => {
			await waitFor(() => expect(mediaState(canvasElement)).toBe("paused"));
			const host = visibleMedia(canvasElement)[0].parentElement;
			if (!host) throw new Error("Missing avatar host");
			await userEvent.hover(host);
			await waitFor(() => expect(mediaState(canvasElement)).toBe("playing"));
			await userEvent.unhover(host);
			await waitFor(() => expect(mediaState(canvasElement)).toBe("paused"));
		});
	},
};

export const LightboxPlaysOnDemand: Story = {
	render: () => (
		<Lightbox
			open
			onOpenChange={() => {}}
			items={[
				{
					src: bouncingDotGif,
					kind: "gif",
					width: 64,
					height: 64,
					alt: "Bouncing dot",
				},
			]}
		/>
	),
	play: async () => {
		const dialog = await within(document.body).findByRole("dialog");
		await waitFor(
			() => {
				const image = dialog.querySelector("img");
				expect(image?.complete && image.naturalWidth > 0).toBe(true);
			},
			{ timeout: 3000 },
		);
		await withReducedMotion(async () => {
			await expect(mediaState(dialog)).toBe("playing");
			await withAppInactive(async () => {
				await waitFor(() => expect(mediaState(dialog)).toBe("paused"));
			});
			await waitFor(() => expect(mediaState(dialog)).toBe("playing"));
		});
	},
};

const [unmountSource, setUnmountSource] = createSignal<string>();

export const UnmountsBeforeLoad: Story = {
	render: () => (
		<span
			data-host=""
			class="relative block size-32 overflow-hidden rounded-surface bg-muted"
		>
			<Show when={unmountSource()}>
				{(src) => (
					<AnimatedImage
						src={src()}
						alt="Preview"
						class="absolute inset-0 size-full object-cover"
					/>
				)}
			</Show>
		</span>
	),
	play: async ({ canvasElement }) => {
		const errors: unknown[] = [];
		const record = (event: ErrorEvent) => {
			errors.push(event.error ?? event.message);
			event.preventDefault();
		};
		window.addEventListener("error", record);
		try {
			setUnmountSource(bouncingDotGif);
			await expect(canvasElement.querySelector("img")).not.toBeNull();
			setUnmountSource(undefined);
			await expect(canvasElement.querySelector("img")).toBeNull();
			setUnmountSource(staticImage);
			setUnmountSource(undefined);
			await new Promise((resolve) => setTimeout(resolve, 200));
			await expect(errors).toEqual([]);
		} finally {
			window.removeEventListener("error", record);
			setUnmountSource(undefined);
		}
	},
};
