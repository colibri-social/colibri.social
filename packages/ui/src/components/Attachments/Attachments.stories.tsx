import { createSignal, type JSX } from "solid-js";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectFocusRingVisible } from "../../foundations/focus-ring-test";
import { createStoryClip } from "../Media/story-clip";
import { MessageRow } from "../Message/MessageRow";
import {
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
import { MediaGrid, MediaGridSkeleton } from "./MediaGrid";
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
		await expect(
			canvas.getByRole("link", { name: /^example\.org Release notes/ }),
		).toBeInTheDocument();
	},
};

export const LinksDesktop: Story = {
	render: () => <LinkCases desktop />,
};

const quoted: BlueskyPost = {
	author: { name: "Lis", handle: "lis.example.social" },
	time: "2h",
	text: "The crows know my face now. They wait for me at the bridge every morning.",
};

const post: BlueskyPost = {
	author: { name: "Lou", handle: "lou.gg", verified: true },
	time: "1h",
	text: "Saw a kingfisher on the canal this morning. Bright blue, gone in a second.",
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
		const article = canvas.getByRole("article", {
			name: "Bluesky post by Lou",
		});
		await expect(
			within(article).getAllByRole("link", { name: "Open on Bluesky" })[0],
		).toHaveAttribute("href", "https://bsky.app/profile/lou.gg");
		await expect(within(article).getByText("1.2K")).toBeInTheDocument();
	},
};

export const BlueskyDesktop: Story = {
	render: () => <BlueskyCases desktop />,
};

const ContextCases = (props: { desktop?: boolean }) => (
	<Screen desktop={props.desktop}>
		<Message
			attachments={
				<ForwardedMessage
					author="Lis"
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
					author="Lou"
					time="Today at 09:10"
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
				<ForwardedMessage author="Kris" time="12 Mar at 18:30">
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
