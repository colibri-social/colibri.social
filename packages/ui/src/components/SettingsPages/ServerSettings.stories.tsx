import { createSignal, type JSX, Show } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import { Button } from "../Button/Button";
import { AdvancedSettings } from "./AdvancedSettings";
import type { ServerCheck } from "./ServerSettings";

type Args = {
	onCheck?: (url: string) => void;
	onSwitch?: (url: string) => void;
	onReset?: () => void;
};

const meta: Meta<Args> = {
	title: "Surfaces/Settings pages/Server",
	parameters: { viewport: { defaultViewport: "iphone" } },
};

export default meta;
type Story = StoryObj<Args>;

const desktop = {
	viewport: {
		defaultViewport: "desktop",
		options: {
			desktop: {
				name: "Desktop",
				styles: { width: "1200px", height: "900px" },
				type: "desktop",
			},
		},
	},
};

const DEFAULT_HOST = "colibri.social";
const CHECK_DELAY = 700;
const SIGN_OUT_DELAY = 500;
const FIND = { timeout: 4000 };

const wait = (ms: number) => {
	return new Promise<void>((resolve) => setTimeout(resolve, ms));
};

const mockCheck = async (url: string): Promise<ServerCheck> => {
	await wait(CHECK_DELAY);

	const host = new URL(url).host;

	if (host === "offline.example.com") return { status: "unreachable" };
	if (host === "example.com") return { status: "notColibri" };

	if (host === "old.example.com") {
		return {
			status: "ok",
			url,
			host,
			features: { calls: false, otherServers: false },
		};
	}

	return {
		status: "ok",
		url,
		host,
		features: { calls: true, otherServers: true },
	};
};

type Platform = "mobile" | "desktop";

const Frame = (props: { platform: Platform; children: JSX.Element }) => (
	<div
		data-frame={props.platform}
		class={
			props.platform === "mobile"
				? "w-[402px] max-w-full bg-background px-4 py-6"
				: "w-[720px] bg-background px-8 py-8"
		}
	>
		{props.children}
	</div>
);

const MockSignIn = (props: { host: string; onSignIn: () => void }) => (
	<div
		data-mock-sign-in=""
		class="flex flex-col items-start gap-3 rounded-surface bg-secondary p-4"
	>
		<p class="m-0 text-xs font-semibold text-muted-foreground">
			Story mock: the app signs out and opens sign-in
		</p>
		<h2 class="m-0 text-xl font-semibold text-foreground">
			Sign in to Colibri
		</h2>
		<p class="m-0 text-sm text-muted-foreground">
			Requests go to {props.host} after you sign in.
		</p>
		<Button onClick={() => props.onSignIn()}>Sign in</Button>
	</div>
);

const ServerFlow = (props: {
	platform: Platform;
	initialHost?: string;
	failSwitch?: boolean;
	onCheck?: (url: string) => void;
	onSwitch?: (url: string) => void;
	onReset?: () => void;
}) => {
	const [host, setHost] = createSignal(props.initialHost ?? DEFAULT_HOST);
	const [signedOut, setSignedOut] = createSignal<string>();

	const signOutTo = async (next: string) => {
		await wait(SIGN_OUT_DELAY);

		if (props.failSwitch) throw new Error("switch failed");

		setSignedOut(next);
	};

	return (
		<Frame platform={props.platform}>
			<Show
				when={signedOut()}
				fallback={
					<AdvancedSettings
						platform={props.platform}
						developerMode={false}
						server={{
							host: host(),
							defaultHost: DEFAULT_HOST,
							onCheck: (url) => {
								props.onCheck?.(url);

								return mockCheck(url);
							},
							onSwitch: (url) => {
								props.onSwitch?.(url);

								return signOutTo(new URL(url).host);
							},
							onReset: () => {
								props.onReset?.();

								return signOutTo(DEFAULT_HOST);
							},
						}}
					/>
				}
			>
				{(next) => (
					<MockSignIn
						host={next()}
						onSignIn={() => {
							setHost(next());
							setSignedOut(undefined);
						}}
					/>
				)}
			</Show>
		</Frame>
	);
};

const openDialog = async (canvasElement: HTMLElement) => {
	const canvas = within(canvasElement);

	await userEvent.click(canvas.getByRole("button", { name: "Change server" }));

	const dialog = await screen.findByRole("dialog", { name: "Change server" });

	return {
		dialog,
		field: within(dialog).getByRole("textbox", { name: "Server address" }),
		check: within(dialog).getByRole("button", { name: "Check server" }),
	};
};

