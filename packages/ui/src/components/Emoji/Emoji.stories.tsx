import { For } from "solid-js";
import { expect, waitFor } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import {
	emojiOnlyCount,
	setEmojiAssetResolver,
	splitEmojiSegments,
	toEmojiCodepoint,
	twemojiAssetResolver,
} from "../../utils/emoji";
import { Emoji, EmojiText } from "./Emoji";

const meta = {
	title: "Primitives/Emoji",
	parameters: { viewport: { defaultViewport: "iphone" } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const SAMPLES = [
	{ label: "Unicode", value: "🐦" },
	{ label: "Skin tone", value: "👋🏽" },
	{ label: "ZWJ sequence", value: "👩‍💻" },
	{ label: "Family", value: "👨‍👩‍👧" },
	{ label: "Rainbow flag", value: "🏳️‍🌈" },
	{ label: "Country flag", value: "🇩🇪" },
	{ label: "Keycap", value: "1️⃣" },
	{ label: "Text style made emoji", value: "✈️" },
];

const glyphImage = (emoji: string) =>
	`data:image/svg+xml,${encodeURIComponent(
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72"><rect width="72" height="72" rx="16" fill="#2c2c2c"/><text x="36" y="50" font-size="44" text-anchor="middle">${emoji}</text></svg>`,
	)}`;

const CUSTOM = glyphImage("🐱");

const resetResolver = () => () => setEmojiAssetResolver(null);

const Gallery = () => (
	<div class="flex min-h-dvh flex-col gap-4 bg-background p-4 text-foreground">
		<For each={SAMPLES}>
			{(sample) => (
				<div class="flex items-center justify-between gap-3 text-base">
					<span class="text-muted-foreground">{sample.label}</span>
					<span data-testid={`sample-${sample.label}`}>
						<Emoji emoji={sample.value} />
					</span>
				</div>
			)}
		</For>
		<p class="m-0 text-base">
			<EmojiText text="Building a nest 🪺 with the flock 🐦‍⬛ © 2026" />
		</p>
		<div class="flex items-center gap-2 text-base">
			<span class="text-muted-foreground">Custom</span>
			<Emoji src={CUSTOM} name="blobcat" />
		</div>
		<p class="m-0 text-base" data-testid="jumbo">
			<EmojiText text="🎉🎉🐦" jumbo="auto" />
		</p>
	</div>
);

export const NativeGlyphs: Story = {
	beforeEach: resetResolver,
	render: () => <Gallery />,
	play: async ({ canvasElement }) => {
		const family = canvasElement.querySelector(
			'[data-testid="sample-Family"] [data-emoji]',
		);
		await expect(family).toHaveAttribute("data-emoji", "native");
		await expect(family?.textContent).toBe("👨‍👩‍👧");
		await expect(
			splitEmojiSegments("Hi 👋🏽 from 🇩🇪! © 2026").map(
				(segment) => segment.kind,
			),
		).toEqual(["text", "emoji", "text", "emoji", "text"]);
		await expect(emojiOnlyCount("🎉 🎉")).toBe(2);
		await expect(emojiOnlyCount("🎉 yay")).toBe(0);
		await expect(
			canvasElement.querySelector('[data-testid="jumbo"] [data-emoji-text]'),
		).toHaveAttribute("data-jumbo");
	},
};

export const WithAssetResolver: Story = {
	beforeEach: () => {
		setEmojiAssetResolver((_codepoint, emoji) => glyphImage(emoji));
		return () => setEmojiAssetResolver(null);
	},
	render: () => <Gallery />,
	play: async ({ canvasElement }) => {
		const wave = canvasElement.querySelector(
			'[data-testid="sample-Skin tone"] img',
		);
		await expect(wave).toHaveAttribute("alt", "👋🏽");
		await expect(toEmojiCodepoint("👋🏽")).toBe("1f44b-1f3fd");
		await expect(toEmojiCodepoint("🏳️‍🌈")).toBe("1f3f3-fe0f-200d-1f308");
		await expect(toEmojiCodepoint("✈️")).toBe("2708");
		await expect(twemojiAssetResolver("/twemoji/")("1f426", "🐦")).toBe(
			"/twemoji/72x72/1f426.png",
		);
		const custom = canvasElement.querySelector('img[data-emoji="custom"]');
		await expect(custom).toHaveAttribute("alt", ":blobcat:");
	},
};

export const BrokenAssetsFallBack: Story = {
	beforeEach: () => {
		setEmojiAssetResolver(twemojiAssetResolver("/missing-emoji/"));
		return () => setEmojiAssetResolver(null);
	},
	render: () => <Gallery />,
	play: async ({ canvasElement }) => {
		await waitFor(() =>
			expect(
				canvasElement.querySelector(
					'[data-testid="sample-Unicode"] [data-emoji]',
				),
			).toHaveAttribute("data-emoji", "native"),
		);
	},
};
