import { createSignal, type JSX, onMount, Show } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { BlueskyPostEmbed } from "../Attachments/BlueskyPostEmbed";
import { LinkEmbed } from "../Attachments/LinkEmbed";
import type { MediaItem } from "../Attachments/MediaGrid";
import { MediaGrid } from "../Attachments/MediaGrid";
import { fixtureImage, fixtureImages } from "../Attachments/story-fixtures";
import { sharedClip } from "../Media/story-clip";
import { MessageRow } from "../Message/MessageRow";
import { createLightbox, Lightbox, mediaTileOrigin } from "./Lightbox";

const meta = {
	title: "Messaging/Lightbox",
	parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const iphone = { viewport: { defaultViewport: "iphone" } };
const NOW = new Date("2026-10-07T14:30:00");
const AT = new Date("2026-10-07T14:02:00");
const SHARE_URL = "https://colibri.social/m/3kz2example";

const withDownloads = (items: MediaItem[]) =>
	items.map((item) => ({ ...item, downloadHref: item.src }));

const Screen = (props: { children: JSX.Element; desktop?: boolean }) => (
	<div
		class={
			props.desktop
				? "min-h-dvh max-w-[960px] bg-background py-4 text-foreground"
				: "min-h-dvh bg-background py-2 text-foreground"
		}
	>
		{props.children}
	</div>
);

const Gallery = (props: {
	items: MediaItem[];
	text: string;
	desktop?: boolean;
}) => {
	const lightbox = createLightbox();
	let grid: HTMLDivElement | undefined;
	return (
		<Screen desktop={props.desktop}>
			<MessageRow
				author={{ name: "Lou" }}
				timestamp={AT}
				now={NOW}
				locale="en-GB"
				attachments={
					<div ref={grid}>
						<MediaGrid items={props.items} onOpen={lightbox.show} />
					</div>
				}
			>
				{props.text}
			</MessageRow>
			<Lightbox
				{...lightbox.props}
				items={props.items}
				getOriginElement={mediaTileOrigin(() => grid)}
				author={{ name: "Lou" }}
				timestamp={AT}
				now={NOW}
				locale="en-GB"
				shareUrl={SHARE_URL}
			/>
		</Screen>
	);
};

const galleryItems = withDownloads(fixtureImages(5));

const linkImage = withDownloads([fixtureImage(0, 1200, 630)]);
const blueskyImages = withDownloads(fixtureImages(3));

const EmbedGallery = (props: { desktop?: boolean }) => {
	const link = createLightbox();
	const bluesky = createLightbox();
	let linkBox: HTMLDivElement | undefined;
	let blueskyBox: HTMLDivElement | undefined;
	return (
		<Screen desktop={props.desktop}>
			<MessageRow
				author={{ name: "Lou" }}
				timestamp={AT}
				now={NOW}
				locale="en-GB"
				attachments={
					<div ref={linkBox}>
						<LinkEmbed
							url="https://atproto.com/guides/overview"
							siteName="AT Protocol"
							title="Protocol overview"
							description="The AT Protocol is an open, decentralized network for building social applications."
							image={linkImage[0]}
							accent="#1185fe"
							onOpenImage={() => link.show(0)}
						/>
					</div>
				}
			>
				This is how the firehose works
			</MessageRow>
			<MessageRow
				author={{ name: "Lis" }}
				timestamp={AT}
				now={NOW}
				locale="en-GB"
				attachments={
					<div ref={blueskyBox}>
						<BlueskyPostEmbed
							post={{
								url: "https://bsky.app/profile/lis.example/post/3kz2",
								author: { name: "Lis", handle: "lis.example" },
								text: "Three birds on the canal this morning.",
								images: blueskyImages,
								time: "2h",
							}}
							onOpenImage={bluesky.show}
						/>
					</div>
				}
			/>
			<Lightbox
				{...link.props}
				items={linkImage}
				getOriginElement={mediaTileOrigin(() => linkBox)}
				author={{ name: "Lou" }}
				timestamp={AT}
				now={NOW}
				locale="en-GB"
				shareUrl={SHARE_URL}
			/>
			<Lightbox
				{...bluesky.props}
				items={blueskyImages}
				getOriginElement={mediaTileOrigin(() => blueskyBox)}
				author={{ name: "Lis" }}
				timestamp={AT}
				now={NOW}
				locale="en-GB"
				shareUrl={SHARE_URL}
			/>
		</Screen>
	);
};

const stubClipboard = () => {
	const writes: string[] = [];
	Object.defineProperty(navigator, "clipboard", {
		configurable: true,
		value: {
			writeText: async (text: string) => {
				writes.push(text);
			},
		},
	});
	return writes;
};

const dialog = () => screen.findByRole("dialog");

const touch = (
	type: string,
	target: Element,
	x: number,
	y: number,
	pointerId = 1,
) =>
	target.dispatchEvent(
		new PointerEvent(type, {
			bubbles: true,
			cancelable: true,
			pointerType: "touch",
			pointerId,
			isPrimary: pointerId === 1,
			button: 0,
			clientX: x,
			clientY: y,
		}),
	);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const Gallery5: Story = {
	name: "Gallery",
	parameters: iphone,
	render: () => (
		<Gallery
			items={galleryItems}
			text="The canal was frozen over this morning."
		/>
	),
	play: async ({ canvasElement }) => {
		const tiles = within(canvasElement).getAllByRole("button", {
			name: /^Open image/,
		});
		const second = tiles[1] as HTMLElement;
		await userEvent.click(second);
		const viewer = await dialog();
		await expect(viewer).toHaveAccessibleName("Image 2 of 5 from Lou");
		await waitFor(() => expect(viewer).toHaveAttribute("data-phase", "open"));
		await expect(
			viewer.querySelector("[data-lightbox-counter]")?.textContent,
		).toBe("2 / 5");

		await userEvent.keyboard("{ArrowRight}");
		await waitFor(() => expect(viewer).toHaveAttribute("data-index", "2"));
		await expect(viewer).toHaveAccessibleName("Image 3 of 5 from Lou");

		const download = within(viewer).getByRole("link", { name: "Download" });
		await expect(download).toHaveAttribute(
			"href",
			galleryItems[2]?.downloadHref,
		);

		const writes = stubClipboard();
		await userEvent.click(
			within(viewer).getByRole("button", { name: "Copy link" }),
		);
		await waitFor(() =>
			expect(within(viewer).getByRole("status")).toHaveTextContent("Copied"),
		);
		await expect(writes).toEqual([SHARE_URL]);

		await userEvent.keyboard("{ArrowLeft}");
		await waitFor(() => expect(viewer).toHaveAttribute("data-index", "1"));
		await userEvent.keyboard("{Escape}");
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
		);
		await waitFor(() => expect(second).toHaveFocus());
	},
};

