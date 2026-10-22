import { createSignal, type JSX, Show } from "solid-js";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectFocusRingVisible } from "../../foundations/focus-ring-test";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import { paintImage } from "../Banner/story-images";
import { createStoryClip } from "../Media/story-clip";
import { MessageRow } from "../Message/MessageRow";
import {
	type BlueskyEmbedClient,
	type BlueskyPost,
	BlueskyPostEmbed,
	BlueskyPostEmbedSkeleton,
} from "./BlueskyPostEmbed";
import {
	AudioAttachment,
	FileAttachment,
	FileAttachmentSkeleton,
} from "./FileAttachment";
import { ForwardedMessage } from "./ForwardedMessage";
import { HiddenMessage } from "./HiddenMessage";
import { LinkEmbed, LinkEmbedSkeleton } from "./LinkEmbed";
import { MediaGrid, MediaGridSkeleton, type MediaItem } from "./MediaGrid";
import { type RichTextBlock, SocialPostEmbed } from "./SocialPostEmbed";
import { fixtureImage, fixtureImages } from "./story-fixtures";

const meta = {
	title: "Messaging/Attachments",
	parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const mobile = { viewport: { defaultViewport: "iphone" } };
const NOW = new Date("2026-10-07T14:30:00");
const AT = new Date("2026-10-07T14:02:00");

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

const Message = (props: {
	name?: string;
	text?: string;
	attachments: JSX.Element;
}) => (
	<MessageRow
		author={{ name: props.name ?? "Lou" }}
		timestamp={AT}
		now={NOW}
		locale="en-GB"
		attachments={props.attachments}
	>
		{props.text}
	</MessageRow>
);

const onOpen = fn();

const MediaCases = (props: { desktop?: boolean }) => {
	const clip = createStoryClip(3);
	return (
		<Screen desktop={props.desktop}>
			<Message
				text="Found this on the walk home"
				attachments={
					<MediaGrid items={[fixtureImage(0, 1600, 900)]} onOpen={onOpen} />
				}
			/>
			<Message
				name="Lis"
				attachments={
					<MediaGrid items={[fixtureImage(1, 900, 1600)]} onOpen={onOpen} />
				}
			/>
			<Message
				text="Tiny one"
				attachments={
					<MediaGrid items={[fixtureImage(2, 160, 120)]} onOpen={onOpen} />
				}
			/>
			<Message
				name="Lis"
				text="Unsized"
				attachments={
					<MediaGrid
						items={[
							{
								src: paintImage(140, 80, ["#60a5fa", "#1e3a8a"]),
								alt: "Unsized photo",
								name: "unsized.png",
							},
						]}
						onOpen={onOpen}
					/>
				}
			/>
			<Message
				text="Two of them"
				attachments={<MediaGrid items={fixtureImages(2)} onOpen={onOpen} />}
			/>
			<Message
				name="Lis"
				text="Three"
				attachments={<MediaGrid items={fixtureImages(3)} onOpen={onOpen} />}
			/>
			<Message
				text="Mixed media"
				attachments={
					<MediaGrid
						items={[
							fixtureImage(4, 640, 360, {
								kind: "video",
								duration: "0:03",
								src: clip()?.src ?? "",
								poster: clip()?.poster,
							}),
							fixtureImage(5, 1200, 1200, { kind: "gif" }),
							fixtureImage(6, 1200, 900, { spoiler: true }),
							fixtureImage(7, 1200, 900, {
								downloadHref: "data:text/plain,example",
							}),
						]}
						onOpen={onOpen}
					/>
				}
			/>
			<Message
				name="Tim"
				text="The whole album"
				attachments={<MediaGrid items={fixtureImages(13)} onOpen={onOpen} />}
			/>
			<Message
				name="Lis"
				text="Loading"
				attachments={<MediaGridSkeleton count={4} />}
			/>
		</Screen>
	);
};

export const Media: Story = {
	parameters: mobile,
	render: () => <MediaCases />,
	play: async ({ canvasElement }) => {
		onOpen.mockClear();
		const canvas = within(canvasElement);
		const pair = canvas.getByText("Two of them").closest("article");
		const tiles = within(pair as HTMLElement).getAllByRole("button", {
			name: /^Open image/,
		});
		await userEvent.click(tiles[1] as HTMLElement);
		await expect(onOpen).toHaveBeenCalledWith(1);
		const tiny = canvas
			.getByText("Tiny one")
			.closest("article")
			?.querySelector("[data-media-grid]");
		const box = (tiny as HTMLElement).getBoundingClientRect();
		await expect(box.width).toBe(160);
		await expect(box.height).toBe(120);
		const unsized = canvas
			.getByText("Unsized")
			.closest("article")
			?.querySelector("[data-media-grid]") as HTMLElement;
		await waitFor(() => {
			const measured = unsized.getBoundingClientRect();
			expect(measured.width).toBe(140);
			expect(measured.height).toBe(80);
		});
		await expect(canvas.getByText("+4")).toBeInTheDocument();
		const more = canvas.getByRole("button", { name: "Show 4 more" });
		await userEvent.click(more);
		await expect(onOpen).toHaveBeenLastCalledWith(9);
		const spoiler = canvas.getByRole("button", {
			name: "Reveal spoiler image",
		});
		const calls = onOpen.mock.calls.length;
		await userEvent.click(spoiler);
		await expect(onOpen.mock.calls.length).toBe(calls);
		await waitFor(() =>
			expect(
				canvas.queryByRole("button", { name: "Reveal spoiler image" }),
			).toBeNull(),
		);
	},
};

export const MediaDesktop: Story = {
	render: () => <MediaCases desktop />,
	play: async ({ canvasElement }) => {
		const tile = within(canvasElement).getAllByRole("button", {
			name: /^Open image/,
		})[0] as HTMLElement;
		await expectFocusRingVisible(tile);
	},
};

const FileCases = (props: { desktop?: boolean }) => {
	const [progress, setProgress] = createSignal(0.42);
	return (
		<Screen desktop={props.desktop}>
			<Message
				text="Here are the notes"
				attachments={
					<FileAttachment
						name="meeting-notes-october.pdf"
						size={2_516_582}
						href="data:text/plain,example"
					/>
				}
			/>
			<Message
				name="Lis"
				attachments={
					<FileAttachment
						name="nest-assets-final-final.zip"
						size={48_234_112}
						href="data:text/plain,example"
					/>
				}
			/>
			<Message
				name="Tim"
				attachments={
					<FileAttachment
						name="config.toml"
						size={1_204}
						href="data:text/plain,example"
					/>
				}
			/>
			<Message
				text="Recorded the birds this morning"
				attachments={
					<AudioAttachment
						name="dawn-chorus.mp3"
						size={3_948_544}
						duration={187}
						href="data:text/plain,example"
					/>
				}
			/>
			<Message
				name="Lis"
				attachments={
					<FileAttachment
						name="flight-path.mp4"
						size={83_886_080}
						progress={progress()}
						onCancel={() => setProgress(1)}
					/>
				}
			/>
			<Message name="Tim" attachments={<FileAttachmentSkeleton />} />
		</Screen>
	);
};

export const Files: Story = {
	parameters: mobile,
	render: () => <FileCases />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const play = canvas.getByRole("button", { name: "Play dawn-chorus.mp3" });
		await expect(play).toHaveAttribute("aria-pressed", "false");
		await userEvent.click(play);
		const pause = canvas.getByRole("button", { name: "Pause dawn-chorus.mp3" });
		await expect(pause).toHaveAttribute("aria-pressed", "true");
		await expect(
			pause.querySelector(
				'[data-animated-icon="play-pause"] [data-swap="second"]',
			),
		).not.toBeNull();
		await userEvent.click(pause);
		await expect(
			canvas.getByRole("button", { name: "Play dawn-chorus.mp3" }),
		).toHaveAttribute("aria-pressed", "false");
		const mute = canvas.getByRole("button", { name: "Mute dawn-chorus.mp3" });
		await userEvent.click(mute);
		await expect(
			canvas.getByRole("button", { name: "Unmute dawn-chorus.mp3" }),
		).toHaveAttribute("aria-pressed", "true");
		await expect(
			canvas.getByRole("progressbar", { name: "Uploading flight-path.mp4" }),
		).toHaveAttribute("aria-valuenow", "42");
		await userEvent.click(
			canvas.getByRole("button", { name: "Cancel upload of flight-path.mp4" }),
		);
		await expect(
			canvas.queryByRole("progressbar", { name: "Uploading flight-path.mp4" }),
		).toBeNull();
	},
};

