import { createSignal, onCleanup, onMount, Show } from "solid-js";
import { expect, waitFor } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import {
	gifDataUrl,
	STRIP_PART_SIZE,
	STRIP_PARTS,
	stripPartGif,
} from "../Emoji/animated-fixtures";
import { setSyncedAnimationDecoder } from "../Emoji/SyncedAnimation";
import { RichTextProvider } from "./context";
import { RichTextRenderer } from "./RichText";

const SECOND_ROW_DELAY_MS = 437;
const SAMPLE_COUNT = 5;
const SAMPLE_GAP_MS = 70;

const STRIP_EMOJI = Object.fromEntries(
	Array.from({ length: STRIP_PARTS }, (_, part) => [
		`comet_${part + 1}`,
		gifDataUrl(stripPartGif(part)),
	]),
);

const STRIP_TEXT = Object.keys(STRIP_EMOJI)
	.map((name) => `:${name}:`)
	.join("");

const StripFrame = (props: { text: string }) => (
	<RichTextProvider
		value={{
			customEmoji: (name) =>
				STRIP_EMOJI[name] ? { name, src: STRIP_EMOJI[name] } : undefined,
		}}
	>
		<div class="bg-background p-4 text-base leading-message text-foreground">
			<RichTextRenderer value={{ text: props.text, facets: [] }} />
		</div>
	</RichTextProvider>
);

const StripRows = () => {
	const [later, setLater] = createSignal(false);

	onMount(() => {
		const timer = setTimeout(() => setLater(true), SECOND_ROW_DELAY_MS);

		onCleanup(() => clearTimeout(timer));
	});

	return (
		<>
			<StripFrame text={`Inline ${STRIP_TEXT} strip`} />
			<StripFrame text={STRIP_TEXT} />
			<Show when={later()}>
				<div data-late-row="">
					<StripFrame text={`Mounted later ${STRIP_TEXT} strip`} />
				</div>
			</Show>
		</>
	);
};

const meta = {
	title: "Messaging/Synced emoji",
	parameters: { viewport: { defaultViewport: "iphone" } },
	beforeEach: () => {
		setSyncedAnimationDecoder("script");

		return () => setSyncedAnimationDecoder("auto");
	},
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const pixels = (canvas: HTMLCanvasElement) => {
	const context = canvas.getContext("2d");

	if (!context) return [];

	return Array.from(
		context.getImageData(0, 0, canvas.width, canvas.height).data,
	);
};

const syncedCanvases = (root: Element) => {
	return Array.from(
		root.querySelectorAll<HTMLCanvasElement>(
			'canvas[data-custom-emoji-synced="script"]',
		),
	);
};

const wait = (ms: number) => {
	return new Promise((resolve) => setTimeout(resolve, ms));
};

export const ScriptDecoderStrip: Story = {
	render: () => <StripRows />,
	play: async ({ canvasElement }) => {
		const [inline, jumbo] = Array.from(
			canvasElement.querySelectorAll("[data-rich-text]"),
		);

		await waitFor(() => expect(syncedCanvases(inline)).toHaveLength(3), {
			timeout: 4000,
		});
		await expect(syncedCanvases(jumbo)).toHaveLength(3);
		await expect(inline.querySelector("img[data-custom-emoji]")).toBeNull();

		for (const canvas of syncedCanvases(inline)) {
			await expect(canvas.width).toBe(STRIP_PART_SIZE);
		}

		const lateRow = await waitFor(
			() => {
				const row = canvasElement.querySelector("[data-late-row]");

				expect(row && syncedCanvases(row)).toHaveLength(3);

				return row as Element;
			},
			{ timeout: 4000 },
		);

		await waitFor(() =>
			expect(syncedCanvases(lateRow).map(pixels)).toEqual(
				syncedCanvases(inline).map(pixels),
			),
		);

		for (let sample = 0; sample < SAMPLE_COUNT; sample++) {
			await wait(SAMPLE_GAP_MS);
			await expect(syncedCanvases(lateRow).map(pixels)).toEqual(
				syncedCanvases(inline).map(pixels),
			);
		}
	},
};