const pointer = (
	type: string,
	target: Element,
	x: number,
	y: number,
	pointerType = "mouse",
) =>
	target.dispatchEvent(
		new PointerEvent(type, {
			bubbles: true,
			cancelable: true,
			pointerType,
			pointerId: 1,
			isPrimary: true,
			button: 0,
			buttons: type === "pointerup" ? 0 : 1,
			clientX: x,
			clientY: y,
		}),
	);

const openFirst = async (canvasElement: HTMLElement) => {
	await userEvent.click(
		within(canvasElement).getAllByRole("button", {
			name: /^Open image/,
		})[0] as HTMLElement,
	);
	const viewer = await dialog();
	await waitFor(() => expect(viewer).toHaveAttribute("data-phase", "open"));
	return viewer;
};

export const ClickZoom: Story = {
	render: () => (
		<Gallery
			desktop
			items={galleryItems}
			text="Click a photo to zoom in, click again to zoom out."
		/>
	),
	play: async ({ canvasElement }) => {
		const viewer = await openFirst(canvasElement);
		const media = viewer.querySelector(
			"[data-lightbox-slide='0'] [data-lightbox-media]",
		) as HTMLElement;
		const clickAt = (target: Element, x: number, y: number) => {
			pointer("pointerdown", target, x, y);
			pointer("pointerup", target, x, y);
		};
		const center = () => {
			const rect = media.getBoundingClientRect();
			return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
		};
		clickAt(media, center().x, center().y);
		await waitFor(() => expect(viewer).toHaveAttribute("data-zoomed"));
		const slide = viewer.querySelector<HTMLElement>(
			'[data-lightbox-slide="0"]',
		);
		const zoomedMedia = slide?.querySelector<HTMLElement>(
			"[data-lightbox-media]",
		);
		await waitFor(() =>
			expect(zoomedMedia?.getBoundingClientRect().width ?? 0).toBeGreaterThan(
				(slide?.getBoundingClientRect().width ?? 0) * 2,
			),
		);
		await expect(getComputedStyle(slide as HTMLElement).overflow).toBe(
			"visible",
		);
		await wait(400);
		clickAt(media, center().x, center().y);
		await waitFor(() => expect(viewer).not.toHaveAttribute("data-zoomed"));
		await wait(400);
		clickAt(media, center().x, center().y);
		await wait(60);
		clickAt(media, center().x, center().y);
		await wait(400);
		await expect(viewer).toHaveAttribute("data-zoomed");
		clickAt(media, center().x, center().y);
		await waitFor(() => expect(viewer).not.toHaveAttribute("data-zoomed"));
		await wait(400);
		const stage = viewer.querySelector("[data-lightbox-stage]") as HTMLElement;
		const rect = media.getBoundingClientRect();
		clickAt(stage, Math.max(4, rect.left / 2), rect.top + rect.height - 4);
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
		);
	},
};

