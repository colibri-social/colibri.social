import { createSignal, Match, Switch } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { type Haptics, HapticsProvider } from "../../utils/haptics";
import { setAppActive } from "../../utils/playback";
import {
	defaultAvatarFor,
	defaultAvatarUrl,
} from "../Avatar/default-avatars/default-avatars";
import { paintImage } from "../Banner/story-images";
import { Button } from "../Button/Button";
import { createOnboarding, type OnboardingResult } from "./create-onboarding";
import type { HandleSuggestion } from "./HandleField";
import { OnboardingFlow, type OnboardingPlatform } from "./OnboardingFlow";
import {
	CreateAccountScreen,
	type NotificationPermissionResult,
	NotificationsScreen,
	ProfileEditorScreen,
	ProfileSourceScreen,
	SignInScreen,
	WelcomeScreen,
} from "./OnboardingScreens";
import { ONBOARDING_DOT_COUNT, type OnboardingStep } from "./onboarding-steps";
import { PagerDots } from "./PagerDots";
import {
	ProfileSetupPicker,
	type ProfileSetupRecords,
	type ProfileSetupSource,
	profileSetupOptions,
} from "./ProfileSetupPicker";

const haptics = {
	impact: fn(),
	selection: fn(),
	notification: fn(),
} satisfies Haptics;

type Args = {
	onChange: (value: string) => void;
	onFileChange: (file: File) => void;
	onSignIn: (handle: string, account?: HandleSuggestion) => void;
	onHandleQuery: (query: string) => void;
};

const meta: Meta<Args> = {
	title: "Surfaces/Onboarding",
	parameters: { viewport: { defaultViewport: "iphone" } },
	args: {
		onChange: fn(),
		onFileChange: fn(),
		onSignIn: fn(),
		onHandleQuery: fn(),
	},
};

export default meta;
type Story = StoryObj<Args>;

const ProfileStart = (props: {
	records?: ProfileSetupRecords;
	onChange?: (value: string) => void;
}) => {
	const [choice, setChoice] = createSignal<ProfileSetupSource>();
	return (
		<HapticsProvider haptics={haptics}>
			<OnboardingFlow
				title="Set up your profile"
				dot={0}
				dotCount={ONBOARDING_DOT_COUNT}
			>
				<ProfileSourceScreen
					options={profileSetupOptions(
						props.records ?? { colibriProfile: false, blueskyProfile: true },
					)}
					value={choice()}
					onChange={(value) => {
						setChoice(value);
						props.onChange?.(value);
					}}
					onNext={() => {}}
				/>
			</OnboardingFlow>
		</HapticsProvider>
	);
};

export const ProfileSetupStart: Story = {
	render: (args) => <ProfileStart onChange={args.onChange} />,
	play: async ({ canvasElement, args }) => {
		haptics.selection.mockClear();
		const canvas = within(canvasElement);
		const bluesky = canvas.getByRole("radio", { name: "Import from Bluesky" });
		const scratch = canvas.getByRole("radio", { name: "Start from scratch" });
		await expect(bluesky).toBeChecked();
		await expect(
			canvas.queryByRole("radio", { name: "Use existing profile" }),
		).toBeNull();

		await userEvent.click(canvas.getByText("Start from scratch"));
		await expect(scratch).toBeChecked();
		await expect(args.onChange).toHaveBeenCalledTimes(1);
		await expect(args.onChange).toHaveBeenLastCalledWith("scratch");
		await expect(haptics.selection).toHaveBeenCalledTimes(1);

		await userEvent.click(canvas.getByText("Start from scratch"));
		await expect(args.onChange).toHaveBeenCalledTimes(1);
		await expect(haptics.selection).toHaveBeenCalledTimes(1);

		await expect(
			canvas.getByRole("img", { name: "Step 1 of 2" }),
		).toBeInTheDocument();

		const tiles = Array.from(
			canvasElement.querySelectorAll<HTMLElement>("[data-selectable-card]"),
		);
		await expect(tiles.map((tile) => tile.dataset.layout)).toEqual([
			"tile",
			"tile",
		]);
		const [first, second] = tiles.map((tile) => tile.getBoundingClientRect());
		await expect(Math.round(first.top)).toBe(Math.round(second.top));
		await expect(second.left).toBeGreaterThan(first.right);
	},
};