export const FilesDesktop: Story = {
	render: () => <FileCases desktop />,
};

const SpoilerFileCases = (props: { desktop?: boolean }) => (
	<Screen desktop={props.desktop}>
		<div data-testid="spoiler-files">
			<Message
				text="Do not open this before the finale"
				attachments={
					<FileAttachment
						name="season-finale-script.pdf"
						size={1_048_576}
						href="data:text/plain,example"
						spoiler
					/>
				}
			/>
			<Message
				name="Lis"
				attachments={
					<AudioAttachment
						name="final-track.mp3"
						size={3_948_544}
						duration={187}
						href="data:text/plain,example"
						spoiler
					/>
				}
			/>
		</div>
	</Screen>
);

export const SpoilerFiles: Story = {
	parameters: mobile,
	render: () => <SpoilerFileCases />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expectNoLayoutIssues(canvas.getByTestId("spoiler-files"));
		await expect(
			canvas.queryByRole("link", { name: /season-finale-script/ }),
		).toBeNull();
		await expect(
			canvas.queryByRole("button", { name: "Play final-track.mp3" }),
		).toBeNull();
		await userEvent.click(
			canvas.getByRole("button", { name: "Reveal spoiler file" }),
		);
		await expect(
			canvas.queryByRole("button", { name: "Reveal spoiler file" }),
		).toBeNull();
		await expect(
			canvas.getByRole("link", { name: /season-finale-script/ }),
		).toHaveAttribute("download", "season-finale-script.pdf");
		await userEvent.click(
			canvas.getByRole("button", { name: "Reveal spoiler audio" }),
		);
		await expect(
			canvas.getByRole("button", { name: "Play final-track.mp3" }),
		).toBeInTheDocument();
	},
};

export const SpoilerFilesDesktop: Story = {
	render: () => <SpoilerFileCases desktop />,
};

const LinkCases = (props: { desktop?: boolean }) => (
	<Screen desktop={props.desktop}>
		<Message
			text="This is how the firehose works"
			attachments={
				<LinkEmbed
					url="https://atproto.com/guides/overview"
					siteName="AT Protocol"
					title="Protocol overview"
					description="The AT Protocol is an open, decentralized network for building social applications."
					image={fixtureImage(0, 1200, 630)}
					accent="#1185fe"
				/>
			}
		/>
		<Message
			name="Lis"
			attachments={
				<LinkEmbed
					url="https://example.org/birds/kingfisher"
					siteName="Bird atlas"
					title="Common kingfisher"
					description="A small, brightly coloured bird found near slow rivers and canals."
					image={fixtureImage(2, 600, 600)}
					accent="#2dd4bf"
				/>
			}
		/>
		<Message
			name="Tim"
			attachments={
				<LinkEmbed
					url="https://example.org/notes/release"
					title="Release notes"
					description="Everything that changed in this version, in one place."
				/>
			}
		/>
		<Message
			name="Lis"
			attachments={<LinkEmbedSkeleton imageStyle="large" />}
		/>
	</Screen>
);

export const Links: Story = {
	parameters: mobile,
	render: () => <LinkCases />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const link = canvas.getByRole("link", { name: /Protocol overview/ });
		await expect(link).toHaveAttribute(
			"href",
			"https://atproto.com/guides/overview",
		);
		await expect(link).toHaveAttribute("target", "_blank");
		await expect(link).toHaveAccessibleName("Protocol overview");
		await expect(link).toHaveAttribute("draggable", "false");
		await expect(
			canvas.getByRole("link", { name: "Release notes" }),
		).toBeInTheDocument();
		const embed = link.closest("[data-link-embed]") as HTMLElement;
		await expect(embed.querySelectorAll("a")).toHaveLength(1);
		const site = canvas.getByText("AT Protocol");
		const description = canvas.getByText(/open, decentralized network/);
		await expect(site.closest("a")).toBeNull();
		await expect(description.closest("a")).toBeNull();
		await expect(getComputedStyle(site).userSelect).toBe("text");
		await expect(getComputedStyle(description).userSelect).toBe("text");
		await expect(getComputedStyle(embed).cursor).not.toBe("pointer");
		await expect(
			getComputedStyle(link, "::after").content === "none" ||
				getComputedStyle(link, "::after").content === "normal",
		).toBe(true);
		const hit = description.getBoundingClientRect();
		await expect(
			document.elementFromPoint(hit.left + 4, hit.top + hit.height / 2),
		).toBe(description);
		link.focus();
		await expect(document.activeElement).toBe(link);
		await expect(link.className).toContain("focus-ring");
	},
};