export const SwipeDownToClose: Story = {
	parameters: iphone,
	render: () => (
		<Gallery items={galleryItems.slice(0, 2)} text="Swipe down to close." />
	),
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getAllByRole("button", {
				name: /^Open image/,
			})[0] as HTMLElement,
		);
		const viewer = await dialog();
		await waitFor(() => expect(viewer).toHaveAttribute("data-phase", "open"));
		const stage = viewer.querySelector("[data-lightbox-stage]") as HTMLElement;
		const x = window.innerWidth / 2;
		const y = window.innerHeight / 2;
		touch("pointerdown", stage, x, y);
		for (let step = 1; step <= 10; step++) {
			await wait(16);
			touch("pointermove", stage, x, y + step * 22);
		}
		touch("pointerup", stage, x, y + 220);
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
		);
	},
};

export const SwipeBetweenImages: Story = {
	parameters: iphone,
	render: () => (
		<Gallery items={galleryItems.slice(0, 3)} text="Swipe sideways." />
	),
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getAllByRole("button", {
				name: /^Open image/,
			})[0] as HTMLElement,
		);
		const viewer = await dialog();
		await waitFor(() => expect(viewer).toHaveAttribute("data-phase", "open"));
		const stage = viewer.querySelector("[data-lightbox-stage]") as HTMLElement;
		const x = window.innerWidth * 0.8;
		const y = window.innerHeight / 2;
		touch("pointerdown", stage, x, y);
		for (let step = 1; step <= 10; step++) {
			await wait(16);
			touch("pointermove", stage, x - step * 25, y);
		}
		touch("pointerup", stage, x - 250, y);
		await waitFor(() => expect(viewer).toHaveAttribute("data-index", "1"));
		await userEvent.keyboard("{Escape}");
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
		);
	},
};

export const SingleImage: Story = {
	parameters: iphone,
	render: () => (
		<Gallery
			items={withDownloads([fixtureImage(3, 1200, 1600)])}
			text="One tall photo."
		/>
	),
};

const longAlt =
	"A narrow canal at dawn with a thin sheet of ice across the water. Two crows sit on the iron railing in the foreground, one looking straight at the camera, and a cyclist in a yellow jacket crosses the stone bridge in the distance while the street lamps are still on.";