export const ReturningUser: Story = {
	render: (args) => (
		<ProfileStart
			records={{ colibriProfile: true, blueskyProfile: true }}
			onChange={args.onChange}
		/>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const radios = canvas.getAllByRole("radio");
		await expect(radios).toHaveLength(3);
		const existing = canvas.getByRole("radio", {
			name: "Use existing profile",
		});
		await expect(existing).toBeChecked();
		const elements = Array.from(
			canvasElement.querySelectorAll<HTMLElement>("[data-selectable-card]"),
		);
		await expect(elements.map((tile) => tile.dataset.layout)).toEqual([
			"row",
			"row",
			"row",
		]);
		const group = canvas.getByRole("radiogroup").getBoundingClientRect();
		const tiles = elements.map((tile) => tile.getBoundingClientRect());
		for (const [index, tile] of tiles.entries()) {
			await expect(tile.height).toBeGreaterThanOrEqual(56);
			await expect(Math.round(tile.left)).toBe(Math.round(group.left));
			await expect(Math.round(tile.width)).toBe(Math.round(group.width));
			await expect(tile.right).toBeLessThanOrEqual(window.innerWidth);
			if (index > 0)
				await expect(tile.top).toBeGreaterThanOrEqual(tiles[index - 1].bottom);
		}
		await expect(existing).toHaveAccessibleDescription(
			"Keep your Colibri name, picture and theme.",
		);
		const title = within(elements[0]).getByText("Use existing profile");
		const lineHeight = Number.parseFloat(getComputedStyle(title).lineHeight);
		await expect(title.getBoundingClientRect().height).toBeLessThanOrEqual(
			lineHeight * 1.5,
		);
	},
};

export const ColibriProfileWithoutBluesky: Story = {
	render: (args) => (
		<ProfileStart
			records={{ colibriProfile: true, blueskyProfile: false }}
			onChange={args.onChange}
		/>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getAllByRole("radio")).toHaveLength(2);
		const existing = canvas.getByRole("radio", {
			name: "Use existing profile",
		});
		await expect(existing).toBeChecked();
		await expect(
			canvas.queryByRole("radio", { name: "Import from Bluesky" }),
		).toBeNull();
		const tile = existing.closest("[data-selectable-card]") as HTMLElement;
		const logo = tile.querySelector<HTMLImageElement>("img[data-colibri-logo]");
		await expect(logo).not.toBeNull();
		await expect(logo?.getAttribute("src")).toContain("colibri-logo");
		await expect(tile.querySelector("[data-hummingbird]")).toBeNull();
		await expect(tile.querySelector("svg")).toBeNull();
		await expect(logo?.getAnimations().length).toBe(0);
	},
};

export const KeyboardSelection: Story = {
	render: (args) => <ProfileStart onChange={args.onChange} />,
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const bluesky = canvas.getByRole("radio", { name: "Import from Bluesky" });
		const scratch = canvas.getByRole("radio", { name: "Start from scratch" });
		bluesky.focus();
		await userEvent.keyboard("{ArrowRight}");
		await waitFor(() => expect(scratch).toBeChecked());
		await expect(args.onChange).toHaveBeenLastCalledWith("scratch");
		await userEvent.keyboard("{ArrowLeft}");
		await waitFor(() => expect(bluesky).toBeChecked());
		await expect(args.onChange).toHaveBeenLastCalledWith("bluesky");
	},
};

const ToggleRecords = (props: { onChange: (value: string) => void }) => {
	const [bluesky, setBluesky] = createSignal(true);
	const [choice, setChoice] = createSignal<ProfileSetupSource>("bluesky");
	return (
		<div class="flex flex-col gap-4 bg-background p-6">
			<Button variant="secondary" onClick={() => setBluesky((value) => !value)}>
				Toggle Bluesky record
			</Button>
			<ProfileSetupPicker
				options={profileSetupOptions({
					colibriProfile: true,
					blueskyProfile: bluesky(),
				})}
				value={choice()}
				onChange={(value) => {
					setChoice(value);
					props.onChange(value);
				}}
			/>
		</div>
	);
};

export const HiddenSelectionFallsBack: Story = {
	render: (args) => <ToggleRecords onChange={args.onChange} />,
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole("radio", { name: "Import from Bluesky" }),
		).toBeChecked();
		await userEvent.click(
			canvas.getByRole("button", { name: "Toggle Bluesky record" }),
		);
		await waitFor(() =>
			expect(
				canvas.getByRole("radio", { name: "Use existing profile" }),
			).toBeChecked(),
		);
		await expect(args.onChange).toHaveBeenLastCalledWith("existing");
	},
};

export const Pager: Story = {
	render: () => (
		<div class="flex flex-col items-center gap-4 bg-background p-8">
			<PagerDots count={4} index={0} />
			<PagerDots count={4} index={1} />
			<PagerDots count={4} index={3} />
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const second = canvas.getByRole("img", { name: "Step 2 of 4" });
		const dots = second.querySelectorAll("[data-pager-dot]");
		await expect(dots[0]).toHaveAttribute("data-pager-dot", "completed");
		await expect(dots[1]).toHaveAttribute("data-pager-dot", "active");
		await expect(dots[2]).toHaveAttribute("data-pager-dot", "upcoming");
	},
};

const DEMO_DID = "did:plc:ewvi7nxzyoun6zhxrhs64oiz";
const DEMO_HANDLE = "alice.bsky.social";
const DEMO_AVATAR = defaultAvatarUrl(defaultAvatarFor(DEMO_DID));