export const LinksDesktop: Story = {
	render: () => <LinkCases desktop />,
};

const quoted: BlueskyPost = {
	author: { name: "Lis", handle: "lis.example.social" },
	time: "2h",
	text: "The crows know my face now. They wait for me at the bridge every morning. #crows",
	segments: [
		{
			text: "The crows know my face now. They wait for me at the bridge every morning. ",
		},
		{ text: "#crows", href: "https://bsky.app/search?q=%23crows" },
	],
};

const post: BlueskyPost = {
	author: { name: "Lou", handle: "lou.gg", verified: true },
	time: "1h",
	text: "Saw a kingfisher on the canal this morning with @lis.example.social. Bright blue, gone in a second. Photos: birdwatch.example/canal-kingf...",
	segments: [
		{ text: "Saw a kingfisher on the canal this morning with " },
		{
			text: "@lis.example.social",
			href: "https://bsky.app/profile/did:plc:lis",
		},
		{ text: ". Bright blue, gone in a second. Photos: " },
		{
			text: "birdwatch.example/canal-kingf...",
			href: "https://birdwatch.example/canal-kingfisher",
		},
	],
	url: "https://bsky.app/profile/lou.gg",
	images: [fixtureImage(4, 1600, 1000), fixtureImage(1, 900, 1200)],
	quote: quoted,
	stats: { replies: 12, reposts: 48, likes: 1_204 },
};

const BlueskyCases = (props: { desktop?: boolean }) => (
	<Screen desktop={props.desktop}>
		<Message
			text="Look at this"
			attachments={<BlueskyPostEmbed post={post} />}
		/>
		<Message
			name="Tim"
			attachments={
				<BlueskyPostEmbed
					post={{
						...quoted,
						replyTo: "lou.gg",
						stats: { replies: 2, reposts: 0, likes: 31 },
					}}
				/>
			}
		/>
		<Message name="Lis" attachments={<BlueskyPostEmbedSkeleton />} />
	</Screen>
);

export const Bluesky: Story = {
	parameters: mobile,
	render: () => <BlueskyCases />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const article = canvas.getByRole("article", { name: "Post by Lou" });
		await expect(
			within(article).getAllByRole("link", { name: "Open on Bluesky" })[0],
		).toHaveAttribute("href", "https://bsky.app/profile/lou.gg");
		await expect(within(article).getByText("1.2K")).toBeInTheDocument();
		await expect(
			within(article).getByRole("link", { name: "@lis.example.social" }),
		).toHaveAttribute("href", "https://bsky.app/profile/did:plc:lis");
		await expect(
			within(article).getByRole("link", {
				name: "birdwatch.example/canal-kingf...",
			}),
		).toHaveAttribute("href", "https://birdwatch.example/canal-kingfisher");
		await expect(
			within(article).getByRole("link", { name: "#crows" }),
		).toHaveAttribute("href", "https://bsky.app/search?q=%23crows");
		await expectNoLayoutIssues(canvasElement);
	},
};

export const BlueskyDesktop: Story = {
	render: () => <BlueskyCases desktop />,
};

const clients: BlueskyEmbedClient[] = [
	{ id: "mu", name: "Mu Social", accentColor: "#db4aa6" },
	{ id: "northsky", name: "Northsky", accentColor: "#8a5fe5" },
	{ id: "witchsky", name: "Witchsky", accentColor: "#ed5345" },
	{ id: "custom", name: "sky.example.org", accentColor: "var(--primary)" },
];

const BlueskyClientCases = (props: { desktop?: boolean }) => (
	<Screen desktop={props.desktop}>
		{clients.map((client) => (
			<Message
				name={client.name}
				attachments={
					<BlueskyPostEmbed
						post={{
							...quoted,
							author: { name: client.name, handle: "lou.gg" },
							url: `https://${client.id === "custom" ? client.name : "bsky.app"}/profile/lou.gg/post/3kingfisher`,
						}}
						client={client}
					/>
				}
			/>
		))}
	</Screen>
);

export const BlueskyClients: Story = {
	parameters: mobile,
	render: () => <BlueskyClientCases />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const mu = canvas.getByRole("link", { name: "Open on Mu Social" });
		await expect(mu.querySelector("[data-bluesky-client]")).toHaveAttribute(
			"data-bluesky-client",
			"mu",
		);
		await expect(mu.style.color).not.toBe("");
		const custom = canvas.getByRole("link", {
			name: "Open on sky.example.org",
		});
		await expect(custom.querySelector("[data-bluesky-client]")).toBeNull();
		await expect(custom.querySelector("svg")).not.toBeNull();
		await expect(
			canvas.queryByRole("link", { name: "Open on Bluesky" }),
		).toBeNull();
		await expectNoLayoutIssues(canvasElement);
	},
};

export const BlueskyClientsDesktop: Story = {
	render: () => <BlueskyClientCases desktop />,
};

const ContextCases = (props: { desktop?: boolean }) => (
	<Screen desktop={props.desktop}>
		<Message
			attachments={
				<ForwardedMessage
					time="Yesterday at 18:12"
					source={{ channel: "birdwatching", href: "#birdwatching" }}
				>
					Did you feed them once? They do not forget faces.
				</ForwardedMessage>
			}
		/>
		<Message
			name="Tim"
			attachments={
				<ForwardedMessage
					time="09:10"
					source={{
						channel: "general",
						space: "Colibri Social Flock",
						href: "#general",
					}}
				>
					<span>Here are the photos</span>
					<MediaGrid items={fixtureImages(2)} />
				</ForwardedMessage>
			}
		/>
		<Message
			name="Lis"
			attachments={
				<ForwardedMessage time="12.03.26, 18:30">
					This came from somewhere private.
				</ForwardedMessage>
			}
		/>
		<Message
			name="Tim"
			attachments={
				<HiddenMessage reason="moderator">
					<span>This message broke the rules.</span>
				</HiddenMessage>
			}
		/>
		<Message
			name="Kris"
			attachments={
				<HiddenMessage reason="blocked">
					<span>You blocked me but here I am.</span>
				</HiddenMessage>
			}
		/>
	</Screen>
);

export const Context: Story = {
	parameters: mobile,
	render: () => <ContextCases />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.queryByText("This message broke the rules."),
		).toBeNull();
		const shows = canvas.getAllByRole("button", { name: "Show" });
		await userEvent.click(shows[0] as HTMLElement);
		await expect(
			canvas.getByText("This message broke the rules."),
		).toBeInTheDocument();
		await userEvent.click(canvas.getByRole("button", { name: "Hide again" }));
		await expect(
			canvas.queryByText("This message broke the rules."),
		).toBeNull();
		await expect(
			canvas.getByText("From a private channel"),
		).toBeInTheDocument();
		await expect(
			canvas.getByRole("link", {
				name: /From #general in Colibri Social Flock/,
			}),
		).toHaveAttribute("href", "#general");
	},
};