export const LongAltText: Story = {
	parameters: iphone,
	render: () => (
		<Gallery
			items={withDownloads([fixtureImage(1, 1600, 1000, { alt: longAlt })])}
			text="With a long description."
		/>
	),
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: /^Open image/ }),
		);
		const viewer = await dialog();
		await waitFor(() => expect(viewer).toHaveAttribute("data-phase", "open"));
		const more = within(viewer).getByRole("button", { name: "Show more" });
		await userEvent.click(more);
		await expect(more).toHaveAttribute("aria-expanded", "true");
		await userEvent.keyboard("{Escape}");
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
		);
	},
};

const VideoGallery = (props: { desktop?: boolean }) => {
	const [items, setItems] = createSignal<MediaItem[]>();
	onMount(async () => {
		const clip = await sharedClip(3);
		setItems([
			fixtureImage(0, 1600, 1000),
			{
				src: clip?.src ?? "",
				poster: clip?.poster,
				kind: "video",
				width: 640,
				height: 360,
				duration: "0:03",
				name: "clip.webm",
				alt: "A purple dot sliding back and forth",
				downloadHref: clip?.src,
			},
		]);
	});
	return (
		<Show when={items()}>
			{(list) => (
				<Gallery
					desktop={props.desktop}
					items={list()}
					text="A photo and a short clip."
				/>
			)}
		</Show>
	);
};

export const Video: Story = {
	parameters: iphone,
	render: () => <VideoGallery />,
};

export const Desktop: Story = {
	render: () => (
		<Gallery
			desktop
			items={withDownloads(fixtureImages(4))}
			text="Desktop shows arrows on the sides and hides the bars when the mouse rests."
		/>
	),
};

const slideShift = (viewer: HTMLElement) => {
	const slide = viewer.querySelector<HTMLElement>('[data-lightbox-slide="0"]');
	const match = slide?.style.transform.match(/translate3d\((-?[\d.]+)px/);
	return match ? Number.parseFloat(match[1] as string) : Number.NaN;
};

export const RapidNavigation: Story = {
	render: () => (
		<Gallery
			desktop
			items={galleryItems}
			text="Spam the arrows: the index and the slide position stay in sync."
		/>
	),
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getAllByRole("button", {
				name: /^Open image/,
			})[0] as HTMLElement,
		);
		const viewer = await dialog();
		await waitFor(() => expect(viewer).toHaveAttribute("data-phase", "open"));
		const next = within(viewer).getByRole("button", { name: "Next" });
		const previous = within(viewer).getByRole("button", { name: "Previous" });
		const limit = window.innerWidth + 32;
		const sequence = [next, next, next, previous, next, next, next, next, next];
		let expected = 0;
		for (const button of sequence) {
			await userEvent.click(button);
			expected = Math.min(
				galleryItems.length - 1,
				Math.max(0, expected + (button === next ? 1 : -1)),
			);
			await expect(viewer).toHaveAttribute("data-index", String(expected));
			await expect(Math.abs(slideShift(viewer))).toBeLessThanOrEqual(limit);
		}
		await expect(viewer).toHaveAttribute(
			"data-index",
			String(galleryItems.length - 1),
		);
		await waitFor(() => expect(slideShift(viewer)).toBe(0), { timeout: 3000 });
		await userEvent.keyboard("{Escape}");
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
		);
	},
};

export const DesktopVideo: Story = {
	render: () => <VideoGallery desktop />,
};

export const Embeds: Story = {
	parameters: iphone,
	render: () => <EmbedGallery />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const link = canvas.getByRole("link", { name: /Protocol overview/ });
		await expect(link).toHaveAttribute(
			"href",
			"https://atproto.com/guides/overview",
		);
		const image = canvas.getByRole("button", {
			name: "Open image from AT Protocol",
		});
		await userEvent.click(image);
		const viewer = await dialog();
		await waitFor(() => expect(viewer).toHaveAttribute("data-phase", "open"));
		await expect(viewer).toHaveAccessibleName("Image from Lou");
		await userEvent.keyboard("{Escape}");
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		await waitFor(() => expect(image).toHaveFocus());
	},
};