const HANDLE_SUGGESTIONS: HandleSuggestion[] = [
	{
		did: DEMO_DID,
		handle: DEMO_HANDLE,
		displayName: "Alice Liddell",
		avatar: DEMO_AVATAR,
	},
	{
		did: "did:plc:alicia4tangled0000000000",
		handle: "alicia.tngl.sh",
		displayName: "Alicia Moreno",
	},
	{
		did: "did:plc:albert5semble00000000000",
		handle: "albert.semble.so",
	},
	{
		did: "did:plc:bob6bluesky0000000000000",
		handle: "bob.bsky.social",
		displayName: "Bob",
	},
];

const matchHandles = (query: string) => {
	const needle = query.toLowerCase();
	if (!needle) return [];
	return HANDLE_SUGGESTIONS.filter(
		(account) =>
			account.handle.startsWith(needle) ||
			account.displayName?.toLowerCase().includes(needle),
	).slice(0, 8);
};

const STEP_TITLES: Record<OnboardingStep, string> = {
	welcome: "Welcome to Colibri Social",
	"sign-in": "Sign in",
	"create-account": "Create an account",
	"profile-source": "Set up your profile",
	"profile-editor": "Set up your profile",
	notifications: "Notifications",
};

const paintedPng = async (name: string, stops: [string, string]) => {
	const blob = await (await fetch(paintImage(96, 96, stops))).blob();
	return new File([blob], name, { type: "image/png" });
};

const pick = (input: HTMLInputElement, file: File) => {
	const transfer = new DataTransfer();
	transfer.items.add(file);
	input.files = transfer.files;
	input.dispatchEvent(new Event("change", { bubbles: true }));
};

const OnboardingDemo = (props: {
	platform: OnboardingPlatform;
	start?: OnboardingStep;
	records?: ProfileSetupRecords;
	avatarSrc?: string;
	requestPermission?: () => Promise<NotificationPermissionResult>;
	onOpenBrowser?: () => void;
	onSignIn?: (handle: string, account?: HandleSuggestion) => void;
	onHandleQuery?: (query: string) => void;
	suggestHandles?: boolean;
	onComplete?: (result: OnboardingResult) => void;
}) => {
	const [handleSuggestions, setHandleSuggestions] = createSignal<
		HandleSuggestion[]
	>([]);
	const records = () =>
		props.records ?? { colibriProfile: false, blueskyProfile: true };
	const onboarding = createOnboarding({
		records,
		start: props.start,
		onComplete: (result) => props.onComplete?.(result),
	});
	const [name, setName] = createSignal("");
	const [nameColor, setNameColor] = createSignal("#ffffff");
	const [pronouns, setPronouns] = createSignal("");
	const [bio, setBio] = createSignal("");
	const [colors, setColors] = createSignal(["#4ade80"]);
	const [sync, setSync] = createSignal(true);

	return (
		<HapticsProvider haptics={haptics}>
			<div class="min-h-dvh bg-background">
				<OnboardingFlow
					platform={props.platform}
					title={STEP_TITLES[onboarding.step()]}
					dot={onboarding.dot()}
					dotCount={ONBOARDING_DOT_COUNT}
					steps={onboarding.items()}
					onStepSelect={onboarding.goTo}
					onBack={onboarding.canGoBack() ? onboarding.back : undefined}
				>
					<Switch>
						<Match when={onboarding.step() === "welcome"}>
							<WelcomeScreen onStart={() => onboarding.goTo("sign-in")} />
						</Match>
						<Match when={onboarding.step() === "sign-in"}>
							<SignInScreen
								handleSuggestions={handleSuggestions()}
								onHandleQuery={
									props.suggestHandles
										? (query) => {
												props.onHandleQuery?.(query);
												setHandleSuggestions(matchHandles(query));
											}
										: undefined
								}
								onSignIn={(handle, account) => {
									if (account) props.onSignIn?.(handle, account);
									else props.onSignIn?.(handle);
									onboarding.signedIn();
								}}
								onCreateAccount={() => onboarding.goTo("create-account")}
							/>
						</Match>
						<Match when={onboarding.step() === "create-account"}>
							<CreateAccountScreen
								onBack={onboarding.back}
								onOpenBrowser={() => props.onOpenBrowser?.()}
							/>
						</Match>
						<Match when={onboarding.step() === "profile-source"}>
							<ProfileSourceScreen
								options={profileSetupOptions(records())}
								value={onboarding.source()}
								onChange={onboarding.setSource}
								onNext={onboarding.next}
							/>
						</Match>
						<Match when={onboarding.step() === "profile-editor"}>
							<ProfileEditorScreen
								platform={props.platform}
								handle={DEMO_HANDLE}
								displayName={name()}
								onDisplayNameChange={setName}
								nameColor={nameColor()}
								onNameColorChange={setNameColor}
								pronouns={pronouns()}
								onPronounsChange={setPronouns}
								bio={bio()}
								onBioChange={setBio}
								themeColors={colors()}
								onThemeColorsChange={setColors}
								avatarSrc={props.avatarSrc}
								syncWithBluesky={sync()}
								onSyncWithBlueskyChange={
									onboarding.source() === "bluesky" ? setSync : undefined
								}
								onBack={onboarding.canGoBack() ? onboarding.back : undefined}
								onNext={onboarding.saveProfile}
							/>
						</Match>
						<Match when={onboarding.step() === "notifications"}>
							<NotificationsScreen
								requestPermission={props.requestPermission}
								onDone={onboarding.finish}
							/>
						</Match>
					</Switch>
				</OnboardingFlow>
				<output data-onboarding-result="" class="sr-only">
					{onboarding.result() ? JSON.stringify(onboarding.result()) : ""}
				</output>
			</div>
		</HapticsProvider>
	);
};