export const ContextDesktop: Story = {
	render: () => <ContextCases desktop />,
};

const Pair = (props: { real: JSX.Element; skeleton: JSX.Element }) => (
	<div data-pair-group="" class="flex flex-col gap-4">
		<div data-pair="real">{props.real}</div>
		<div data-pair="skeleton">{props.skeleton}</div>
	</div>
);

export const SkeletonParity: Story = {
	parameters: mobile,
	render: () => (
		<div class="flex flex-col gap-8 bg-background p-4 text-foreground">
			<Pair
				real={<MediaGrid items={fixtureImages(4)} />}
				skeleton={<MediaGridSkeleton count={4} />}
			/>
			<Pair
				real={<MediaGrid items={[fixtureImage(0, 1600, 900)]} />}
				skeleton={<MediaGridSkeleton items={[{ width: 1600, height: 900 }]} />}
			/>
			<Pair
				real={
					<FileAttachment
						name="meeting-notes.pdf"
						size={2_516_582}
						href="data:text/plain,example"
					/>
				}
				skeleton={<FileAttachmentSkeleton />}
			/>
			<Pair
				real={
					<LinkEmbed
						url="https://atproto.com/guides/overview"
						siteName="AT Protocol"
						title="Protocol overview"
						description="The AT Protocol is an open, decentralized network for building social applications that lasts."
						image={fixtureImage(0, 1200, 630)}
					/>
				}
				skeleton={<LinkEmbedSkeleton imageStyle="large" />}
			/>
			<Pair
				real={
					<LinkEmbed
						url="https://example.org/notes"
						title="Release notes"
						description="Everything that changed."
					/>
				}
				skeleton={<LinkEmbedSkeleton descriptionLines={1} />}
			/>
			<Pair
				real={
					<BlueskyPostEmbed
						post={{
							author: { name: "Lou", handle: "lou.gg" },
							time: "1h",
							text: "Saw a kingfisher on the canal this morning, bright blue and gone in a second. Still thinking about it.",
							stats: { replies: 1, reposts: 2, likes: 3 },
						}}
					/>
				}
				skeleton={<BlueskyPostEmbedSkeleton lines={3} />}
			/>
		</div>
	),
	play: async ({ canvasElement }) => {
		const groups = canvasElement.querySelectorAll("[data-pair-group]");
		for (const [index, group] of Array.from(groups).entries()) {
			const box = (kind: string) =>
				group
					.querySelector(`[data-pair=${kind}]`)
					?.firstElementChild?.getBoundingClientRect();
			const real = box("real");
			const skeleton = box("skeleton");
			await expect(real && skeleton).toBeTruthy();
			if (!real || !skeleton) continue;
			await expect({
				index,
				width: Math.round(skeleton.width),
				height: Math.round(skeleton.height),
			}).toEqual({
				index,
				width: Math.round(real.width),
				height: Math.round(real.height),
			});
		}
	},
};