const playerVideo = (container: Element) =>
	container.querySelector("[data-video-player] video") as HTMLVideoElement;

export const VideoHandoff: Story = {
	parameters: iphone,
	render: () => <VideoGallery />,
	play: async ({ canvasElement }) => {
		const inlineVideo = await waitFor(
			() => {
				const video = playerVideo(canvasElement);
				expect(video).not.toBeNull();
				return video;
			},
			{ timeout: 8000 },
		);
		inlineVideo.muted = true;
		const inline = inlineVideo.closest("[data-video-player]") as HTMLElement;
		await waitFor(() =>
			expect(Number.isFinite(inlineVideo.duration)).toBe(true),
		);
		await userEvent.click(within(inline).getByRole("button", { name: "Play" }));
		await waitFor(() => expect(inlineVideo.currentTime).toBeGreaterThan(0.6), {
			timeout: 3000,
		});
		await expect(
			within(inline).getByRole("button", { name: "Fullscreen" }),
		).toBeInTheDocument();
		await expect(
			within(inline).queryByRole("button", { name: "Expand video" }),
		).toBeNull();
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: /^Open image/ }),
		);
		const viewer = await dialog();
		await waitFor(() => expect(viewer).toHaveAttribute("data-phase", "open"));
		await userEvent.keyboard("{ArrowRight}");
		await waitFor(() => expect(viewer).toHaveAttribute("data-index", "1"));
		const viewerVideo = await waitFor(() => {
			const video = playerVideo(viewer);
			expect(video).not.toBeNull();
			return video;
		});
		await waitFor(() => expect(inlineVideo.paused).toBe(true));
		await waitFor(() =>
			expect(Number.isFinite(viewerVideo.duration)).toBe(true),
		);
		viewerVideo.currentTime = 1.5;
		await waitFor(() => expect(viewerVideo.currentTime).toBeCloseTo(1.5, 1));
		viewerVideo.pause();
		const closedAt = viewerVideo.currentTime;
		await userEvent.keyboard("{Escape}");
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
		);
		await waitFor(() =>
			expect(Math.abs(inlineVideo.currentTime - closedAt)).toBeLessThan(0.5),
		);
	},
};

const WHITE_IMAGE = `data:image/svg+xml,${encodeURIComponent(
	'<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="2400"><rect width="1200" height="2400" fill="#ffffff"/></svg>',
)}`;

const onCopyImage = fn();
const onDownloadImage = fn();