const desktopViewport = { viewport: { defaultViewport: "responsive" } };

const scope = async (
	platform: OnboardingPlatform,
	canvasElement: HTMLElement,
) =>
	platform === "desktop"
		? within(await screen.findByRole("dialog"))
		: within(canvasElement);

const entranceDelays = (root: ParentNode) =>
	Array.from(root.querySelectorAll<HTMLElement>("[data-entrance]")).map(
		(element) =>
			Number.parseFloat(element.style.getPropertyValue("--entrance-delay")),
	);

const readResult = (canvasElement: HTMLElement) => {
	const text =
		canvasElement.querySelector("[data-onboarding-result]")?.textContent ?? "";
	return text ? (JSON.parse(text) as OnboardingResult) : undefined;
};

const suggestionList = () =>
	waitFor(() => {
		const listbox = document.querySelector<HTMLElement>(
			"[data-handle-suggestions] [role=listbox]",
		);
		if (!listbox) throw new Error("No handle suggestions");
		return listbox;
	});

const activeOption = (field: HTMLElement) => {
	const id = field.getAttribute("aria-activedescendant");
	return id ? document.getElementById(id) : null;
};

const typeHandleQuery = async (
	canvas: ReturnType<typeof within>,
	args: Args,
) => {
	const field = canvas.getByRole("combobox", { name: "Handle or username" });
	await userEvent.type(field, "@al");
	await waitFor(() =>
		expect(args.onHandleQuery).toHaveBeenLastCalledWith("al"),
	);
	const listbox = await suggestionList();
	await waitFor(() =>
		expect(
			within(listbox)
				.getAllByRole("option")
				.map((option) => option.getAttribute("data-handle-suggestion")),
		).toEqual([
			DEMO_DID,
			"did:plc:alicia4tangled0000000000",
			"did:plc:albert5semble00000000000",
		]),
	);
	return field;
};

export const Welcome: Story = {
	render: (args) => (
		<OnboardingDemo
			platform="mobile"
			suggestHandles
			onSignIn={args.onSignIn}
			onHandleQuery={args.onHandleQuery}
		/>
	),
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const heading = canvas.getByRole("heading", { level: 1 });
		await expect(heading).toHaveTextContent("Welcome to Colibri Social");
		await expect(
			canvasElement.querySelector("[data-hummingbird]"),
		).toBeInTheDocument();
		const words = heading.querySelectorAll('[data-entrance="word"]');
		await expect(words).toHaveLength(4);
		await expect(getComputedStyle(words[0]).animationName).toBe(
			"onboarding-rise",
		);
		const delays = entranceDelays(canvasElement);
		await expect(delays[0]).toBe(0);
		for (let index = 1; index < delays.length; index++)
			await expect(delays[index]).toBeGreaterThanOrEqual(delays[index - 1]);
		await expect(
			canvas.queryByRole("img", { name: /Step/ }),
		).not.toBeInTheDocument();
		await userEvent.click(canvas.getByRole("button", { name: "Start setup" }));
		await canvas.findByRole("heading", {
			name: "Sign in with your existing account",
		});

		const field = await typeHandleQuery(canvas, args);
		await expect(activeOption(field)).toBeNull();
		await userEvent.keyboard("{ArrowDown}");
		await waitFor(() =>
			expect(activeOption(field)).toHaveTextContent("alice.bsky.social"),
		);
		await userEvent.keyboard("{ArrowDown}");
		await waitFor(() =>
			expect(activeOption(field)).toHaveTextContent("alicia.tngl.sh"),
		);
		await expect(activeOption(field)).toHaveAttribute("data-highlighted");
		await userEvent.keyboard("{Enter}");
		await waitFor(() =>
			expect(args.onSignIn).toHaveBeenCalledWith(
				"alicia.tngl.sh",
				expect.objectContaining({ did: "did:plc:alicia4tangled0000000000" }),
			),
		);
		await canvas.findByRole("heading", { name: /profile going/ });
	},
};