const shows = (scope: ReturnType<typeof within>, text: string | RegExp) => {
	return waitFor(() => expect(scope.getByText(text)).toBeVisible(), FIND);
};

const enter = async (field: HTMLElement, value: string) => {
	await userEvent.clear(field);
	await userEvent.type(field, value);
};

export const Playground: Story = {
	render: () => <ServerFlow platform="desktop" />,
	parameters: desktop,
};

export const SwitchServer: Story = {
	parameters: desktop,
	args: { onCheck: fn(), onSwitch: fn() },
	render: (args) => (
		<ServerFlow
			platform="desktop"
			onCheck={args.onCheck}
			onSwitch={args.onSwitch}
		/>
	),
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const current = canvasElement.querySelector("[data-server-current]");

		await expect(current).toHaveTextContent("colibri.social");
		await expect(
			within(current as HTMLElement).getByText("Default"),
		).toBeVisible();
		await expect(
			canvas.queryByRole("button", { name: /Go back to/ }),
		).toBeNull();

		const { dialog, field, check } = await openDialog(canvasElement);

		await waitFor(() => expect(field).toHaveFocus());
		await enter(field, "chat.example.com");
		await userEvent.click(check);
		await expect(check).toBeDisabled();
		await expect(args.onCheck).toHaveBeenCalledWith("https://chat.example.com");

		const verified = await screen.findByRole(
			"dialog",
			{ name: "Switch to chat.example.com?" },
			FIND,
		);

		await expect(
			verified.querySelectorAll('[data-server-feature="available"]'),
		).toHaveLength(3);
		await expect(verified.querySelector("[data-server-warning]")).toBeNull();
		await waitFor(() => expectNoLayoutIssues(dialog), { timeout: 3000 });
		await userEvent.click(
			within(verified).getByRole("button", { name: "Switch and sign out" }),
		);
		await expect(args.onSwitch).toHaveBeenCalledWith(
			"https://chat.example.com",
		);

		const signIn = await canvas.findByRole(
			"heading",
			{ name: "Sign in to Colibri" },
			FIND,
		);

		await expect(signIn).toBeVisible();
		await expect(canvas.getByText(/chat\.example\.com/)).toBeVisible();
		await userEvent.click(canvas.getByRole("button", { name: "Sign in" }));
		await expect(
			canvasElement.querySelector("[data-server-current]"),
		).toHaveTextContent("chat.example.com");
		await expect(
			canvas.getByRole("button", { name: "Go back to colibri.social" }),
		).toBeVisible();
		await expectNoLayoutIssues(
			canvasElement.querySelector("[data-frame]") as HTMLElement,
		);
	},
};