export const ImageActionsAndScrims: Story = {
	name: "Image actions and scrims over a white image",
	parameters: iphone,
	render: () => {
		const [open, setOpen] = createSignal(true);
		return (
			<Lightbox
				items={[
					{
						src: WHITE_IMAGE,
						width: 1200,
						height: 2400,
						kind: "image",
						name: "white.png",
						alt: "A plain white page that fills the whole screen.",
					},
				]}
				open={open()}
				onOpenChange={setOpen}
				onCopyImage={onCopyImage}
				onDownloadImage={onDownloadImage}
			/>
		);
	},
	play: async () => {
		onCopyImage.mockClear();
		onDownloadImage.mockClear();
		const top = await waitFor(() => {
			const element = document.querySelector<HTMLElement>(
				'[data-lightbox-scrim="top"]',
			);
			if (!element) throw new Error("no top scrim");
			return element;
		});
		const bottom = document.querySelector<HTMLElement>(
			'[data-lightbox-scrim="bottom"]',
		);
		await expect(bottom).not.toBeNull();
		const copy = await screen.findByRole("button", { name: "Copy image" });
		const download = screen.getByRole("button", { name: "Download image" });
		const caption = document.querySelector<HTMLElement>("[data-lightbox-alt]");
		if (!caption || !bottom) throw new Error("missing caption or scrim");
		await waitFor(() => expect(getComputedStyle(top).opacity).toBe("1"));

		const topBox = top.getBoundingClientRect();
		const copyBox = copy.getBoundingClientRect();
		await expect(topBox.top).toBeLessThanOrEqual(copyBox.top);
		await expect(topBox.bottom).toBeGreaterThanOrEqual(copyBox.bottom);
		const bottomBox = bottom.getBoundingClientRect();
		const captionBox = caption.getBoundingClientRect();
		await expect(bottomBox.top).toBeLessThanOrEqual(captionBox.top);
		await expect(Math.round(bottomBox.bottom)).toBe(window.innerHeight);

		const onCopy = document.elementFromPoint(
			copyBox.left + copyBox.width / 2,
			copyBox.top + copyBox.height / 2,
		);
		await expect(!!onCopy && copy.contains(onCopy)).toBe(true);
		const onCaption = document.elementFromPoint(
			captionBox.left + 4,
			captionBox.top + captionBox.height / 2,
		);
		await expect(!!onCaption && caption.contains(onCaption)).toBe(true);
		const stage = document.querySelector<HTMLElement>("[data-lightbox-stage]");
		const toolbar = copy.closest<HTMLElement>("[data-lightbox-chrome]");
		const captionChrome = caption.closest<HTMLElement>(
			"[data-lightbox-chrome]",
		);
		if (!stage || !toolbar || !captionChrome) throw new Error("missing layers");
		const after = (a: Node, b: Node) =>
			!!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
		await expect(after(stage, top)).toBe(true);
		await expect(after(top, toolbar)).toBe(true);
		await expect(after(bottom, captionChrome)).toBe(true);
		for (const layer of [top, bottom, toolbar, captionChrome])
			await expect(getComputedStyle(layer).zIndex).toBe("auto");
		await expect(getComputedStyle(top).pointerEvents).toBe("none");

		for (const element of [
			top,
			bottom,
			...document.querySelectorAll<HTMLElement>("[data-lightbox-chrome]"),
		]) {
			await expect(getComputedStyle(element).backdropFilter).toMatch(
				/^(none|)$/,
			);
		}
		await expect(getComputedStyle(top).backgroundImage).toContain(
			"linear-gradient",
		);

		await userEvent.click(copy);
		await expect(onCopyImage).toHaveBeenCalledWith(0);
		await userEvent.click(download);
		await expect(onDownloadImage).toHaveBeenCalledWith(0);
	},
};

export const ImageMenuOnRightClick: Story = {
	name: "Image menu on right-click",
	render: () => {
		const [open, setOpen] = createSignal(true);
		return (
			<Lightbox
				items={[{ src: WHITE_IMAGE, width: 1200, height: 2400, kind: "image" }]}
				open={open()}
				onOpenChange={setOpen}
				onCopyImage={onCopyImage}
				onDownloadImage={onDownloadImage}
			/>
		);
	},
	play: async () => {
		onCopyImage.mockClear();
		const media = await waitFor(() => {
			const element = document.querySelector<HTMLElement>(
				'[data-lightbox-slide="0"] [data-lightbox-media]',
			);
			if (!element) throw new Error("no media");
			return element;
		});
		await new Promise((resolve) => setTimeout(resolve, 400));
		const box = media.getBoundingClientRect();
		const event = new MouseEvent("contextmenu", {
			bubbles: true,
			cancelable: true,
			clientX: box.left + box.width / 2,
			clientY: box.top + box.height / 2,
		});
		const hit = document.elementFromPoint(
			box.left + box.width / 2,
			box.top + box.height / 2,
		);
		if (!hit) throw new Error("nothing under the pointer");
		hit.dispatchEvent(event);
		await expect(event.defaultPrevented).toBe(true);
		const menu = await screen.findByRole("menu", { name: "Image options" });
		const copyItem = within(menu).getByRole("menuitem", { name: "Copy image" });
		const itemBox = copyItem.getBoundingClientRect();
		const topmost = document.elementFromPoint(
			itemBox.left + itemBox.width / 2,
			itemBox.top + itemBox.height / 2,
		);
		await expect(!!topmost && copyItem.contains(topmost)).toBe(true);
		await userEvent.click(
			within(menu).getByRole("menuitem", { name: "Copy image" }),
		);
		await expect(onCopyImage).toHaveBeenCalledWith(0);
	},
};
