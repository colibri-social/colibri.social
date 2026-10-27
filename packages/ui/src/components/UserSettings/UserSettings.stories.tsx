import { createSignal } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import { AccountSettings } from "./AccountSettings";
import { AppearanceSettings } from "./AppearanceSettings";
import { ChatSettings } from "./ChatSettings";
import { DeleteAccount, type DeleteAccountState } from "./DeleteAccount";
import { NotificationSettings } from "./NotificationSettings";
import type {
	BlueskyClientChoice,
	NotificationLevel,
	ThemePreference,
	TouchGestures,
} from "./types";

const meta = {
	title: "Settings/User settings",
	parameters: { viewport: { defaultViewport: "iphone" } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const Page = (props: { children: unknown }) => (
	<div data-story-page="" class="min-h-dvh bg-background p-4 text-foreground">
		{props.children as never}
	</div>
);

const pageRoot = (canvasElement: HTMLElement) =>
	canvasElement.querySelector("[data-story-page]") as HTMLElement;

export const Account: Story = {
	render: () => {
		const [share, setShare] = createSignal(false);
		return (
			<Page>
				<AccountSettings
					onEditProfile={fn()}
					status="Painting the kitchen"
					onEditStatus={fn()}
					shareActivity={share()}
					onShareActivityChange={setShare}
					atmosphereAccountHref="https://atmosphereaccount.com/"
					onLogOut={fn()}
					onDeleteAccount={fn()}
				/>
			</Page>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const toggle = canvas.getByRole("switch", {
			name: /Share what I'm doing/,
		});
		await expect(toggle).not.toBeChecked();
		await userEvent.click(canvas.getByText("Share what I'm doing"));
		await expect(toggle).toBeChecked();
		await expect(canvas.getByText("Painting the kitchen")).toBeVisible();
		await expect(
			canvas.getByRole("link", { name: /My Atmosphere Account/ }),
		).toHaveAttribute("target", "_blank");
		await expect(
			canvas.getByRole("button", { name: "Delete my Colibri data" }),
		).toBeVisible();
		await expectNoLayoutIssues(pageRoot(canvasElement));
	},
};

export const AccountWithoutStatus: Story = {
	render: () => (
		<Page>
			<AccountSettings
				onEditProfile={fn()}
				onEditStatus={fn()}
				shareActivity
				onShareActivityChange={fn()}
				onLogOut={fn()}
			/>
		</Page>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("Not set")).toBeVisible();
		await expect(canvas.queryByText("Delete my Colibri data")).toBeNull();
	},
};

const HANDLE = "lou.colibri.social";

const deleteStory = (
	state: DeleteAccountState,
	play?: Story["play"],
): Story => ({
	render: () => (
		<Page>
			<DeleteAccount
				state={state}
				handle={HANDLE}
				host={{
					name: "bsky.social",
					deletionHref: "https://bsky.app/settings/account",
					deletionLabel: "Bluesky's account settings",
				}}
				onConfirm={fn()}
				onLogOut={fn()}
			/>
		</Page>
	),
	play: async (context) => {
		await expectNoLayoutIssues(pageRoot(context.canvasElement));
		await play?.(context);
	},
});

export const DeleteChecking = deleteStory(
	{ stage: "checking" },
	async ({ canvasElement }) => {
		await expect(
			within(canvasElement).getByText("Checking what deleting would remove."),
		).toBeVisible();
	},
);

export const DeleteBlocked = deleteStory(
	{
		stage: "blocked",
		spaces: [
			{ name: "Hummingbird Club", memberCount: 128 },
			{ name: "Weekend Painters", memberCount: 1 },
		],
	},
	async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("Hand over your Spaces first")).toBeVisible();
		await expect(canvas.getByText("1 member")).toBeVisible();
		await expect(canvas.queryByRole("button", { name: /Delete/ })).toBeNull();
	},
);