export const WelcomeReducedMotion: Story = {
	render: (args) => (
		<OnboardingDemo
			platform="mobile"
			suggestHandles
			onSignIn={args.onSignIn}
			onHandleQuery={args.onHandleQuery}
		/>
	),
	play: async ({ canvasElement, args }) => {
		const root = document.documentElement;
		const previous = root.dataset.reducedMotion;
		root.dataset.reducedMotion = "true";
		try {
			const word = canvasElement.querySelector('[data-entrance="word"]');
			if (!word) throw new Error("Missing entrance word");
			await waitFor(() =>
				expect(getComputedStyle(word).animationName).toBe("onboarding-fade"),
			);
			await expect(getComputedStyle(word).animationDelay).toBe("0s");

			const canvas = within(canvasElement);
			await userEvent.click(
				canvas.getByRole("button", { name: "Start setup" }),
			);
			const field = await typeHandleQuery(canvas, args);
			await userEvent.keyboard("{ArrowUp}");
			await waitFor(() =>
				expect(activeOption(field)).toHaveTextContent("albert.semble.so"),
			);
			await userEvent.keyboard("{Tab}");
			await waitFor(() =>
				expect(args.onSignIn).toHaveBeenCalledWith(
					"albert.semble.so",
					expect.objectContaining({ did: "did:plc:albert5semble00000000000" }),
				),
			);
			await canvas.findByRole("heading", { name: /profile going/ });
		} finally {
			if (previous === undefined) delete root.dataset.reducedMotion;
			else root.dataset.reducedMotion = previous;
		}
	},
};

const signInPlay =
	(platform: OnboardingPlatform) =>
	async ({
		canvasElement,
		args,
	}: {
		canvasElement: HTMLElement;
		args: Args;
	}) => {
		const view = await scope(platform, canvasElement);
		const login = view.getByRole("button", { name: /Log in/ });
		await expect(login).toBeDisabled();
		const field = view.getByLabelText("Handle or username");
		await userEvent.type(field, "@alice.bsky.social");
		await expect(login).toBeEnabled();
		const boxes = entranceDelays(
			(platform === "desktop"
				? await screen.findByRole("dialog")
				: canvasElement) as HTMLElement,
		);
		await expect(Math.max(...boxes)).toBeGreaterThan(0);
		await userEvent.click(login);
		await expect(args.onChange).toHaveBeenCalledWith("alice.bsky.social");
		await view.findByRole("heading", { name: /profile going/ });
	};

export const SignIn: Story = {
	render: (args) => (
		<OnboardingDemo
			platform="mobile"
			start="sign-in"
			onSignIn={args.onChange}
		/>
	),
	play: signInPlay("mobile"),
};

const createAccountPlay =
	(platform: OnboardingPlatform) =>
	async ({
		canvasElement,
		args,
	}: {
		canvasElement: HTMLElement;
		args: Args;
	}) => {
		const view = await scope(platform, canvasElement);
		const link = view.getByRole("link", {
			name: "What is an Atmosphere account?",
		});
		await expect(link).toHaveAttribute(
			"href",
			"https://atmosphereaccount.com/",
		);
		await expect(link).toHaveAttribute("target", "_blank");
		await expect(link.getAttribute("rel")).toContain("noopener");
		await userEvent.click(view.getByRole("button", { name: /Open browser/ }));
		await expect(args.onChange).toHaveBeenCalledWith("open-browser");
		await userEvent.click(view.getByRole("button", { name: "Back" }));
		await view.findByRole("heading", {
			name: "Sign in with your existing account",
		});
	};

export const CreateAccount: Story = {
	render: (args) => (
		<OnboardingDemo
			platform="mobile"
			start="create-account"
			onOpenBrowser={() => args.onChange("open-browser")}
		/>
	),
	play: createAccountPlay("mobile"),
};

export const ProfileEditorFromBluesky: Story = {
	render: () => (
		<OnboardingDemo
			platform="mobile"
			start="profile-source"
			records={{ colibriProfile: false, blueskyProfile: true }}
		/>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole("img", { name: "Step 1 of 2" }),
		).toBeInTheDocument();
		await userEvent.click(canvas.getByRole("button", { name: "Next" }));
		await canvas.findByLabelText("Display name");
		await expect(
			canvas.getByRole("switch", { name: /Stay in sync with Bluesky/ }),
		).toBeChecked();
		await expect(
			canvas.getByRole("img", { name: "Step 1 of 2" }),
		).toBeInTheDocument();
		await userEvent.type(canvas.getByLabelText("Display name"), "Alice");
		await userEvent.click(canvas.getByRole("button", { name: "Next" }));
		await canvas.findByRole("heading", {
			name: "Want to receive notifications?",
		});
		const dots = canvas.getByRole("img", { name: "Step 2 of 2" });
		await expect(
			Array.from(dots.querySelectorAll("[data-pager-dot]")).map((dot) =>
				dot.getAttribute("data-pager-dot"),
			),
		).toEqual(["completed", "active"]);
	},
};

