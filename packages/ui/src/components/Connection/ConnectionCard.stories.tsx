import { createSignal, For, type JSX } from "solid-js";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectFocusRingVisible } from "../../foundations/focus-ring-test";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import { Button } from "../Button/Button";
import { ChannelHeader } from "../ChannelHeader/ChannelHeader";
import type { ChatPlatform } from "../Message/layout";
import { ChannelView, createChannel } from "../Message/message-list-story-kit";
import { SegmentedControl } from "../SegmentedControl/SegmentedControl";
import {
	CONNECTION_CARD_INSET,
	ConnectionCard,
	type ConnectionCardState,
} from "./ConnectionCard";

const meta = {
	title: "Shell/Connection card",
	parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const onRetry = fn();

const STATE_OPTIONS = [
	{ value: "reconnecting", label: "Reconnecting" },
	{ value: "unreachable", label: "Can't connect" },
	{ value: "offline", label: "Offline" },
];

const createRetryAt = (seconds: number) => {
	const [retryAt, setRetryAt] = createSignal(Date.now() + seconds * 1000);
	return { retryAt, restart: () => setRetryAt(Date.now() + seconds * 1000) };
};

const Pane = (props: {
	platform: ChatPlatform;
	state: ConnectionCardState;
	visible: boolean;
	width: number;
	height: number;
	retrying?: boolean;
}) => {
	const channel = createChannel();
	const retry = createRetryAt(12);
	return (
		<div
			data-pane={props.platform}
			class="flex shrink-0 flex-col overflow-hidden bg-background shadow-[inset_0_0_0_1px_var(--border)]"
			classList={{
				"rounded-[28px]": props.platform === "mobile",
				"rounded-[12px]": props.platform === "desktop",
			}}
			style={{ width: `${props.width}px`, height: `${props.height}px` }}
		>
			{props.platform === "mobile" ? (
				<ChannelHeader name="general" safeTop onBack={() => {}} />
			) : (
				<ChannelHeader
					platform="desktop"
					name="general"
					description="Say hi and share what you're working on"
					onToggleMembers={() => {}}
				/>
			)}
			<div data-chat-pane="" class="relative min-h-0 flex-1">
				<ConnectionCard
					state={props.state}
					platform={props.platform}
					visible={props.visible}
					retryAt={retry.retryAt()}
					retrying={props.retrying}
					onRetry={() => {
						onRetry();
						retry.restart();
					}}
				/>
				<ChannelView
					channel={channel}
					platform={props.platform}
					height="100%"
				/>
			</div>
		</div>
	);
};

const Gallery = (props: { children: JSX.Element }) => (
	<div class="flex min-h-screen flex-col gap-6 bg-background p-6 text-foreground">
		{props.children}
	</div>
);

const Playground = () => {
	const [state, setState] = createSignal<ConnectionCardState>("unreachable");
	const [visible, setVisible] = createSignal(true);
	const [retrying, setRetrying] = createSignal(false);
	return (
		<Gallery>
			<div class="flex flex-wrap items-center gap-3">
				<SegmentedControl
					aria-label="Connection state"
					options={STATE_OPTIONS}
					value={state()}
					onChange={(next) => setState(next as ConnectionCardState)}
				/>
				<Button variant="secondary" onClick={() => setVisible((v) => !v)}>
					{visible() ? "Hide card" : "Show card"}
				</Button>
				<Button variant="secondary" onClick={() => setRetrying((v) => !v)}>
					{retrying() ? "Stop retrying" : "Retrying"}
				</Button>
			</div>
			<div class="flex flex-wrap items-start gap-6">
				<Pane
					platform="mobile"
					state={state()}
					visible={visible()}
					retrying={retrying()}
					width={402}
					height={760}
				/>
				<Pane
					platform="desktop"
					state={state()}
					visible={visible()}
					retrying={retrying()}
					width={900}
					height={560}
				/>
			</div>
		</Gallery>
	);
};

const cardIn = (root: HTMLElement) =>
	root.querySelector<HTMLElement>("[data-connection-card]");

const part = (root: HTMLElement, name: string) =>
	root.querySelector<HTMLElement>(`[data-connection-card-${name}]`);

const settle = async (pane: HTMLElement) => {
	const slot = pane.querySelector<HTMLElement>("[data-connection-card-slot]");
	await waitFor(() => expect(slot && getComputedStyle(slot).opacity).toBe("1"));
};

const expectGeometry = async (pane: HTMLElement, platform: ChatPlatform) => {
	const header = pane.querySelector<HTMLElement>("[data-channel-header]");
	const chat = pane.querySelector<HTMLElement>("[data-chat-pane]");
	const card = cardIn(pane);
	if (!header || !chat || !card) throw new Error("missing pane parts");
	await settle(pane);
	const inset = CONNECTION_CARD_INSET[platform];
	const headerBox = header.getBoundingClientRect();
	const chatBox = chat.getBoundingClientRect();
	const box = card.getBoundingClientRect();
	await expect(Math.abs(box.top - headerBox.bottom - inset.top)).toBeLessThan(
		1,
	);
	await expect(
		Math.abs(box.left + box.width / 2 - (chatBox.left + chatBox.width / 2)),
	).toBeLessThan(1);
	await expect(box.left - chatBox.left).toBeGreaterThanOrEqual(
		inset.side - 0.5,
	);
	await expect(chatBox.right - box.right).toBeGreaterThanOrEqual(
		inset.side - 0.5,
	);
	if (platform === "mobile") {
		await expect(Math.abs(box.left - chatBox.left - inset.side)).toBeLessThan(
			1,
		);
	}
};

const expectText = async (pane: HTMLElement) => {
	const title = part(pane, "title");
	const description = part(pane, "description");
	if (!title || !description) throw new Error("missing text");
	await expect(description.scrollWidth).toBeLessThanOrEqual(
		description.clientWidth,
	);
	await expect(description.getBoundingClientRect().top).toBeGreaterThanOrEqual(
		title.getBoundingClientRect().bottom - 0.5,
	);
	await expect(
		Number.parseFloat(getComputedStyle(description).fontSize),
	).toBeLessThan(Number.parseFloat(getComputedStyle(title).fontSize));
	await expect(description.textContent).not.toMatch(
		/appview|server|socket|frame|websocket|xrpc/i,
	);
};

export const Playground_: Story = {
	name: "Playground",
	render: () => <Playground />,
	play: async ({ canvasElement }) => {
		onRetry.mockClear();
		const mobile = canvasElement.querySelector<HTMLElement>(
			'[data-pane="mobile"]',
		);
		const desktop = canvasElement.querySelector<HTMLElement>(
			'[data-pane="desktop"]',
		);
		if (!mobile || !desktop) throw new Error("missing panes");
		await expectGeometry(mobile, "mobile");
		await expectGeometry(desktop, "desktop");
		await expectText(mobile);
		await expectText(desktop);
		const retry = part(desktop, "retry");
		if (!retry) throw new Error("no retry button");
		const headerButtons = desktop.querySelectorAll<HTMLElement>(
			"[data-channel-header] button",
		);
		headerButtons[headerButtons.length - 1]?.focus();
		await expectFocusRingVisible(retry);
		await userEvent.click(retry);
		await expect(onRetry).toHaveBeenCalledTimes(1);
		await expectNoLayoutIssues(mobile);
		await expectNoLayoutIssues(desktop);
	},
};

export const States: Story = {
	render: () => (
		<Gallery>
			<For each={["reconnecting", "unreachable", "offline"] as const}>
				{(state) => (
					<div class="flex flex-wrap items-start gap-6">
						<Pane
							platform="mobile"
							state={state}
							visible
							width={402}
							height={300}
						/>
						<Pane
							platform="desktop"
							state={state}
							visible
							width={900}
							height={300}
						/>
					</div>
				)}
			</For>
		</Gallery>
	),
	play: async ({ canvasElement }) => {
		const cards = canvasElement.querySelectorAll<HTMLElement>(
			"[data-connection-card]",
		);
		await expect(cards.length).toBe(6);
		const retries = canvasElement.querySelectorAll(
			"[data-connection-card-retry]",
		);
		await expect(retries.length).toBe(2);
		for (const card of cards) {
			await expect(card.getAttribute("role")).toBe("status");
			await expect(card.getAttribute("aria-live")).toBe("polite");
		}
	},
};

export const NarrowPhone: Story = {
	name: "Narrow phone",
	render: () => (
		<Gallery>
			<Pane
				platform="mobile"
				state="unreachable"
				visible
				width={320}
				height={600}
			/>
		</Gallery>
	),
	play: async ({ canvasElement }) => {
		const pane = canvasElement.querySelector<HTMLElement>(
			'[data-pane="mobile"]',
		);
		if (!pane) throw new Error("missing pane");
		await expectGeometry(pane, "mobile");
		await expectText(pane);
		await waitFor(() =>
			expect(part(pane, "description")?.textContent).toMatch(
				/^Trying again in \d+ s$/,
			),
		);
		await expectNoLayoutIssues(pane);
	},
};

export const Retrying: Story = {
	render: () => (
		<Gallery>
			<Pane
				platform="mobile"
				state="unreachable"
				visible
				retrying
				width={402}
				height={300}
			/>
		</Gallery>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const retry = canvas.getByRole("button", { name: "Try now" });
		await expect(retry).toHaveAttribute("aria-busy", "true");
		await expect(retry).toBeDisabled();
	},
};

export const Hidden: Story = {
	render: () => {
		const [visible, setVisible] = createSignal(true);
		return (
			<Gallery>
				<Button variant="secondary" onClick={() => setVisible((v) => !v)}>
					Toggle
				</Button>
				<Pane
					platform="mobile"
					state="reconnecting"
					visible={visible()}
					width={402}
					height={300}
				/>
			</Gallery>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const slot = canvasElement.querySelector<HTMLElement>(
			"[data-connection-card-slot]",
		);
		if (!slot) throw new Error("no slot");
		await userEvent.click(canvas.getByRole("button", { name: "Toggle" }));
		await waitFor(() => expect(getComputedStyle(slot).opacity).toBe("0"));
		await expect(slot).toHaveAttribute("inert");
	},
};
