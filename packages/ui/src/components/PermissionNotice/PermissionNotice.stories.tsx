import { createSignal, onCleanup } from "solid-js";
import { expect, fn, userEvent, waitFor } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectFocusRingVisible } from "../../foundations/focus-ring-test";
import {
	EMULATED_WINDOW_CHROME,
	emulateWindowChrome,
	expectClearOfWindowChrome,
	expectNoLayoutIssues,
} from "../../foundations/layout-test";
import { Button } from "../Button/Button";
import {
	PERMISSION_NOTICE_INSET,
	PermissionNotice,
	type PermissionNoticePlatform,
} from "./PermissionNotice";

const meta = {
	title: "Shell/Permission notice",
	parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const onReview = fn();
const onDismiss = fn();

const TITLE = "Colibri needs one more permission for custom emoji.";
const DESCRIPTION = "Review it to keep everything working.";

const Pane = (props: {
	platform: PermissionNoticePlatform;
	width: number;
	height: number;
	visible: boolean;
	reviewing?: boolean;
	title?: string;
}) => {
	const [pane, setPane] = createSignal<HTMLElement>();
	return (
		<div
			ref={setPane}
			data-pane={props.platform}
			class="relative flex shrink-0 flex-col overflow-hidden bg-background shadow-[inset_0_0_0_1px_var(--border)] [transform:translateZ(0)]"
			classList={{
				"rounded-[28px]": props.platform === "mobile",
				"rounded-[12px]": props.platform === "desktop",
			}}
			style={{ width: `${props.width}px`, height: `${props.height}px` }}
		>
			<div
				data-pane-content=""
				class="flex flex-col gap-2 p-4 text-sm text-muted-foreground"
			>
				<p class="m-0 font-semibold text-foreground"># general</p>
				<p class="m-0">The first message in the channel.</p>
				<p class="m-0">Another message below it.</p>
			</div>
			{pane() && (
				<PermissionNotice
					platform={props.platform}
					visible={props.visible}
					reviewing={props.reviewing}
					title={props.title ?? TITLE}
					description={DESCRIPTION}
					onReview={onReview}
					onDismiss={onDismiss}
					mount={pane()}
				/>
			)}
		</div>
	);
};

const Playground = () => {
	const [visible, setVisible] = createSignal(true);
	const [reviewing, setReviewing] = createSignal(false);
	return (
		<div class="flex min-h-screen flex-col gap-6 bg-background p-6 text-foreground">
			<div class="flex flex-wrap items-center gap-3">
				<Button
					variant="secondary"
					data-toggle-notice=""
					onClick={() => setVisible((value) => !value)}
				>
					{visible() ? "Hide notice" : "Show notice"}
				</Button>
				<Button
					variant="secondary"
					onClick={() => setReviewing((value) => !value)}
				>
					{reviewing() ? "Stop reviewing" : "Reviewing"}
				</Button>
			</div>
			<div class="flex flex-wrap items-start gap-6">
				<Pane
					platform="mobile"
					visible={visible()}
					reviewing={reviewing()}
					width={402}
					height={420}
				/>
				<Pane
					platform="desktop"
					visible={visible()}
					reviewing={reviewing()}
					width={900}
					height={420}
				/>
			</div>
		</div>
	);
};

const paneOf = (root: HTMLElement, platform: PermissionNoticePlatform) => {
	const pane = root.querySelector<HTMLElement>(`[data-pane="${platform}"]`);
	if (!pane) throw new Error(`missing ${platform} pane`);
	return pane;
};

const part = (root: ParentNode, name: string) => {
	const element = root.querySelector<HTMLElement>(
		`[data-permission-notice-${name}]`,
	);
	if (!element) throw new Error(`missing ${name}`);
	return element;
};

const settle = async (pane: HTMLElement, opacity: string) => {
	const slot = part(pane, "slot");
	await waitFor(() => expect(getComputedStyle(slot).opacity).toBe(opacity));
};

const expectGeometry = async (
	pane: HTMLElement,
	platform: PermissionNoticePlatform,
) => {
	const card = pane.querySelector<HTMLElement>("[data-permission-notice]");
	if (!card) throw new Error("missing notice");
	const inset = PERMISSION_NOTICE_INSET[platform];
	const paneBox = pane.getBoundingClientRect();
	const box = card.getBoundingClientRect();
	await expect(Math.abs(box.top - paneBox.top - inset.top)).toBeLessThan(1);
	await expect(
		Math.abs(box.left + box.width / 2 - (paneBox.left + paneBox.width / 2)),
	).toBeLessThan(1);
	await expect(box.left - paneBox.left).toBeGreaterThanOrEqual(
		inset.side - 0.5,
	);
	await expect(paneBox.right - box.right).toBeGreaterThanOrEqual(
		inset.side - 0.5,
	);
	const review = part(pane, "review").getBoundingClientRect();
	const dismiss = part(pane, "dismiss").getBoundingClientRect();
	const target = platform === "mobile" ? 44 : 32;
	await expect(Math.round(review.height)).toBe(target);
	await expect(Math.round(dismiss.height)).toBe(target);
	await expect(Math.round(dismiss.width)).toBe(target);
};

export const Playground_: Story = {
	name: "Playground",
	render: () => <Playground />,
	play: async ({ canvasElement }) => {
		onReview.mockClear();
		onDismiss.mockClear();
		const mobile = paneOf(canvasElement, "mobile");
		const desktop = paneOf(canvasElement, "desktop");
		await settle(mobile, "1");
		await settle(desktop, "1");
		await expectGeometry(mobile, "mobile");
		await expectGeometry(desktop, "desktop");
		for (const pane of [mobile, desktop]) {
			await expect(part(pane, "title").textContent).toBe(TITLE);
			await expect(part(pane, "description").textContent).not.toMatch(
				/scope|token|session|oauth|appview|pds/i,
			);
		}
		const review = part(desktop, "review");
		await expectFocusRingVisible(review);
		await userEvent.click(review);
		await expect(onReview).toHaveBeenCalledTimes(1);
		await userEvent.click(part(desktop, "dismiss"));
		await expect(onDismiss).toHaveBeenCalledTimes(1);
		await expectNoLayoutIssues(mobile);
		await expectNoLayoutIssues(desktop);
	},
};

export const NoLayoutShift: Story = {
	name: "Appearing does not move content",
	render: () => <Playground />,
	play: async ({ canvasElement }) => {
		const mobile = paneOf(canvasElement, "mobile");
		const content = mobile.querySelector<HTMLElement>("[data-pane-content]");
		if (!content) throw new Error("missing content");
		await settle(mobile, "1");
		const shown = content.getBoundingClientRect();
		const toggle = canvasElement.querySelector<HTMLElement>(
			"[data-toggle-notice]",
		);
		if (!toggle) throw new Error("missing toggle");
		await userEvent.click(toggle);
		await settle(mobile, "0");
		const hidden = content.getBoundingClientRect();
		await expect(hidden.top).toBe(shown.top);
		await expect(hidden.height).toBe(shown.height);
		const slot = part(mobile, "slot");
		await expect(slot).toHaveAttribute("inert");
		await expect(slot).toHaveAttribute("aria-hidden", "true");
	},
};

export const LongTitle: Story = {
	name: "Long title on a narrow phone",
	render: () => (
		<div class="flex min-h-screen bg-background p-6 text-foreground">
			<Pane
				platform="mobile"
				visible
				width={360}
				height={360}
				title="Colibri needs a few more permissions for custom emoji, voice channels and threads."
			/>
		</div>
	),
	play: async ({ canvasElement }) => {
		const mobile = paneOf(canvasElement, "mobile");
		await settle(mobile, "1");
		await expectGeometry(mobile, "mobile");
		const title = part(mobile, "title");
		await expect(title.scrollWidth).toBeLessThanOrEqual(title.clientWidth);
		await expectNoLayoutIssues(mobile);
	},
};

export const ClearsWindowChrome: Story = {
	name: "Clears the window chrome",
	render: () => {
		onCleanup(emulateWindowChrome());
		return (
			<div class="min-h-screen bg-background">
				<PermissionNotice
					platform="desktop"
					visible
					title={TITLE}
					description={DESCRIPTION}
					onReview={onReview}
					onDismiss={onDismiss}
				/>
			</div>
		);
	},
	play: async () => {
		const card = document.querySelector<HTMLElement>(
			"[data-permission-notice]",
		);
		if (!card) throw new Error("missing notice");
		await waitFor(() =>
			expect(card.getBoundingClientRect().top).toBeGreaterThanOrEqual(
				EMULATED_WINDOW_CHROME + PERMISSION_NOTICE_INSET.desktop.top - 0.5,
			),
		);
		await expectClearOfWindowChrome(
			document.querySelector("[data-permission-notice-slot]") as HTMLElement,
		);
		await expectNoLayoutIssues(card);
	},
};