export const ProfileEditorFromScratch: Story = {
	render: (args) => (
		<OnboardingDemo
			platform="mobile"
			start="profile-editor"
			records={{ colibriProfile: false, blueskyProfile: false }}
			avatarSrc={DEMO_AVATAR}
			onComplete={(result) => args.onChange(JSON.stringify(result))}
		/>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.queryByRole("switch", { name: /Stay in sync/ }),
		).toBeNull();
		await expect(canvas.queryByRole("button", { name: "Back" })).toBeNull();
		const picture = Array.from(canvasElement.querySelectorAll("img")).find(
			(image) => image.getAttribute("src") === DEMO_AVATAR,
		);
		await expect(picture).toBeDefined();
		await expect(canvas.getByLabelText("Display name")).toHaveAttribute(
			"placeholder",
			DEMO_HANDLE,
		);
		const next = canvas.getByRole("button", { name: "Next" });
		await expect(next).toBeEnabled();
		await userEvent.click(next);
		await canvas.findByRole("heading", {
			name: "Want to receive notifications?",
		});
		await userEvent.click(canvas.getByRole("button", { name: "Skip" }));
		await waitFor(() =>
			expect(readResult(canvasElement)?.profile?.displayName).toBe(DEMO_HANDLE),
		);
	},
};

export const ProfileImagesPreview: Story = {
	render: () => (
		<OnboardingDemo
			platform="mobile"
			start="profile-editor"
			records={{ colibriProfile: false, blueskyProfile: false }}
		/>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const inputs = Array.from(
			canvasElement.querySelectorAll<HTMLInputElement>('input[type="file"]'),
		);
		await expect(inputs).toHaveLength(2);
		const [bannerInput, avatarInput] = inputs;
		for (const name of ["Add banner", "Add picture"]) {
			const icon = canvas.getByRole("button", { name }).querySelector("svg");
			if (!icon) throw new Error(`Missing image icon in ${name}`);
			const box = icon.getBoundingClientRect();
			await expect(box.width).toBeGreaterThan(0);
			await expect(
				document
					.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
					?.closest("svg"),
			).toBe(icon);
		}

		pick(avatarInput, await paintedPng("avatar.png", ["#8e51ff", "#5b21b6"]));
		const avatar = await waitFor(() => {
			const image = canvasElement.querySelector<HTMLImageElement>(
				"[data-profile-avatar-preview]",
			);
			if (!image) throw new Error("No avatar preview");
			return image;
		});
		await expect(avatar.getAttribute("src")).toMatch(/^blob:/);
		await expect(
			canvas.getByRole("button", { name: "Change picture" }),
		).toBeInTheDocument();

		pick(bannerInput, await paintedPng("banner.png", ["#f472b6", "#7c3aed"]));
		const banner = await waitFor(() => {
			const image = canvasElement.querySelector<HTMLImageElement>(
				"[data-profile-banner-preview]",
			);
			if (!image) throw new Error("No banner preview");
			return image;
		});
		await expect(banner.getAttribute("src")).toMatch(/^blob:/);
		const firstBanner = banner.getAttribute("src");
		pick(bannerInput, await paintedPng("banner-2.png", ["#2dd4bf", "#0f766e"]));
		await waitFor(() =>
			expect(
				canvasElement
					.querySelector("[data-profile-banner-preview]")
					?.getAttribute("src"),
			).not.toBe(firstBanner),
		);
		await userEvent.click(
			canvas.getByRole("button", { name: "Remove banner" }),
		);
		await waitFor(() =>
			expect(
				canvasElement.querySelector("[data-profile-banner-preview]"),
			).toBeNull(),
		);
		await expect(
			canvas.getByRole("button", { name: "Add banner" }),
		).toBeInTheDocument();
	},
};

export const ProfileImageError: Story = {
	render: () => (
		<OnboardingDemo
			platform="mobile"
			start="profile-editor"
			records={{ colibriProfile: false, blueskyProfile: false }}
		/>
	),
	play: async ({ canvasElement }) => {
		const input =
			canvasElement.querySelector<HTMLInputElement>('input[type="file"]');
		if (!input) throw new Error("Missing file input");
		pick(input, new File(["x"], "photo.heic", { type: "image/heic" }));
		const alert = await within(canvasElement).findByRole("alert");
		await expect(alert).toHaveTextContent(
			"HEIC isn't supported. Use PNG, JPEG, WebP or GIF.",
		);
	},
};

export const SkipsProfileChoiceWithoutRecords: Story = {
	render: () => (
		<OnboardingDemo
			platform="mobile"
			start="sign-in"
			records={{ colibriProfile: false, blueskyProfile: false }}
		/>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.type(
			canvas.getByLabelText("Handle or username"),
			"alice.bsky.social",
		);
		await userEvent.click(canvas.getByRole("button", { name: "Log in" }));
		await canvas.findByLabelText("Display name");
		await expect(canvas.queryByRole("radiogroup")).toBeNull();
		await expect(
			canvas.queryByRole("heading", { name: /profile going/ }),
		).toBeNull();
	},
};

export const ExistingProfileSkipsEditor: Story = {
	render: (args) => (
		<OnboardingDemo
			platform="mobile"
			start="profile-source"
			records={{ colibriProfile: true, blueskyProfile: true }}
			onComplete={(result) => args.onChange(result.source)}
		/>
	),
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole("radio", { name: "Use existing profile" }),
		).toBeChecked();
		await userEvent.click(canvas.getByRole("button", { name: "Next" }));
		await canvas.findByRole("heading", {
			name: "Want to receive notifications?",
		});
		await userEvent.click(canvas.getByRole("button", { name: "Skip" }));
		await waitFor(() => expect(args.onChange).toHaveBeenCalledWith("existing"));
		await expect(readResult(canvasElement)?.profile).toBeUndefined();
	},
};