export const DeleteReview: Story = {
	render: () => {
		const confirm = fn();
		return (
			<Page>
				<DeleteAccount
					state={{ stage: "review" }}
					handle={`@${HANDLE}`}
					host={{ name: "pds.example.com", contactEmail: "help@example.com" }}
					onConfirm={confirm}
					onLogOut={fn()}
				/>
				<output data-testid="confirmed">
					{String(confirm.mock.calls.length)}
				</output>
			</Page>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const button = canvas.getByRole("button", {
			name: "Delete my Colibri data",
		});
		await expect(button).toBeDisabled();
		const field = canvas.getByRole("textbox", { name: "Your handle" });
		await userEvent.type(field, "lou.colibri");
		await expect(button).toBeDisabled();
		await userEvent.type(field, ".SOCIAL");
		await expect(button).toBeEnabled();
		const email = canvas.getByRole("link", { name: "help@example.com" });
		await expect(email).toHaveAttribute("href", "mailto:help@example.com");
		await expect(email.closest("span")?.textContent).toMatch(
			/doesn't run\. To delete that account too, contact the people who run it at help@example\.com\.$/,
		);
		await expectNoLayoutIssues(pageRoot(canvasElement));
	},
};

export const DeleteFailed = deleteStory(
	{
		stage: "review",
		failure:
			"Colibri couldn't reach your account. Check your connection and try again.",
	},
	async ({ canvasElement }) => {
		await expect(within(canvasElement).getByRole("alert")).toHaveTextContent(
			"Deleting didn't finish",
		);
	},
);

export const DeleteWorking = deleteStory(
	{ stage: "working", progress: { step: "records", done: 2, total: 9 } },
	async ({ canvasElement }) => {
		await expect(
			within(canvasElement).getByText(
				"Deleting your messages and settings (3 of 9).",
			),
		).toBeVisible();
	},
);

export const DeleteDone = deleteStory(
	{ stage: "done" },
	async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByText("Your Colibri data is deleted"),
		).toBeVisible();
		await expect(canvas.getByRole("button", { name: "Log out" })).toBeVisible();
	},
);

export const DeleteDoneIncomplete = deleteStory(
	{ stage: "done", incomplete: true },
	async ({ canvasElement }) => {
		await expect(
			within(canvasElement).getByText("A few items are still saved"),
		).toBeVisible();
	},
);

export const Notifications: Story = {
	render: () => {
		const [level, setLevel] = createSignal<NotificationLevel>("all");
		const [enabled, setEnabled] = createSignal(true);
		const [volume, setVolume] = createSignal(100);
		return (
			<Page>
				<NotificationSettings
					level={level()}
					onLevelChange={setLevel}
					device={{ enabled: enabled(), onChange: setEnabled }}
					sounds={{ volume: volume(), onChange: setVolume }}
				/>
				<output data-testid="level">{level()}</output>
				<output data-testid="volume">{volume()}</output>
			</Page>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole("radio", { name: /All messages/ }),
		).toBeChecked();
		await userEvent.click(canvas.getByText("Nothing"));
		await waitFor(() =>
			expect(canvas.getByTestId("level")).toHaveTextContent("nothing"),
		);
		const slider = canvas.getByRole("slider", {
			name: /Sound effects volume/,
		});
		await expect(slider).toHaveAttribute("aria-valuenow", "100");
		slider.focus();
		await userEvent.keyboard("{ArrowLeft}");
		await waitFor(() =>
			expect(canvas.getByTestId("volume")).toHaveTextContent("99"),
		);
		await userEvent.click(canvas.getByText("Notifications on this device"));
		await expect(
			canvas.getByRole("switch", { name: /Notifications on this device/ }),
		).not.toBeChecked();
		await expectNoLayoutIssues(pageRoot(canvasElement));
	},
};