export const ForwardSourceOpens: Story = {
	render: () => {
		const [opened, setOpened] = createSignal(0);
		return (
			<Screen>
				<ForwardedMessage
					time="09:10"
					source={{
						channel: "general",
						space: "Colibri Social Flock",
						onOpen: () => setOpened((count) => count + 1),
					}}
				>
					Here are the photos
				</ForwardedMessage>
				<ForwardedMessage time="12.03.26, 18:30">
					This came from somewhere private.
				</ForwardedMessage>
				<span data-opened={opened()} />
			</Screen>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const chip = canvas.getByRole("button", {
			name: /From #general in Colibri Social Flock/,
		});
		await userEvent.click(chip);
		await expect(
			canvasElement.querySelector("[data-opened]")?.getAttribute("data-opened"),
		).toBe("1");
		await expect(
			canvas.queryByRole("button", { name: /private channel/ }),
		).not.toBeInTheDocument();
		await expect(canvas.getByText("From a private channel")).toBeVisible();
	},
};

export const LinkEmbedImageOpens: Story = {
	render: () => {
		const [opened, setOpened] = createSignal(0);
		return (
			<Screen>
				<LinkEmbed
					url="https://atproto.com/guides/overview"
					siteName="AT Protocol"
					title="Protocol overview"
					image={fixtureImage(1, 1200, 628)}
					onOpenImage={() => setOpened((count) => count + 1)}
				/>
				<span data-opened={opened()} />
			</Screen>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const before = window.location.href;
		const image = canvas.getByRole("button", {
			name: "Open image from AT Protocol",
		});
		await userEvent.click(image);
		await expect(
			canvasElement.querySelector("[data-opened]")?.getAttribute("data-opened"),
		).toBe("1");
		await expect(window.location.href).toBe(before);
		await expect(image.closest("a")).toBeNull();
		await expect(
			canvas.getByRole("link", { name: /Protocol overview/ }),
		).toHaveAttribute("href", "https://atproto.com/guides/overview");
	},
};

export const EmbedsRemovable: Story = {
	render: () => {
		const [removed, setRemoved] = createSignal<string[]>([]);
		const record = (name: string) => (event: MouseEvent) =>
			setRemoved((list) => [
				...list,
				`${name}${event.shiftKey ? "+shift" : ""}`,
			]);
		return (
			<Screen desktop>
				<Message
					attachments={
						<LinkEmbed
							url="https://atproto.com/guides/overview"
							siteName="AT Protocol"
							title="Protocol overview with a title long enough to wrap onto a second line"
							description="The AT Protocol is an open, decentralized network for building social applications."
							image={fixtureImage(2, 600, 600)}
							onRemove={record("link")}
						/>
					}
				/>
				<Message
					name="Tim"
					attachments={
						<BlueskyPostEmbed post={post} onRemove={record("bluesky")} />
					}
				/>
				<span data-removed={removed().join(",")} />
			</Screen>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const removed = () =>
			canvasElement
				.querySelector("[data-removed]")
				?.getAttribute("data-removed");
		const [linkRemove, blueskyRemove] = canvas.getAllByRole("button", {
			name: "Remove link preview",
		});
		const before = window.location.href;
		await userEvent.click(linkRemove as HTMLElement);
		await expect(removed()).toBe("link");
		await expect(window.location.href).toBe(before);
		blueskyRemove?.dispatchEvent(
			new MouseEvent("click", { bubbles: true, shiftKey: true }),
		);
		await expect(removed()).toBe("link,bluesky+shift");
		const frame = linkRemove?.closest("[data-link-embed]") as HTMLElement;
		const box = frame.getBoundingClientRect();
		const button = (linkRemove as HTMLElement).getBoundingClientRect();
		await expect(button.right).toBeLessThanOrEqual(box.right);
		await expect(button.top).toBeGreaterThanOrEqual(box.top);
	},
};

export const MediaUploading: Story = {
	render: () => (
		<div class="w-[402px] p-4" data-testid="uploading-host">
			<MediaGrid
				items={fixtureImages(2).map((item, index) => ({
					...item,
					name: `photo-${index + 1}.jpg`,
					progress: index === 0 ? 0.4 : undefined,
				}))}
			/>
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const bar = await canvas.findByRole("progressbar", {
			name: "Uploading photo-1.jpg",
		});
		await expect(bar).toHaveAttribute("aria-valuenow", "40");
		await expect(
			canvas.queryByRole("progressbar", { name: "Uploading photo-2.jpg" }),
		).toBeNull();
		await expectNoLayoutIssues(canvas.getByTestId("uploading-host"));
	},
};

const BROKEN_IMAGE = "data:image/png;base64,AAAA";
const BROKEN_VIDEO = "data:video/mp4;base64,AAAAAAAAAAAA";
const mediaError = fn();
const mediaRetry = fn();

const RefreshingGrid = () => {
	const [items, setItems] = createSignal([
		fixtureImage(0, 1600, 1000, { src: BROKEN_IMAGE, name: "refreshes.png" }),
		fixtureImage(1, 1600, 1000),
	]);
	return (
		<MediaGrid
			items={items()}
			onMediaError={async (index) => {
				mediaError(index);
				await new Promise((resolve) => setTimeout(resolve, 150));
				setItems((list) =>
					list.map((item, at) =>
						at === index ? fixtureImage(0, 1600, 1000) : item,
					),
				);
			}}
		/>
	);
};

const MediaErrorCases = (props: { desktop?: boolean }) => (
	<Screen desktop={props.desktop}>
		<Message
			text="This one failed and stays broken"
			attachments={
				<MediaGrid
					items={[
						fixtureImage(0, 1600, 1000, {
							src: BROKEN_IMAGE,
							name: "broken.png",
						}),
					]}
					onMediaError={(index) => mediaError(index)}
					onRetry={mediaRetry}
				/>
			}
		/>
		<Message
			name="Lis"
			text="A broken video next to a working photo"
			attachments={
				<MediaGrid
					items={[
						fixtureImage(1, 1280, 720, {
							kind: "video",
							mimeType: "video/mp4",
							src: BROKEN_VIDEO,
							name: "clip.mp4",
						}),
						fixtureImage(2, 1600, 1000),
					]}
					onMediaError={(index) => mediaError(index)}
					onRetry={mediaRetry}
				/>
			}
		/>
		<Message
			name="Tim"
			text="This one gets a fresh link and recovers"
			attachments={<RefreshingGrid />}
		/>
	</Screen>
);

const brokenTileIn = async (canvasElement: HTMLElement, text: string) => {
	const article = within(canvasElement).getByText(text).closest("article");
	return waitFor(
		() => {
			const tile = (article as HTMLElement).querySelector(
				"[data-media-status='broken']",
			);
			expect(tile).not.toBeNull();
			return tile as HTMLElement;
		},
		{ timeout: 3000 },
	);
};

export const MediaError: Story = {
	parameters: mobile,
	render: () => <MediaErrorCases />,
	play: async ({ canvasElement }) => {
		mediaError.mockClear();
		mediaRetry.mockClear();
		const canvas = within(canvasElement);
		const image = await brokenTileIn(
			canvasElement,
			"This one failed and stays broken",
		);
		await expect(image).toHaveTextContent("Couldn't load this image");
		await expect(image.querySelector("[data-skeleton]")).toBeNull();
		await expect(image.querySelector("img")).toBeNull();
		await expect(image.querySelector("a[download]")).toBeNull();
		const video = await brokenTileIn(
			canvasElement,
			"A broken video next to a working photo",
		);
		await expect(video).toHaveTextContent("Couldn't load this video");
		await expect(video.querySelector("[data-video-player]")).toBeNull();
		const calls = mediaError.mock.calls.length;
		await userEvent.click(
			within(image).getByRole("button", { name: "Try again" }),
		);
		await expect(mediaRetry).toHaveBeenCalledWith(0);
		await waitFor(() =>
			expect(mediaError.mock.calls.length).toBeGreaterThan(calls),
		);
		await brokenTileIn(canvasElement, "This one failed and stays broken");
		const recovered = canvas
			.getByText("This one gets a fresh link and recovers")
			.closest("article") as HTMLElement;
		await waitFor(
			() => {
				const tile = recovered.querySelector("[data-media-tile]");
				expect(tile).toHaveAttribute("data-media-status", "ok");
				expect(tile?.querySelector("img")?.getAttribute("src")).not.toBe(
					BROKEN_IMAGE,
				);
			},
			{ timeout: 3000 },
		);
		await expect(recovered.querySelector("[data-media-error]")).toBeNull();
		await expectNoLayoutIssues(canvasElement);
	},
};

export const MediaErrorDesktop: Story = {
	render: () => <MediaErrorCases desktop />,
	play: async ({ canvasElement }) => {
		const tile = await brokenTileIn(
			canvasElement,
			"This one failed and stays broken",
		);
		await expectFocusRingVisible(
			within(tile).getByRole("button", { name: "Try again" }),
		);
	},
};

const REBUILD_PHOTO = fixtureImage(5, 1600, 1000);
const REBUILD_POSTER = fixtureImage(6, 1600, 1000).src;

const rebuiltItems = (videoSrc: string): MediaItem[] => [
	{ ...REBUILD_PHOTO },
	{
		src: videoSrc,
		kind: "video",
		mimeType: "video/webm",
		poster: REBUILD_POSTER,
		spoiler: true,
		width: 1600,
		height: 1000,
		name: "clip.webm",
	},
];

export const MediaKeepsTilesOnRebuild: Story = {
	parameters: mobile,
	render: () => {
		const [items, setItems] = createSignal(rebuiltItems("clip-a.webm"));
		return (
			<Screen>
				<button
					type="button"
					onClick={() => setItems(rebuiltItems("clip-b.webm"))}
				>
					Refresh links
				</button>
				<Message
					text="A photo and a spoilered clip"
					attachments={<MediaGrid items={items()} />}
				/>
			</Screen>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const images = () =>
			Array.from(canvasElement.querySelectorAll("[data-media-tile] img"));
		const allLoaded = () => {
			const found = images();
			expect(found).toHaveLength(2);
			for (const image of found)
				expect(image.className).toContain("opacity-100");
			expect(canvasElement.querySelector("[data-skeleton]")).toBeNull();
		};
		await waitFor(allLoaded, { timeout: 3000 });
		const before = images();
		await userEvent.click(
			canvas.getByRole("button", { name: "Refresh links" }),
		);
		await new Promise((resolve) => setTimeout(resolve, 100));
		allLoaded();
		await expect(images()).toEqual(before);
		await expect(images()[0]).toBe(before[0]);
		await expect(images()[1]).toBe(before[1]);
	},
};

const PosterlessVideo = () => {
	const clip = createStoryClip(3);
	return (
		<MediaGrid
			items={[
				fixtureImage(3, 640, 360, {
					kind: "video",
					mimeType: "video/webm",
					src: clip()?.src ?? "",
					spoiler: true,
					name: "spoiler.webm",
				}),
				fixtureImage(4, 1600, 1000),
			]}
		/>
	);
};

export const PosterlessVideoFrame: Story = {
	parameters: mobile,
	render: () => (
		<Screen>
			<Message
				text="A spoilered video without a poster"
				attachments={<PosterlessVideo />}
			/>
		</Screen>
	),
	play: async ({ canvasElement }) => {
		const tile = await waitFor(
			() => {
				const found = canvasElement.querySelector(
					"[data-media-tile][data-index='0'] video",
				);
				expect(found).not.toBeNull();
				return found as HTMLVideoElement;
			},
			{ timeout: 8000 },
		);
		await expect(
			canvasElement.querySelector("[data-media-tile][data-index='0'] img"),
		).toBeNull();
		await waitFor(() => expect(tile.readyState).toBeGreaterThanOrEqual(2), {
			timeout: 3000,
		});
		await expect(tile.querySelector("source")?.getAttribute("src")).toMatch(
			/#t=0\.001$/,
		);
	},
};

const FX_ACCENT = "#6363ff";
const providerIcon = paintImage(32, 32, ["#6363ff", "#1e1b4b"]);

const longBody: RichTextBlock[] = [
	{
		kind: "paragraph",
		spans: [
			{
				text: "Spent the weekend rebuilding the bird feeder. It now has a roof, a perch on both sides and a tray that drains when it rains.\nThe sparrows moved in within an hour.",
			},
		],
	},
	{
		kind: "paragraph",
		spans: [
			{ text: "Plans are on " },
			{ text: "example.org/feeder", href: "https://example.org/feeder" },
			{
				text: " if anyone wants to build one. It takes about two hours and one plank of pine. Bring a drill, sandpaper and patience for the roof angle, which took me three tries.",
			},
		],
	},
	{
		kind: "paragraph",
		spans: [{ text: "Next up is a bath for them. Suggestions welcome!" }],
	},
];

const SocialPostCases = (props: { desktop?: boolean }) => {
	const clip = createStoryClip(3);
	return (
		<Screen desktop={props.desktop}>
			<div data-testid="social-posts">
				<Message
					attachments={
						<SocialPostEmbed
							url="https://fixupx.com/lis/status/1/en"
							accent={FX_ACCENT}
							author={{
								name: "Lis",
								handle: "lis",
								url: "https://x.com/lis",
								avatarSrc: fixtureImage(3, 200, 200).src,
							}}
							body={[]}
							quote={{
								url: "https://x.com/frank/status/2",
								author: { name: "Frank", handle: "frank" },
								time: "1d",
								translatedFrom: "zh",
								body: [
									{
										kind: "paragraph",
										spans: [{ text: "Outlook has gone crazy" }],
									},
								],
							}}
							stats={{ replies: 18, reposts: 42, likes: 373, views: 12_428 }}
							media={
								clip()
									? [
											{
												src: clip()?.src ?? "",
												poster: clip()?.poster,
												kind: "video",
												mimeType: "video/webm",
												width: 720,
												height: 1564,
											},
										]
									: []
							}
							footer={{
								label: "FixupX",
								url: "https://fixupx.com",
								iconSrc: providerIcon,
								time: "10/14/26, 11:19 AM",
							}}
							onOpenMedia={onOpen}
						/>
					}
				/>
				<Message
					name="Tim"
					attachments={
						<SocialPostEmbed
							url="https://social.example/@birds/2"
							accent="#181820"
							author={{
								name: "Bird atlas",
								handle: "birds@social.example",
								url: "https://social.example/@birds",
							}}
							body={[
								{
									kind: "paragraph",
									spans: [
										{ text: "Four visitors this morning, spotted by " },
										{
											text: "@lis",
											href: "https://social.example/@lis",
										},
										{ text: "." },
									],
								},
								{
									kind: "quote",
									spans: [{ text: "<script>alert(1)</script> stays text" }],
								},
							]}
							stats={{ replies: 3, reposts: 12, likes: 80 }}
							media={fixtureImages(4)}
							footer={{ label: "social.example", time: "10/17/26, 6:22 PM" }}
							onOpenMedia={onOpen}
						/>
					}
				/>
				<Message
					name="Lis"
					attachments={
						<SocialPostEmbed
							url="https://social.example/@lis/3"
							author={{ name: "Lis", handle: "lis@social.example" }}
							body={longBody}
							footer={{ label: "social.example" }}
						/>
					}
				/>
				<Message
					name="Tim"
					attachments={
						<SocialPostEmbed
							url="https://social.example/@tim/4"
							author={{ name: "Tim", handle: "tim@social.example" }}
							contentWarning="Spiders, close up"
							body={[
								{
									kind: "paragraph",
									spans: [{ text: "Found this one in the shed." }],
								},
							]}
							media={[fixtureImage(5, 1200, 900)]}
							footer={{ label: "social.example" }}
						/>
					}
				/>
				<Message
					name="Lis"
					attachments={
						<SocialPostEmbed
							url="https://social.example/@lis/5"
							author={{ name: "Lis", handle: "lis@social.example" }}
							body={[
								{ kind: "paragraph", spans: [{ text: "Loop of the feeder" }] },
							]}
							media={
								clip()
									? [
											{
												src: clip()?.src ?? "",
												poster: clip()?.poster,
												kind: "gif",
												mimeType: "video/webm",
												width: 640,
												height: 360,
											},
										]
									: []
							}
							footer={{ label: "social.example" }}
						/>
					}
				/>
			</div>
		</Screen>
	);
};

export const SocialPosts: Story = {
	parameters: mobile,
	render: () => <SocialPostCases />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const host = canvas.getByTestId("social-posts");
		const author = canvas.getAllByRole("link", { name: /Lis \(@lis\)/ })[0];
		await expect(author).toHaveAttribute("href", "https://x.com/lis");
		await expect(author).toHaveAttribute("target", "_blank");
		await expect(
			canvas.getByText("Outlook has gone crazy"),
		).toBeInTheDocument();
		await expect(
			canvas.getByText("Translated from Chinese"),
		).toBeInTheDocument();
		await expect(canvas.getByText("12K")).toBeInTheDocument();
		await expect(canvas.getAllByText("Views")[0]).toHaveClass("sr-only");
		await expect(canvas.getByRole("link", { name: "FixupX" })).toHaveAttribute(
			"href",
			"https://fixupx.com",
		);
		await expect(
			canvas.getByText("<script>alert(1)</script> stays text"),
		).toBeInTheDocument();
		await expect(host.querySelector("script")).toBeNull();
		await expect(
			canvas.getByRole("link", { name: "@lis" }).closest("blockquote"),
		).toBeNull();

		const more = canvas.getByRole("button", { name: "Show more" });
		const body = more.parentElement?.querySelector(
			"[data-rich-body]",
		) as HTMLElement;
		const clamped = body.getBoundingClientRect().height;
		await userEvent.click(more);
		await waitFor(() =>
			expect(body.getBoundingClientRect().height).toBeGreaterThan(clamped),
		);
		await expect(
			canvas.getByRole("button", { name: "Show less" }),
		).toBeVisible();

		await expect(canvas.getByText("Spiders, close up")).toBeVisible();
		const reveal = canvas.getByRole("button", {
			name: "Reveal sensitive post",
		});
		await expect(
			canvas.getByText("Found this one in the shed.").closest("[inert]"),
		).not.toBeNull();
		await userEvent.click(reveal);
		await waitFor(() =>
			expect(
				canvas.getByText("Found this one in the shed.").closest("[inert]"),
			).toBeNull(),
		);

		await waitFor(() =>
			expect(host.querySelector("video[loop]")).not.toBeNull(),
		);
		await expectNoLayoutIssues(host);
	},
};

export const SocialPostsDesktop: Story = {
	render: () => <SocialPostCases desktop />,
	play: async ({ canvasElement }) => {
		const host = within(canvasElement).getByTestId("social-posts");
		for (const card of host.querySelectorAll<HTMLElement>(
			"[data-social-embed]",
		)) {
			await expect(card.getBoundingClientRect().width).toBeLessThanOrEqual(416);
		}
		await expectNoLayoutIssues(host);
	},
};

const RichLinkCases = (props: { desktop?: boolean }) => {
	const clip = createStoryClip(3);
	return (
		<Screen desktop={props.desktop}>
			<div data-testid="rich-links">
				<Message
					attachments={
						<LinkEmbed
							url="https://videos.example/watch/42"
							accent="#e11d48"
							provider={{
								name: "Example Videos",
								url: "https://videos.example",
								iconSrc: providerIcon,
							}}
							author={{
								name: "Bird atlas",
								url: "https://videos.example/birds",
								avatarSrc: fixtureImage(1, 200, 200).src,
							}}
							title="Kingfisher dive, slowed down"
							description="A kingfisher catching a fish, filmed at 240 frames per second."
							media={
								clip()
									? [
											{
												src: clip()?.src ?? "",
												poster: clip()?.poster,
												kind: "video",
												mimeType: "video/webm",
												width: 1280,
												height: 720,
											},
										]
									: []
							}
							onOpenMedia={onOpen}
						/>
					}
				/>
				<Message
					name="Lis"
					attachments={
						<LinkEmbed
							url="https://news.example/birds"
							accent="#1e2327"
							provider={{ name: "News", iconSrc: providerIcon }}
							title="Birds return early this spring"
							description="Ringing stations report arrivals two weeks ahead of the average."
							image={fixtureImage(2, 1200, 630)}
							imageStyle="thumbnail"
						/>
					}
				/>
				<Message
					name="Tim"
					attachments={
						<LinkEmbed
							url="https://gallery.example/set/9"
							siteName="Gallery"
							title="Morning at the lake"
							media={fixtureImages(3)}
							onOpenMedia={onOpen}
						/>
					}
				/>
			</div>
		</Screen>
	);
};

export const RichLinks: Story = {
	parameters: mobile,
	render: () => <RichLinkCases />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const host = canvas.getByTestId("rich-links");
		await expect(
			canvas.getByRole("link", { name: "Example Videos" }),
		).toHaveAttribute("href", "https://videos.example");
		await expect(
			canvas.getByRole("link", { name: "Bird atlas" }),
		).toHaveAttribute("href", "https://videos.example/birds");
		const bar = host.querySelector<HTMLElement>(
			"[data-link-embed] > span[aria-hidden]",
		);
		await expect(bar?.style.background).toBe("rgb(225, 29, 72)");
		const thumbnail = canvas
			.getByText("Birds return early this spring")
			.closest("[data-link-embed]") as HTMLElement;
		await expect(thumbnail.querySelector(".size-18")).not.toBeNull();
		await waitFor(() => expect(host.querySelector("video")).not.toBeNull());
		await expect(
			canvas
				.getByText("Morning at the lake")
				.closest("[data-link-embed]")
				?.querySelectorAll("[data-media-tile]"),
		).toHaveLength(3);
		await expectNoLayoutIssues(host);
	},
};

export const RichLinksDesktop: Story = {
	render: () => <RichLinkCases desktop />,
};

const resigned = (src: string, signature: string) =>
	`${src}?exp=${signature.length}&sig=${signature}`;

const ResignedVideo = () => {
	const clip = createStoryClip(3);
	const [signature, setSignature] = createSignal<string>();
	const items = (): MediaItem[] => {
		const value = clip();
		if (!value) return [];
		const tag = signature();
		return [
			{
				src: tag ? resigned(value.src, tag) : value.src,
				poster: value.poster,
				kind: "video",
				mimeType: "video/webm",
				width: 640,
				height: 360,
				name: "clip.webm",
			},
		];
	};
	return (
		<Screen>
			<button type="button" onClick={() => setSignature("b7f2")}>
				Re-sign link
			</button>
			<Show when={clip()}>
				<Message
					text="A clip whose link gets re-signed"
					attachments={<MediaGrid items={items()} />}
				/>
			</Show>
		</Screen>
	);
};

export const MediaVideoKeepsPlaybackOnResign: Story = {
	parameters: mobile,
	render: () => <ResignedVideo />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const video = await waitFor(
			() => {
				const found = canvasElement.querySelector<HTMLVideoElement>(
					"[data-media-tile] [data-video-player] video",
				);
				expect(found).not.toBeNull();
				expect(Number.isFinite(found?.duration)).toBe(true);
				expect(found?.seeking).toBe(false);
				return found as HTMLVideoElement;
			},
			{ timeout: 8000 },
		);
		const resumeAt = Math.round(video.duration * 50) / 100;
		video.currentTime = resumeAt;
		await waitFor(() => expect(video.currentTime).toBeCloseTo(resumeAt, 1));
		await userEvent.click(canvas.getByRole("button", { name: "Re-sign link" }));
		await new Promise((resolve) => setTimeout(resolve, 300));
		await expect(
			canvasElement.querySelector(
				"[data-media-tile] [data-video-player] video",
			),
		).toBe(video);
		await expect(video.currentTime).toBeCloseTo(resumeAt, 1);
		await expect(video.error).toBeNull();
		await expect(
			canvasElement.querySelector("[data-media-tile]"),
		).toHaveAttribute("data-media-status", "ok");
		await expect(canvasElement.querySelector("[data-skeleton]")).toBeNull();
	},
};

export const MediaSingleContains: Story = {
	parameters: mobile,
	render: () => (
		<Screen>
			<div data-testid="fit-host">
				<Message
					text="A panorama wider than the tile allows"
					attachments={<MediaGrid items={[fixtureImage(0, 4000, 400)]} />}
				/>
				<Message
					name="Lis"
					text="Two in a grid"
					attachments={<MediaGrid items={fixtureImages(2)} />}
				/>
			</div>
		</Screen>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const imageIn = (text: string) =>
			waitFor(() => {
				const image = canvas
					.getByText(text)
					.closest("article")
					?.querySelector<HTMLImageElement>("[data-media-tile] img");
				expect(image?.className).toContain("opacity-100");
				return image as HTMLImageElement;
			});
		const single = await imageIn("A panorama wider than the tile allows");
		await expect(getComputedStyle(single).objectFit).toBe("contain");
		const tile = single.closest("[data-media-tile]") as HTMLElement;
		await expect(getComputedStyle(tile).backgroundColor).not.toBe(
			"rgba(0, 0, 0, 0)",
		);
		const grid = await imageIn("Two in a grid");
		await expect(getComputedStyle(grid).objectFit).toBe("cover");
		await expectNoLayoutIssues(canvas.getByTestId("fit-host"));
	},
};

const MISSING_EMBED_IMAGE = "/colibri-missing-embed-image.png";

export const LinkEmbedImageFallback: Story = {
	render: () => (
		<Screen>
			<div data-testid="embed-images" class="flex flex-col gap-3 px-4">
				<LinkEmbed
					url="https://userinput.app/board"
					siteName="UserInput"
					title="Feedback board"
					image={{ src: MISSING_EMBED_IMAGE, width: 1200, height: 628 }}
					onOpenImage={() => undefined}
				/>
				<LinkEmbed
					url="https://atproto.com/guides/overview"
					siteName="AT Protocol"
					title="Protocol overview"
					image={fixtureImage(1, 1200, 628)}
					onOpenImage={() => undefined}
				/>
			</div>
		</Screen>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const missing = canvas
			.getByText("Feedback board")
			.closest("[data-link-embed]") as HTMLElement;
		const srcOf = () => missing.querySelector("img")?.getAttribute("src");
		await waitFor(() => expect(srcOf()).toContain("colibri-retry=1"), {
			timeout: 3000,
		});
		await waitFor(
			() => {
				expect(
					missing.querySelector("[data-embed-image-broken]"),
				).not.toBeNull();
				expect(missing.querySelector("img")).toBeNull();
			},
			{ timeout: 5000 },
		);
		await expect(
			canvas.queryByRole("button", { name: "Open image from UserInput" }),
		).toBeNull();
		const working = canvas.getByRole("button", {
			name: "Open image from AT Protocol",
		});
		const image = working.querySelector("img") as HTMLImageElement;
		await expect(getComputedStyle(image).objectFit).toBe("contain");
		await expect(image.getAttribute("src")).not.toContain("colibri-retry");
		await expectNoLayoutIssues(canvas.getByTestId("embed-images"));
	},
};

const wideBanner = fixtureImage(4, 1500, 500);

export const LinkEmbedImageFitsRatio: Story = {
	render: () => (
		<Screen>
			<div data-testid="embed-ratios" class="flex flex-col gap-3 px-4">
				<LinkEmbed
					url="https://colibri.social/blog/banner"
					siteName="Colibri"
					title="Known size banner"
					imageStyle="large"
					image={{ src: wideBanner.src, width: 1500, height: 500 }}
					onOpenImage={() => undefined}
				/>
				<LinkEmbed
					url="https://colibri.social/blog/unsized"
					siteName="Colibri"
					title="Unsized banner"
					imageStyle="large"
					image={{ src: wideBanner.src }}
				/>
				<LinkEmbed
					url="https://colibri.social/blog/tall"
					siteName="Colibri"
					title="Tall poster"
					imageStyle="large"
					image={fixtureImage(2, 600, 1200)}
					onOpenImage={() => undefined}
				/>
			</div>
		</Screen>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const frameOf = (title: string) => {
			const embed = canvas
				.getByText(title)
				.closest("[data-link-embed]") as HTMLElement;
			return (embed.querySelector("[data-media-tile]") ??
				embed.querySelector("img")) as HTMLElement;
		};
		const ratioOf = (element: HTMLElement) => {
			const box = element.getBoundingClientRect();
			return box.width / box.height;
		};
		await expect(ratioOf(frameOf("Known size banner"))).toBeCloseTo(3, 1);
		await waitFor(() =>
			expect(ratioOf(frameOf("Unsized banner"))).toBeCloseTo(3, 1),
		);
		const tall = frameOf("Tall poster").getBoundingClientRect();
		await expect(tall.height).toBeLessThanOrEqual(320.5);
		const tallEmbed = canvas
			.getByText("Tall poster")
			.closest("[data-link-embed]") as HTMLElement;
		await expect(tallEmbed.getBoundingClientRect().width).toBeCloseTo(240, 0);
		const wideEmbed = canvas
			.getByText("Known size banner")
			.closest("[data-link-embed]") as HTMLElement;
		await expect(wideEmbed.getBoundingClientRect().width).toBeGreaterThan(240);
		await expectNoLayoutIssues(canvas.getByTestId("embed-ratios"));
	},
};