export const AddressProblems: Story = {
	parameters: desktop,
	args: { onCheck: fn() },
	render: (args) => <ServerFlow platform="desktop" onCheck={args.onCheck} />,
	play: async ({ canvasElement, args }) => {
		const { dialog, field, check } = await openDialog(canvasElement);
		const scope = within(dialog);

		await userEvent.click(check);
		await shows(scope, "Enter a server address.");
		await expect(field).toHaveAttribute("aria-invalid", "true");

		await enter(field, "not a server");
		await userEvent.click(check);
		await shows(scope, /This isn't a web address/);

		await enter(field, "https://colibri.social/app");
		await userEvent.click(check);
		await shows(scope, "You're already using this server.");
		await expect(args.onCheck).not.toHaveBeenCalled();

		await enter(field, "offline.example.com");
		await userEvent.click(check);
		await shows(scope, /This server didn't answer/);
		await waitFor(() => expect(field).toHaveFocus());

		await enter(field, "example.com");
		await expect(scope.queryByText(/This server didn't answer/)).toBeNull();
		await userEvent.click(check);
		await shows(scope, /doesn't run Colibri/);
		await expect(args.onCheck).toHaveBeenCalledTimes(2);
		await waitFor(() => expectNoLayoutIssues(dialog), { timeout: 3000 });
	},
};

export const OlderServer: Story = {
	parameters: desktop,
	render: () => <ServerFlow platform="desktop" />,
	play: async ({ canvasElement }) => {
		const { field, check } = await openDialog(canvasElement);

		await enter(field, "old.example.com");
		await userEvent.click(check);

		const verified = await screen.findByRole(
			"dialog",
			{ name: "Switch to old.example.com?" },
			FIND,
		);
		const scope = within(verified);

		await expect(
			verified.querySelectorAll('[data-server-feature="missing"]'),
		).toHaveLength(2);
		await expect(
			scope.getByText("Doesn't connect voice and video calls"),
		).toBeVisible();
		await expect(
			verified.querySelector("[data-server-warning]"),
		).toHaveTextContent(/won't show up while you use this server/);

		await userEvent.click(scope.getByRole("button", { name: "Back" }));

		const back = await screen.findByRole("dialog", { name: "Change server" });
		const backField = within(back).getByRole("textbox", {
			name: "Server address",
		});

		await expect(backField).toHaveValue("old.example.com");
		await waitFor(() => expect(backField).toHaveFocus());
		await waitFor(() => expectNoLayoutIssues(back), { timeout: 3000 });
	},
};

export const CancelWhileChecking: Story = {
	parameters: desktop,
	args: { onSwitch: fn() },
	render: (args) => <ServerFlow platform="desktop" onSwitch={args.onSwitch} />,
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const { dialog, field, check } = await openDialog(canvasElement);

		await enter(field, "chat.example.com");
		await userEvent.click(check);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Cancel" }),
		);
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		await wait(CHECK_DELAY + 200);
		await expect(screen.queryByRole("dialog")).toBeNull();

		const reopened = await openDialog(canvasElement);

		await expect(reopened.field).toHaveValue("");
		await expect(args.onSwitch).not.toHaveBeenCalled();
		await expect(
			canvasElement.querySelector("[data-server-current]"),
		).toHaveTextContent("colibri.social");
		await expect(
			canvas.queryByRole("heading", { name: "Sign in to Colibri" }),
		).toBeNull();
	},
};

export const SwitchFails: Story = {
	parameters: desktop,
	render: () => <ServerFlow platform="desktop" failSwitch />,
	play: async ({ canvasElement }) => {
		const { field, check } = await openDialog(canvasElement);

		await enter(field, "chat.example.com");
		await userEvent.click(check);

		const verified = await screen.findByRole(
			"dialog",
			{ name: "Switch to chat.example.com?" },
			FIND,
		);
		const scope = within(verified);

		await userEvent.click(
			scope.getByRole("button", { name: "Switch and sign out" }),
		);
		await expect(await scope.findByRole("alert", {}, FIND)).toHaveTextContent(
			"Couldn't switch servers. Try again.",
		);
		await expect(
			scope.getByRole("button", { name: "Switch and sign out" }),
		).toBeEnabled();
		await waitFor(() => expectNoLayoutIssues(verified), { timeout: 3000 });
	},
};

export const BackToDefault: Story = {
	parameters: desktop,
	args: { onReset: fn() },
	render: (args) => (
		<ServerFlow
			platform="desktop"
			initialHost="chat.example.com"
			onReset={args.onReset}
		/>
	),
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const current = canvasElement.querySelector(
			"[data-server-current]",
		) as HTMLElement;

		await expect(current).toHaveTextContent("chat.example.com");
		await expect(within(current).queryByText("Default")).toBeNull();
		await userEvent.click(
			canvas.getByRole("button", { name: "Go back to colibri.social" }),
		);

		const dialog = await screen.findByRole("dialog", {
			name: "Go back to colibri.social?",
		});

		await waitFor(() => expectNoLayoutIssues(dialog), { timeout: 3000 });
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Switch and sign out" }),
		);
		await expect(args.onReset).toHaveBeenCalledOnce();
		await userEvent.click(
			await canvas.findByRole("button", { name: "Sign in" }, FIND),
		);
		await expect(
			canvasElement.querySelector("[data-server-current]"),
		).toHaveTextContent("colibri.social");
	},
};

export const SwitchServerMobile: Story = {
	render: () => (
		<ServerFlow
			platform="mobile"
			initialHost="a-very-long-server-name.colibri-community-servers.example.org"
		/>
	),
	play: async ({ canvasElement }) => {
		await expectNoLayoutIssues(
			canvasElement.querySelector("[data-frame]") as HTMLElement,
		);

		const { dialog, field, check } = await openDialog(canvasElement);

		await enter(
			field,
			"another-very-long-server-name.colibri-servers.example.org",
		);
		await userEvent.click(check);

		const verified = await screen.findByRole(
			"dialog",
			{
				name: "Switch to another-very-long-server-name.colibri-servers.example.org?",
			},
			FIND,
		);

		await waitFor(() => expectNoLayoutIssues(verified), { timeout: 3000 });
		await expect(dialog).toBeInTheDocument();
	},
};