export const NotificationsBlocked: Story = {
	render: () => (
		<Page>
			<NotificationSettings
				level="mentionsAndReplies"
				onLevelChange={fn()}
				device={{
					enabled: false,
					onChange: fn(),
					blocked: true,
					place: "browser",
				}}
			/>
		</Page>
	),
	play: async ({ canvasElement }) => {
		await expect(
			within(canvasElement).getByText(/Allow them in your browser settings/),
		).toBeVisible();
	},
};

export const Appearance: Story = {
	render: () => {
		const [theme, setTheme] = createSignal<ThemePreference>("system");
		const [previews, setPreviews] = createSignal(true);
		return (
			<Page>
				<AppearanceSettings
					theme={theme()}
					onThemeChange={setTheme}
					messagePreviews={previews()}
					onMessagePreviewsChange={setPreviews}
				/>
				<output data-testid="theme">{theme()}</output>
			</Page>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole("radio", { name: /Match my device/ }),
		).toBeChecked();
		await userEvent.click(canvas.getByText("Light"));
		await waitFor(() =>
			expect(canvas.getByTestId("theme")).toHaveTextContent("light"),
		);
		await expectNoLayoutIssues(pageRoot(canvasElement));
	},
};

export const AppearanceInboxWindow: Story = {
	render: () => {
		const [modal, setModal] = createSignal(false);
		return (
			<Page>
				<AppearanceSettings
					theme="system"
					onThemeChange={fn()}
					messagePreviews
					onMessagePreviewsChange={fn()}
					inboxAsModal={modal()}
					onInboxAsModalChange={setModal}
				/>
				<output data-testid="inbox">{modal() ? "modal" : "popover"}</output>
				<AppearanceSettings
					theme="system"
					onThemeChange={fn()}
					messagePreviews
					onMessagePreviewsChange={fn()}
					class="mobile-appearance"
				/>
			</Page>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const toggle = canvas.getByRole("switch", {
			name: /Open the Inbox in a large window/,
		});
		await expect(toggle).not.toBeChecked();
		await userEvent.click(toggle);
		await waitFor(() =>
			expect(canvas.getByTestId("inbox")).toHaveTextContent("modal"),
		);
		await expect(toggle).toBeChecked();
		const mobile = canvasElement.querySelector(
			".mobile-appearance",
		) as HTMLElement;
		await expect(
			within(mobile).queryByText(/Open the Inbox in a large window/),
		).toBeNull();
		await expectNoLayoutIssues(pageRoot(canvasElement));
	},
};

const ChatStory = (props: {
	platform?: "mobile" | "desktop";
	gestures?: boolean;
	client?: BlueskyClientChoice;
}) => {
	const [client, setClient] = createSignal<BlueskyClientChoice>(
		props.client ?? "bluesky",
	);
	const [domain, setDomain] = createSignal("");
	const [share, setShare] = createSignal(true);
	const [gifLoops, setGifLoops] = createSignal<number>();
	const [gestures, setGestures] = createSignal<TouchGestures>({
		swipeLeftAction: "members",
		doubleTapEnabled: true,
		doubleTapAction: "react",
		doubleTapReactionEmoji: "👍",
	});
	return (
		<Page>
			<ChatSettings
				platform={props.platform}
				linkPreviews
				onLinkPreviewsChange={fn()}
				warnOnExternalLinks
				onWarnOnExternalLinksChange={fn()}
				blueskyClient={client()}
				onBlueskyClientChange={setClient}
				customClientDomain={domain()}
				onCustomClientDomainSave={setDomain}
				gifLoopLimit={gifLoops()}
				onGifLoopLimitChange={setGifLoops}
				gestures={props.gestures === false ? undefined : gestures()}
				onGesturesChange={(change) =>
					setGestures((current) => ({ ...current, ...change }))
				}
				onPickReactionEmoji={fn()}
				shareActivity={share()}
				onShareActivityChange={setShare}
			/>
			<output data-testid="client">{client()}</output>
			<output data-testid="domain">{domain()}</output>
			<output data-testid="gif-loops">{gifLoops() ?? "unlimited"}</output>
		</Page>
	);
};

export const Chat: Story = {
	render: () => <ChatStory />,
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);
		await step("gestures follow the double tap switch", async () => {
			await expect(
				canvas.getByRole("radio", { name: /React with an emoji/ }),
			).toBeChecked();
			await expect(canvas.getByText("👍")).toBeVisible();
			await userEvent.click(canvas.getByText("Edit or reply"));
			await waitFor(() => expect(canvas.queryByText("👍")).toBeNull());
			await userEvent.click(canvas.getByText("Double tap a message"));
			await waitFor(() =>
				expect(canvas.queryByText("When I double tap")).toBeNull(),
			);
		});
		await step("no custom address without a custom app", async () => {
			await expect(canvas.queryByText("Address of the app")).toBeNull();
		});
		await step("activity sharing toggles", async () => {
			const share = canvas.getByRole("switch", {
				name: /Share what I'm doing/,
			});
			await expect(share).toBeChecked();
			await userEvent.click(share);
			await expect(share).not.toBeChecked();
		});
		await expectNoLayoutIssues(pageRoot(canvasElement));
	},
};