const notificationsPlay =
	(platform: OnboardingPlatform) =>
	async ({
		canvasElement,
		args,
	}: {
		canvasElement: HTMLElement;
		args: Args;
	}) => {
		const original = globalThis.Notification;
		const request = fn(async () => "granted" as NotificationPermission);
		Object.defineProperty(globalThis, "Notification", {
			configurable: true,
			value: { requestPermission: request, permission: "default" },
		});
		try {
			const view = await scope(platform, canvasElement);
			await userEvent.click(
				view.getByRole("button", { name: /Enable notifications/ }),
			);
			await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
			await waitFor(() =>
				expect(args.onChange).toHaveBeenCalledWith("granted"),
			);
			await expect(readResult(canvasElement)?.notifications).toBe("granted");
		} finally {
			Object.defineProperty(globalThis, "Notification", {
				configurable: true,
				value: original,
			});
		}
	};

export const Notifications: Story = {
	render: (args) => (
		<OnboardingDemo
			platform="mobile"
			start="notifications"
			onComplete={(result) => args.onChange(result.notifications)}
		/>
	),
	play: notificationsPlay("mobile"),
};

export const NotificationsDeniedFinishes: Story = {
	render: (args) => (
		<OnboardingDemo
			platform="mobile"
			start="notifications"
			requestPermission={async () => "denied"}
			onComplete={(result) => args.onChange(result.notifications)}
		/>
	),
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole("button", { name: "Enable notifications" }),
		);
		await waitFor(() => expect(args.onChange).toHaveBeenCalledWith("denied"));
		await expect(args.onChange).toHaveBeenCalledTimes(1);
		await expect(readResult(canvasElement)).toEqual({
			source: "bluesky",
			notifications: "denied",
		});
	},
};

export const HummingbirdPausesWhenInactive: Story = {
	render: () => <OnboardingDemo platform="mobile" />,
	play: async ({ canvasElement }) => {
		setAppActive(false);
		try {
			await waitFor(() =>
				expect(
					canvasElement.querySelector(".hb-rig.hb-paused"),
				).toBeInTheDocument(),
			);
		} finally {
			setAppActive(undefined);
		}
		await waitFor(() =>
			expect(canvasElement.querySelector(".hb-rig.hb-paused")).toBeNull(),
		);
	},
};

const desktop = (
	start: OnboardingStep,
	records?: ProfileSetupRecords,
): Story => ({
	parameters: desktopViewport,
	render: (args) => (
		<OnboardingDemo
			platform="desktop"
			start={start}
			records={records}
			avatarSrc={DEMO_AVATAR}
			onSignIn={args.onChange}
			onOpenBrowser={() => args.onChange("open-browser")}
			onComplete={(result) => args.onChange(result.notifications)}
		/>
	),
});

const footerButtons = (dialog: HTMLElement) =>
	Array.from(
		dialog.querySelectorAll<HTMLButtonElement>(
			'[data-onboarding-actions="footer"] button',
		),
	);

export const WelcomeDesktop: Story = {
	...desktop("welcome"),
	play: async () => {
		const dialog = await screen.findByRole("dialog", {
			name: "Welcome to Colibri Social",
		});
		await expect(dialog.offsetWidth).toBeLessThanOrEqual(880);
		await expect(dialog.offsetWidth).toBeGreaterThan(800);
		await expect(dialog.offsetHeight).toBeGreaterThanOrEqual(
			Math.min(560, window.innerHeight - 40),
		);
		const sidebar = dialog.querySelector("[data-onboarding-sidebar]");
		await expect(sidebar?.querySelector("[data-hummingbird]")).not.toBeNull();
		await expect(dialog.querySelectorAll("[data-hummingbird]").length).toBe(1);
		const steps = within(dialog).getByRole("list", { name: "Setup steps" });
		await expect(within(steps).getAllByRole("listitem")).toHaveLength(4);
		await expect(
			steps.querySelector('[aria-current="step"]'),
		).toHaveTextContent("Welcome");
		const [start] = footerButtons(dialog);
		await expect(start).toHaveAccessibleName(/Start setup/);
		await expect(start).toHaveAttribute("aria-keyshortcuts", "Enter");
		await expect(
			start.querySelector("[data-onboarding-key-hint]"),
		).toBeInTheDocument();
		await expect(
			dialog.querySelector('[data-onboarding-actions="inline"]'),
		).toBeNull();
		dialog.focus();
		await userEvent.keyboard("{Enter}");
		await within(dialog).findByRole("heading", {
			name: "Sign in with your existing account",
		});
		await userEvent.keyboard("{Escape}");
		await within(dialog).findByRole("heading", {
			level: 1,
			name: "Welcome to Colibri Social",
		});
		await expect(dialog).toBeInTheDocument();
	},
};

