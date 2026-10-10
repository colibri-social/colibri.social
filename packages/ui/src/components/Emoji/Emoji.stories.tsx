import { For } from "solid-js";
import { expect, waitFor } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import {
	EMOJI_FONT_FAMILY,
	EMOJI_GLYPH_EM,
	emojiOnlyCount,
	isEmojiGrapheme,
	splitEmojiSegments,
	toEmojiCodepoint,
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
	{ label: "Rainbow flag, unqualified", value: "🏳‍🌈" },
	{ label: "Country flag", value: "🇩🇪" },
	{ label: "Subdivision flag", value: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
	{ label: "Keycap", value: "1️⃣" },
	{ label: "Keycap, unqualified", value: "#⃣" },
	{ label: "Text style made emoji", value: "✈️" },
	{ label: "Heart", value: "❤️" },
	{ label: "Newest", value: "🫩" },
];

const glyphImage = (emoji: string) =>
	`data:image/svg+xml,${encodeURIComponent(
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72"><rect width="72" height="72" rx="16" fill="#2c2c2c"/><text x="36" y="50" font-size="44" text-anchor="middle">${emoji}</text></svg>`,
	)}`;

const CUSTOM = glyphImage("🐱");

const EmojiGallery = () => (
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
		<p class="m-0 text-base" data-testid="mixed">
			<EmojiText text="Building a nest 🪺 with the flock 🐦‍⬛ © 2026, room 101" />
		</p>
		<div class="flex items-center gap-2 text-base">
			<span class="text-muted-foreground">Custom</span>
			<Emoji src={CUSTOM} name="blobcat" />
			<Emoji src="/missing-emoji.png" name="gone" />
		</div>
		<div class="flex items-center gap-2 text-base">
			<span class="text-muted-foreground">Pixel sizes</span>
			<Emoji emoji="🐦" size={16} />
			<Emoji emoji="🐦" size={24} />
			<Emoji emoji="🐦" size={40} />
		</div>
		<p class="m-0 text-base" data-testid="jumbo">
			<EmojiText text="🎉🎉🐦" jumbo="auto" />
		</p>
	</div>
);

const widthOf = (text: string, fontSize: number) => {
	const probe = document.createElement("span");
	probe.textContent = text;
	probe.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font-size:${fontSize}px;font-family:"${EMOJI_FONT_FAMILY}";`;
	document.body.append(probe);
	const width = probe.getBoundingClientRect().width;
	probe.remove();
	return width;
};

export const Gallery: Story = {
	render: () => <EmojiGallery />,
	play: async ({ canvasElement }) => {
		const family = canvasElement.querySelector(
			'[data-testid="sample-Family"] [data-emoji]',
		);
		await expect(family).toHaveAttribute("data-emoji", "unicode");
		await expect(family?.textContent).toBe("👨‍👩‍👧");
		await expect(canvasElement.querySelector("img[alt='🐦']")).toBeNull();
		await expect(
			canvasElement.querySelector('[data-testid="jumbo"] [data-emoji-text]'),
		).toHaveAttribute("data-jumbo");
		await waitFor(() =>
			expect(
				canvasElement.querySelector('[data-emoji="custom-fallback"]'),
			).toHaveTextContent(":gone:"),
		);
		await expect(
			canvasElement.querySelector('img[data-emoji="custom"]'),
		).toHaveAttribute("alt", ":blobcat:");
	},
};

export const FontLigatures: Story = {
	render: () => <EmojiGallery />,
	play: async () => {
		const loaded = await document.fonts.load(
			`16px "${EMOJI_FONT_FAMILY}"`,
			SAMPLES.map((sample) => sample.value).join(""),
		);
		await expect(loaded.length).toBeGreaterThan(0);
		for (const sample of SAMPLES) {
			const width = widthOf(sample.value, 16);
			await expect(
				Math.abs(width - 16 * EMOJI_GLYPH_EM),
				`${sample.label} renders as one glyph`,
			).toBeLessThan(1);
		}
	},
};

export const Segmenting: Story = {
	render: () => <EmojiGallery />,
	play: async () => {
		await expect(
			splitEmojiSegments("Hi 👋🏽 from 🇩🇪! © 2026").map(
				(segment) => segment.kind,
			),
		).toEqual(["text", "emoji", "text", "emoji", "text"]);
		await expect(emojiOnlyCount("🎉 🎉")).toBe(2);
		await expect(emojiOnlyCount("🎉 yay")).toBe(0);
		await expect(emojiOnlyCount("1️⃣ #️⃣")).toBe(2);
		await expect(emojiOnlyCount("1 2")).toBe(0);
		await expect(isEmojiGrapheme("©")).toBe(false);
		await expect(isEmojiGrapheme("©️")).toBe(true);
		await expect(toEmojiCodepoint("👋🏽")).toBe("1f44b-1f3fd");
		await expect(toEmojiCodepoint("🏳️‍🌈")).toBe("1f3f3-fe0f-200d-1f308");
		await expect(toEmojiCodepoint("✈️")).toBe("2708");
	},
};