export const ChatCustomClient: Story = {
	render: () => <ChatStory client="custom" />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const save = canvas.getByRole("button", { name: "Save" });
		await expect(save).toBeDisabled();
		const field = canvas.getByRole("textbox", { name: "Address of the app" });
		await userEvent.type(field, "  deck.example.com ");
		await expect(save).toBeEnabled();
		await userEvent.keyboard("{Enter}");
		await waitFor(() =>
			expect(canvas.getByTestId("domain")).toHaveTextContent(
				"deck.example.com",
			),
		);
		await waitFor(() => expect(save).toBeDisabled());
		const fieldBox = field.getBoundingClientRect();
		const saveBox = save.getBoundingClientRect();
		await expect(saveBox.left).toBeGreaterThanOrEqual(fieldBox.right - 1);
		await expectNoLayoutIssues(pageRoot(canvasElement));
	},
};

export const ChatPickClient: Story = {
	parameters: { viewport: { defaultViewport: "desktop" } },
	render: () => <ChatStory platform="desktop" gestures={false} />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.queryByText("Touch gestures")).toBeNull();
		await userEvent.click(
			canvas.getByRole("button", { name: /Open Bluesky links in/ }),
		);
		const listbox = await screen.findByRole("listbox");
		await userEvent.click(
			within(listbox).getByRole("option", { name: /Another app/ }),
		);
		await waitFor(() =>
			expect(canvas.getByTestId("client")).toHaveTextContent("custom"),
		);
		await expect(
			canvas.getByRole("textbox", { name: "Address of the app" }),
		).toBeVisible();
	},
};

export const ChatGifLoops: Story = {
	parameters: { viewport: { defaultViewport: "desktop" } },
	render: () => <ChatStory platform="desktop" gestures={false} />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const trigger = canvas.getByRole("button", { name: /Play GIFs in chat/ });
		await expect(trigger).toHaveTextContent("Keep playing");
		await userEvent.click(trigger);
		const listbox = await screen.findByRole("listbox");
		await userEvent.click(
			within(listbox).getByRole("option", { name: "Play 3 times" }),
		);
		await waitFor(() =>
			expect(canvas.getByTestId("gif-loops")).toHaveTextContent("3"),
		);
		await expect(trigger).toHaveTextContent("Play 3 times");
		await userEvent.click(trigger);
		await userEvent.click(
			within(await screen.findByRole("listbox")).getByRole("option", {
				name: "Keep playing",
			}),
		);
		await waitFor(() =>
			expect(canvas.getByTestId("gif-loops")).toHaveTextContent("unlimited"),
		);
		await expectNoLayoutIssues(pageRoot(canvasElement));
	},
};