export const SignInDesktop: Story = {
	...desktop("sign-in"),
	play: signInPlay("desktop"),
};

export const CreateAccountDesktop: Story = {
	...desktop("create-account"),
	play: createAccountPlay("desktop"),
};

export const ProfileSourceDesktop: Story = {
	...desktop("profile-source", {
		colibriProfile: true,
		blueskyProfile: true,
	}),
	play: async () => {
		const dialog = await screen.findByRole("dialog");
		const view = within(dialog);
		await expect(view.getAllByRole("radio")).toHaveLength(3);
		const steps = view.getByRole("list", { name: "Setup steps" });
		await expect(within(steps).queryAllByRole("button")).toHaveLength(0);
		await expect(
			steps.querySelector('[aria-current="step"]'),
		).toHaveTextContent("Profile");
	},
};

export const ProfileEditorDesktop: Story = {
	...desktop("profile-editor", {
		colibriProfile: false,
		blueskyProfile: false,
	}),
	play: async () => {
		const dialog = await screen.findByRole("dialog");
		const view = within(dialog);
		const row = dialog.querySelector<HTMLElement>("[data-profile-name-row]");
		const name = view.getByLabelText("Display name");
		const pronouns = view.getByLabelText("Pronouns");
		await expect(row).not.toBeNull();
		await expect(Math.round(pronouns.getBoundingClientRect().top)).toBe(
			Math.round(name.getBoundingClientRect().top),
		);
		name.focus();
		await userEvent.keyboard("{Enter}");
		await view.findByRole("heading", {
			name: "Want to receive notifications?",
		});
	},
};

export const NotificationsDesktop: Story = {
	...desktop("notifications"),
	play: notificationsPlay("desktop"),
};

export const SplitStepListNavigation: Story = {
	...desktop("notifications", {
		colibriProfile: false,
		blueskyProfile: true,
	}),
	play: async () => {
		const dialog = await screen.findByRole("dialog");
		const view = within(dialog);
		const steps = view.getByRole("list", { name: "Setup steps" });
		const markers = Array.from(
			steps.querySelectorAll<HTMLElement>("[data-step-marker]"),
		).map((marker) => marker.dataset.stepMarker);
		await expect(markers).toEqual([
			"completed",
			"completed",
			"completed",
			"current",
		]);
		const buttons = within(steps).getAllByRole("button");
		await expect(buttons).toHaveLength(1);
		await expect(buttons[0]).toHaveTextContent("Profile");
		await userEvent.click(buttons[0]);
		await view.findByRole("heading", { name: /profile going/ });
		await expect(
			steps.querySelector('[aria-current="step"]'),
		).toHaveTextContent("Profile");
		await userEvent.keyboard("{Alt>}{ArrowLeft}{/Alt}");
		await expect(
			view.getByRole("heading", { name: /profile going/ }),
		).toBeInTheDocument();
	},
};

export const KeyboardFlowDesktop: Story = {
	...desktop("welcome", {
		colibriProfile: false,
		blueskyProfile: true,
	}),
	play: async ({ args }) => {
		const dialog = await screen.findByRole("dialog");
		const view = within(dialog);
		dialog.focus();
		await userEvent.keyboard("{Enter}");
		const field = await view.findByLabelText("Handle or username");
		await userEvent.type(field, "alice.bsky.social{Enter}");
		await view.findByRole("heading", { name: /profile going/ });
		await expect(args.onChange).toHaveBeenCalledWith("alice.bsky.social");
		dialog.focus();
		await userEvent.keyboard("{Enter}");
		const name = await view.findByLabelText("Display name");
		await userEvent.keyboard("{Alt>}{ArrowLeft}{/Alt}");
		await view.findByRole("heading", { name: /profile going/ });
		dialog.focus();
		await userEvent.keyboard("{Enter}");
		await view.findByLabelText("Display name");
		await expect(name).not.toBeInTheDocument();
		dialog.focus();
		await userEvent.keyboard("{Enter}");
		await view.findByRole("heading", {
			name: "Want to receive notifications?",
		});
	},
};

export const DesktopFlowResizes: Story = {
	...desktop("profile-source", {
		colibriProfile: false,
		blueskyProfile: true,
	}),
	play: async () => {
		const dialog = await screen.findByRole("dialog");
		await new Promise((resolve) => setTimeout(resolve, 600));
		const before = dialog.offsetHeight;
		await expect(dialog.style.height).toBe("");
		dialog.focus();
		await userEvent.keyboard("{Enter}");
		await waitFor(() =>
			expect(dialog).toHaveAttribute("data-height-transition"),
		);
		await waitFor(() => expect(dialog.style.height).toBe(""), {
			timeout: 3000,
		});
		await expect(dialog.offsetHeight).toBeGreaterThan(before);
		await expect(dialog.offsetHeight).toBeLessThanOrEqual(760);
	},
};
