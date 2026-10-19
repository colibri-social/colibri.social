import type { ColibriRichTextFacet } from "@colibri-social/lib";
import { createSignal } from "solid-js";
import {
	expect,
	fireEvent,
	fn,
	screen,
	spyOn,
	userEvent,
	waitFor,
	within,
} from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { LinkWarning } from "../LinkWarning/LinkWarning";
import { Popover, PopoverContent, PopoverTrigger } from "../Popover/Popover";
import {
	CUSTOM_EMOJI_FEATURE,
	type RichTextChannel,
	RichTextProvider,
	type RichTextResolvers,
	type TextWithFacets,
} from "./context";
import { build, encoder, FACET, f, feature, mark } from "./fixtures";
import { RichTextRenderer } from "./RichText";

const MEMBERS: Record<string, { did: string; name: string }> = {
	"did:plc:lou": { did: "did:plc:lou", name: "Lou" },
};

const ROLES: Record<string, { rkey: string; name: string; color?: string }> = {
	mods: { rkey: "mods", name: "Mods", color: "#3fbf7f" },
	plain: { rkey: "plain", name: "Plain" },
};

const CHANNELS: Record<string, RichTextChannel> = {
	general: { state: "ready", name: "general", href: "/c/general" },
	rules: {
		state: "ready",
		name: "rules",
		category: "Info",
		href: "/c/rules",
	},
	foreign: {
		state: "ready",
		name: "showcase",
		space: { name: "Hummingbird Club" },
		href: "/c/showcase",
	},
	secret: { state: "locked" },
	pending: { state: "loading" },
};

const THREADS: Record<string, string> = {
	"spring-tuning": "Spring tuning",
};

const onLinkOpen = fn((_href: string, event: MouseEvent) =>
	event.preventDefault(),
).mockName("onLinkOpen");
const onNavigate = fn((_href: string, event: MouseEvent) =>
	event.preventDefault(),
).mockName("onNavigate");
const onChannelOpen = fn((_channel: string, event: MouseEvent) =>
	event.preventDefault(),
).mockName("onChannelOpen");
const onLockedChannel = fn().mockName("onLockedChannel");
const onExternalLink = fn().mockName("onExternalLink");
const onLinkConfirm = fn().mockName("onLinkConfirm");

const resolvers: RichTextResolvers = {
	member: (did) => MEMBERS[did],
	wrapMention: (member, chip) => (
		<Popover>
			<PopoverTrigger
				as="span"
				class="cursor-pointer"
				aria-label={`Open ${member.name}'s profile`}
			>
				{chip}
			</PopoverTrigger>
			<PopoverContent class="p-3" aria-label={`${member.name}'s profile`}>
				<span class="text-sm">{member.name}</span>
			</PopoverContent>
		</Popover>
	),
	role: (rkey) => ROLES[rkey],
	channel: (channel) => CHANNELS[channel],
	onChannelOpen,
	onLockedChannel,
	linkTarget: (uri) => {
		const invite = uri.match(/^https:\/\/colibri\.social\/invite\/(\w+)$/);
		if (invite) return { kind: "internal", href: `/app/invite/${invite[1]}` };
		const thread = uri.match(
			/^https:\/\/colibri\.social\/c\/(\w+)\/t\/([\w-]+)$/,
		);
		if (thread)
			return { kind: "thread", channel: thread[1], thread: thread[2] };
		const channel = uri.match(/^https:\/\/colibri\.social\/c\/(\w+)$/);
		if (channel) return { kind: "channel", channel: channel[1] };
		return undefined;
	},
	threadName: (_channel, thread) => THREADS[thread],
	rewriteUrl: (uri) =>
		uri.replace("https://bsky.app/", "https://witchsky.app/"),
	onLinkOpen,
	onNavigate,
	bridgePlatformName: (platform) => (platform === "chat" ? "Chat" : platform),
	highlight: (_lang, code) =>
		code
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(
				/\b(const|return)\b/g,
				'<span style="color:var(--primary-highlight)">$1</span>',
			),
};

const Frame = (props: {
	value: TextWithFacets;
	platform?: "mobile" | "desktop";
}) => (
	<RichTextProvider value={{ ...resolvers, platform: props.platform }}>
		<div class="min-h-dvh bg-background p-4 text-base leading-message text-foreground">
			<RichTextRenderer value={props.value} />
		</div>
	</RichTextProvider>
);

const meta = {
	title: "Messaging/Rich text",
	parameters: { viewport: { defaultViewport: "iphone" } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const MARKS = build([
	mark("Bold", f.bold),
	", ",
	mark("italic", f.italic),
	", ",
	mark("underline", f.underline),
	", ",
	mark("struck", f.strike),
	", ",
	mark("inline code", f.code),
	" and ",
	mark("bold italic link", f.bold, f.italic, f.link("https://colibri.social")),
	".\nSecond line with 🐦 and a keycap 1️⃣.",
]);

export const Marks: Story = {
	render: () => <Frame value={MARKS} />,
	play: async ({ canvasElement }) => {
		const root = canvasElement.querySelector("[data-rich-text]");
		await expect(root?.querySelector("strong")).toHaveTextContent("Bold");
		await expect(root?.querySelector("em")).toHaveTextContent("italic");
		await expect(root?.querySelector("u")).toHaveTextContent("underline");
		await expect(root?.querySelector("s")).toHaveTextContent("struck");
		await expect(root?.querySelector("code")).toHaveTextContent("inline code");
		const nested = root?.querySelector("a[data-facet-type='link'] em strong");
		await expect(nested).toHaveTextContent("bold italic link");
		await expect(root?.querySelectorAll("img").length).toBe(0);
		await expect(root?.textContent).toContain("Second line with 🐦");
	},
};

const CHIPS = build([
	"Hey ",
	mark("@Lou", f.mention("did:plc:lou")),
	" and ",
	mark("@Ghost", f.mention("did:plc:ghost")),
	", ",
	mark("@remote", f.bridged("chat")),
	" ping ",
	mark("@Mods", f.role("mods")),
	", ",
	mark("@Plain", f.role("plain")),
	", ",
	mark("@Gone", f.role("gone")),
	".\nSee ",
	mark("#general", f.channel("general")),
	", ",
	mark("#rules", f.channel("rules")),
	", ",
	mark("#showcase", f.channel("foreign")),
	", ",
	mark("#secret", f.channel("secret")),
	" and ",
	mark("#pending", f.channel("pending")),
	".\nStarts ",
	mark("t", f.time("2026-10-07T09:00:00.000Z", "relative")),
	", on ",
	mark("d", f.time("2026-10-07T09:00:00.000Z", "date-long")),
	", broken ",
	mark("[bad time]", f.time("not a date")),
	".",
]);

export const MentionsAndChips: Story = {
	render: () => <Frame value={CHIPS} />,
	play: async ({ canvasElement }) => {
		onChannelOpen.mockClear();
		onLockedChannel.mockClear();
		const canvas = within(canvasElement);
		const lou = canvasElement.querySelector("[data-did='did:plc:lou']");
		await expect(lou).toHaveAttribute("data-mention-kind", "user");
		await expect(
			canvasElement.querySelector("[data-did='did:plc:ghost']"),
		).toHaveAttribute("data-mention-kind", "unknown");
		await expect(
			canvasElement.querySelector("[data-facet-type='bridgedMention']"),
		).toHaveAttribute("title", "On Chat");
		await expect(
			canvasElement.querySelector("[data-role='gone']"),
		).toHaveTextContent("@Unknown role");
		await expect(
			canvasElement.querySelector("[data-role='plain']"),
		).toHaveTextContent("@Plain");

		await userEvent.click(
			canvas.getByRole("button", { name: "Open Lou's profile" }),
		);
		await waitFor(() =>
			expect(screen.getByRole("dialog")).toHaveTextContent("Lou"),
		);
		await userEvent.keyboard("{Escape}");

		const rules = canvasElement.querySelector("[data-channel='rules']");
		await expect(rules).toHaveTextContent("Info#rules");
		await userEvent.click(rules as HTMLElement);
		await expect(onChannelOpen).toHaveBeenCalledWith(
			"rules",
			expect.anything(),
		);
		const foreign = canvasElement.querySelector(
			"[data-channel='foreign']",
		) as HTMLElement;
		await expect(foreign).not.toHaveAttribute("title");
		await userEvent.hover(foreign);
		await waitFor(
			() =>
				expect(screen.getByRole("tooltip")).toHaveTextContent(
					"Hummingbird Club",
				),
			{ timeout: 2000 },
		);
		await userEvent.unhover(foreign);
		await waitFor(() =>
			expect(screen.queryByRole("tooltip")).not.toBeInTheDocument(),
		);
		const locked = canvas.getByRole("button", { name: "No access" });
		locked.focus();
		await userEvent.keyboard("{Enter}");
		await expect(onLockedChannel).toHaveBeenCalledWith("secret");
		await expect(
			canvasElement.querySelector("[data-channel='pending']"),
		).toHaveAttribute("data-loading");

		const times = canvasElement.querySelectorAll("time");
		await expect(times.length).toBe(2);
		await expect(times[0]).toHaveAttribute(
			"datetime",
			"2026-10-07T09:00:00.000Z",
		);
		await expect(canvasElement.textContent).toContain("broken [bad time]");
	},
};

const LINKS = build([
	mark("Docs", f.link("https://colibri.social/docs")),
	"\n",
	mark("https://bsky.app/profile/lou", f.link("https://bsky.app/profile/lou")),
	"\n",
	mark("Join us", f.link("https://colibri.social/invite/abc123")),
	"\n",
	mark("this channel", f.link("https://colibri.social/c/general")),
	"\n",
	mark("click me", f.link("javascript:alert(1)")),
	"\n",
	mark("google.com", f.link("https://evil.example/login")),
	"\n",
	mark("Mail us", f.link("mailto:hi@colibri.social")),
]);

export const Links: Story = {
	render: () => <Frame value={LINKS} />,
	play: async ({ canvasElement }) => {
		onLinkOpen.mockClear();
		onNavigate.mockClear();
		const canvas = within(canvasElement);
		const docs = canvas.getByRole("link", { name: "Docs" });
		await expect(docs).toHaveAttribute("target", "_blank");
		await expect(docs).toHaveAttribute("rel", "noreferrer noopener");
		await expect(docs).not.toHaveAttribute("title");
		await userEvent.hover(docs);
		await waitFor(
			() =>
				expect(screen.getByRole("tooltip")).toHaveTextContent(
					"https://colibri.social/docs",
				),
			{ timeout: 2000 },
		);
		await userEvent.click(docs);
		await waitFor(() =>
			expect(screen.queryByRole("tooltip")).not.toBeInTheDocument(),
		);
		await userEvent.unhover(docs);
		await expect(onLinkOpen).toHaveBeenCalledWith(
			"https://colibri.social/docs",
			expect.anything(),
		);
		const bare = canvas.getByRole("link", {
			name: "https://witchsky.app/profile/lou",
		});
		await expect(bare).toHaveAttribute(
			"href",
			"https://witchsky.app/profile/lou",
		);
		const invite = canvas.getByRole("link", { name: "Join us" });
		await expect(invite).toHaveAttribute("href", "/app/invite/abc123");
		await expect(invite).not.toHaveAttribute("target");
		await userEvent.click(invite);
		await expect(onNavigate).toHaveBeenCalledWith(
			"/app/invite/abc123",
			expect.anything(),
		);
		await expect(
			canvasElement.querySelector("[data-channel='general']"),
		).toHaveTextContent("#general");
		const unsafe = canvasElement.querySelectorAll(
			"[data-facet-type='unsafe-link']",
		);
		await expect(unsafe.length).toBe(2);
		await expect(unsafe[0]).toHaveTextContent(
			"[click me](javascript:alert(1))",
		);
		await expect(unsafe[1]).toHaveTextContent(
			"[google.com](https://evil.example/login)",
		);
		await expect(canvas.getByRole("link", { name: "Mail us" })).toHaveAttribute(
			"href",
			"mailto:hi@colibri.social",
		);
	},
};

const BLOCKS = build([
	{ block: [f.heading(1)], parts: ["Release notes"] },
	"\n",
	{
		block: [f.quote],
		parts: [
			{ block: [f.heading(2)], parts: ["Quoted heading"] },
			"\n",
			{ block: [f.list()], parts: ["first point"] },
			"\n",
			{ block: [f.list()], parts: [mark("second", f.bold), " point"] },
		],
	},
	"\nAfter the quote\n",
	{ block: [f.list(true)], parts: ["one"] },
	"\n",
	{ block: [f.list(true, 1)], parts: ["nested"] },
	"\n",
	{ block: [f.list(true)], parts: ["two"] },
	"\n",
	{ block: [f.heading(3)], parts: ["Small heading"] },
	"\n",
	{ block: [f.subtext], parts: ["Subtext under it"] },
]);

const ConfirmedLinks = () => {
	const [pending, setPending] = createSignal<{
		url: string;
		disguised: boolean;
	}>();
	const [open, setOpen] = createSignal(false);
	return (
		<RichTextProvider
			value={{
				...resolvers,
				platform: "mobile",
				onExternalLink: (url, link) => {
					onExternalLink(url, link);
					setPending({ url, disguised: link.disguised });
					setOpen(true);
				},
			}}
		>
			<div class="min-h-dvh bg-background p-4 text-base leading-message text-foreground">
				<RichTextRenderer value={LINKS} />
			</div>
			<LinkWarning
				open={open()}
				onOpenChange={setOpen}
				url={pending()?.url ?? ""}
				disguised={pending()?.disguised}
				platform="mobile"
				onConfirm={onLinkConfirm}
			/>
		</RichTextProvider>
	);
};

const THREAD_LINKS = build([
	"See ",
	mark("spring", f.link("https://colibri.social/c/general/t/spring-tuning")),
	"\n",
	mark("unknown", f.link("https://colibri.social/c/rules/t/missing")),
	"\n",
	mark("hidden", f.link("https://colibri.social/c/secret/t/spring-tuning")),
	"\n",
	mark("waiting", f.link("https://colibri.social/c/pending/t/spring-tuning")),
]);

export const ThreadLinks: Story = {
	render: () => <Frame value={THREAD_LINKS} platform="desktop" />,
	play: async ({ canvasElement }) => {
		onNavigate.mockClear();
		onChannelOpen.mockClear();
		const chips = () =>
			Array.from(
				canvasElement.querySelectorAll<HTMLElement>(
					"[data-facet-type='thread']",
				),
			);
		await expect(chips()).toHaveLength(4);
		const [spring, unknown, hidden, waiting] = chips();
		await expect(spring).toHaveTextContent("#general");
		await expect(spring).toHaveTextContent("Spring tuning");
		await expect(spring.querySelector("[data-icon='thread']")).not.toBeNull();
		await expect(spring).toHaveAttribute(
			"href",
			"https://colibri.social/c/general/t/spring-tuning",
		);
		await expect(unknown).toHaveTextContent("Info");
		await expect(unknown).toHaveTextContent("#rules");
		await expect(unknown).toHaveTextContent("Thread");
		await expect(hidden).toHaveAttribute("data-locked");
		await expect(hidden).toHaveTextContent("No access");
		await expect(waiting).toHaveAttribute("data-loading");
		await userEvent.click(spring);
		await expect(onNavigate).toHaveBeenCalledWith(
			"https://colibri.social/c/general/t/spring-tuning",
			expect.anything(),
		);
		await expect(onChannelOpen).not.toHaveBeenCalled();
	},
};

export const LinksWithConfirmation: Story = {
	parameters: { viewport: { defaultViewport: "iphone" } },
	render: () => <ConfirmedLinks />,
	play: async ({ canvasElement }) => {
		onExternalLink.mockClear();
		onLinkConfirm.mockClear();
		const canvas = within(canvasElement);
		const disguised = canvas.getByRole("link", { name: "google.com" });
		await expect(disguised).toHaveAttribute("data-disguised", "true");
		await userEvent.click(disguised);
		await expect(onExternalLink).toHaveBeenCalledWith(
			"https://evil.example/login",
			{ label: "google.com", disguised: true },
		);
		const drawer = await screen.findByRole("dialog", {
			name: "Open external link?",
		});
		await expect(drawer).toHaveTextContent("different address");
		await expect(
			drawer.querySelector("[data-link-warning-host]"),
		).toHaveTextContent("evil.example");
		await userEvent.click(
			within(drawer).getByRole("button", { name: "Cancel" }),
		);
		await expect(onLinkConfirm).not.toHaveBeenCalled();
		await expect(
			canvasElement.querySelectorAll("[data-facet-type='unsafe-link']").length,
		).toBe(1);
	},
};

export const Blocks: Story = {
	render: () => <Frame value={BLOCKS} />,
	play: async ({ canvasElement }) => {
		const quote = canvasElement.querySelector("blockquote");
		await expect(quote?.querySelector("h2")).toHaveTextContent(
			"Quoted heading",
		);
		const items = quote?.querySelectorAll("ul > li") ?? [];
		await expect(items.length).toBe(2);
		await expect(items[1]?.querySelector("strong")).toHaveTextContent("second");
		await expect(canvasElement.querySelector("h1")).toHaveTextContent(
			"Release notes",
		);
		const ordered = canvasElement.querySelector("ol");
		await expect(ordered?.querySelector("li ol li")).toHaveTextContent(
			"nested",
		);
		const subtext = canvasElement.querySelector<HTMLElement>(
			"[data-facet-type='subtext']",
		);
		await expect(subtext).toHaveTextContent("Subtext under it");
		const style = subtext ? getComputedStyle(subtext) : undefined;
		await expect(style?.fontSize).toBe("14px");
		await expect(style?.lineHeight).toBe("24px");
	},
};

const CODE = build([
	"Try this:\n",
	{
		block: [f.codeblock("ts")],
		parts: ["const nest = () => {\n  return 1 < 2;\n};"],
	},
]);

export const CodeBlockCopy: Story = {
	render: () => <Frame value={CODE} />,
	play: async ({ canvasElement }) => {
		const writeText = spyOn(navigator.clipboard, "writeText").mockResolvedValue(
			undefined,
		);
		const canvas = within(canvasElement);
		const block = canvasElement.querySelector(
			"[data-facet-type='codeblock']",
		) as HTMLElement;
		await expect(getComputedStyle(block).position).toBe("relative");
		await waitFor(() =>
			expect(block.querySelector("code span")).toHaveTextContent("const"),
		);
		await expect(block.querySelector("code")?.textContent).toContain("1 < 2");
		await userEvent.click(canvas.getByRole("button", { name: "Copy code" }));
		await expect(writeText).toHaveBeenCalledWith(
			"const nest = () => {\n  return 1 < 2;\n};",
		);
		await expect(
			canvas.getByRole("button", { name: "Copied" }),
		).toBeInTheDocument();
		writeText.mockRestore();
	},
};

const SPOILER = build([
	"The ending: ",
	mark("the bird ", f.spoiler),
	mark("was a hummingbird", f.spoiler, f.link("https://colibri.social")),
	" all along.",
]);

export const SpoilerReveal: Story = {
	render: () => <Frame value={SPOILER} />,
	play: async ({ canvasElement }) => {
		onLinkOpen.mockClear();
		const canvas = within(canvasElement);
		const spoilers = canvas.getAllByRole("button", {
			name: "Spoiler, press to reveal",
		});
		await expect(spoilers.length).toBe(2);
		await expect(canvas.queryByRole("link")).toBeNull();
		await userEvent.click(spoilers[1]);
		await expect(onLinkOpen).not.toHaveBeenCalled();
		await userEvent.tab();
		await expect(document.activeElement).toBe(spoilers[0]);
		await userEvent.keyboard("{Enter}");
		await expect(
			canvasElement.querySelectorAll("[data-revealed='true']").length,
		).toBe(2);
		await expect(
			canvas.getByRole("link", { name: "was a hummingbird" }),
		).toBeInTheDocument();
	},
};

export const JumboEmoji: Story = {
	render: () => (
		<>
			<Frame value={{ text: "🎉🐦‍🔥 🇩🇪", facets: [] }} />
			<Frame value={{ text: "🎉 nice", facets: [] }} />
		</>
	),
	play: async ({ canvasElement }) => {
		const [jumbo, inline] = Array.from(
			canvasElement.querySelectorAll("[data-rich-text]"),
		);
		await expect(jumbo).toHaveAttribute("data-jumbo");
		await expect(inline).not.toHaveAttribute("data-jumbo");
	},
};

const emojiRect = (root: Element, emoji: string) => {
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		const index = node.textContent?.indexOf(emoji) ?? -1;
		if (index < 0) continue;
		const range = document.createRange();
		range.setStart(node, index);
		range.setEnd(node, index + emoji.length);
		return range.getBoundingClientRect();
	}
	throw new Error(`${emoji} not found`);
};

const emojiButton = (root: Element, emoji: string) => {
	const element = root.querySelector<HTMLElement>(
		`[data-emoji-button][data-emoji="${emoji}"]`,
	);
	if (!element) throw new Error(`${emoji} not found`);
	return element;
};

const EMOJI_LINE = build(["Look at this ", "🐦", " bird and this text."]);

export const EmojiInfoDesktop: Story = {
	render: () => <Frame value={EMOJI_LINE} platform="desktop" />,
	parameters: { viewport: { defaultViewport: "responsive" } },
	play: async ({ canvasElement }) => {
		const root = canvasElement.querySelector("[data-rich-text]") as Element;
		const bird = emojiButton(root, "🐦");
		await expect(bird).toHaveAttribute("role", "button");
		await expect(bird).toHaveAccessibleName(":bird:");
		await expect(getComputedStyle(bird).cursor).toBe("pointer");
		await expect(root.textContent).toContain("Look at this 🐦 bird");
		await userEvent.click(bird);
		await waitFor(() =>
			expect(document.querySelector("[data-emoji-info]")).toHaveTextContent(
				":bird:",
			),
		);
		await userEvent.keyboard("{Escape}");
		await waitFor(() =>
			expect(document.querySelector("[data-emoji-info]")).toBeNull(),
		);
		const textRect = emojiRect(root, "text");
		await fireEvent.click(root, {
			clientX: textRect.left + 2,
			clientY: textRect.top + textRect.height / 2,
		});
		await expect(document.querySelector("[data-emoji-info]")).toBeNull();
	},
};

export const EmojiInfoKeyboard: Story = {
	render: () => <Frame value={EMOJI_LINE} platform="desktop" />,
	parameters: { viewport: { defaultViewport: "responsive" } },
	play: async ({ canvasElement }) => {
		const root = canvasElement.querySelector("[data-rich-text]") as Element;
		const bird = emojiButton(root, "🐦");
		bird.focus();
		await expect(document.activeElement).toBe(bird);
		await userEvent.keyboard("{Enter}");
		await waitFor(() =>
			expect(document.querySelector("[data-emoji-info]")).toHaveTextContent(
				":bird:",
			),
		);
		await userEvent.keyboard("{Escape}");
		await waitFor(() =>
			expect(document.querySelector("[data-emoji-info]")).toBeNull(),
		);
		await waitFor(() => expect(document.activeElement).toBe(bird));
		await userEvent.keyboard(" ");
		await waitFor(() =>
			expect(document.querySelector("[data-emoji-info]")).toHaveTextContent(
				":bird:",
			),
		);
		await userEvent.keyboard("{Escape}");
	},
};

let rerenderListLine: (() => void) | undefined;

const ListFrame = () => {
	const [value, setValue] = createSignal(EMOJI_LINE);
	rerenderListLine = () =>
		setValue(build(["Look at this ", "🐦", " bird and this text."]));
	return (
		<RichTextProvider value={{ ...resolvers, platform: "desktop" }}>
			<div
				data-story-scroller=""
				class="h-80 overflow-y-auto bg-background p-4 text-base leading-message text-foreground"
			>
				<div class="h-60" />
				<article data-message-key="m1">
					<RichTextRenderer value={value()} />
				</article>
				<div class="h-[200vh]" />
			</div>
		</RichTextProvider>
	);
};

const sitsAbove = (info: Element, anchor: Element) => {
	const box = info.getBoundingClientRect();
	const target = anchor.getBoundingClientRect();
	return (
		box.bottom <= target.top &&
		target.top - box.bottom < 40 &&
		Math.abs(box.left + box.width / 2 - (target.left + target.width / 2)) < 160
	);
};

export const EmojiInfoFollowsListRerender: Story = {
	render: () => <ListFrame />,
	parameters: { viewport: { defaultViewport: "responsive" } },
	play: async ({ canvasElement, step }) => {
		const scroller = canvasElement.querySelector(
			"[data-story-scroller]",
		) as HTMLElement;
		const rowRoot = () =>
			canvasElement.querySelector("[data-rich-text]") as Element;
		const info = () => document.querySelector("[data-emoji-info]");
		const first = emojiButton(rowRoot(), "🐦");

		await step("Opens above the emoji", async () => {
			await userEvent.click(first);
			await waitFor(() => expect(info()).not.toBeNull());
			await waitFor(() =>
				expect(sitsAbove(info() as Element, first)).toBe(true),
			);
		});

		await step("Stays on the emoji when the row re-renders", async () => {
			rerenderListLine?.();
			await waitFor(() => expect(first.isConnected).toBe(false));
			const next = emojiButton(rowRoot(), "🐦");
			await expect(next).not.toBe(first);
			await waitFor(() =>
				expect(sitsAbove(info() as Element, next)).toBe(true),
			);
		});

		await step("Follows the emoji while the list scrolls", async () => {
			scroller.scrollTop = 80;
			const next = emojiButton(rowRoot(), "🐦");
			await waitFor(() =>
				expect(sitsAbove(info() as Element, next)).toBe(true),
			);
		});

		await step("Closes once the emoji scrolls out", async () => {
			scroller.scrollTop = 600;
			await waitFor(() => expect(info()).toBeNull());
		});
	},
};

export const EmojiInfoMobile: Story = {
	render: () => <Frame value={EMOJI_LINE} platform="mobile" />,
	play: async ({ canvasElement }) => {
		const root = canvasElement.querySelector("[data-rich-text]") as Element;
		await userEvent.click(emojiButton(root, "🐦"));
		await waitFor(() =>
			expect(
				document.querySelector("[data-corvu-drawer-content]"),
			).toHaveTextContent(":bird:"),
		);
	},
};

export const EmojiInCodeAndLinks: Story = {
	render: () => (
		<Frame
			value={build([
				mark("code 🐦", f.code),
				" ",
				mark("link 🐦", f.link("https://example.com")),
				" plain 🐦",
			])}
		/>
	),
	play: async ({ canvasElement }) => {
		const buttons = canvasElement.querySelectorAll("[data-emoji-button]");
		await expect(buttons.length).toBe(1);
		await expect(buttons[0].closest("code, a")).toBeNull();
	},
};

const CUSTOM_EMOJI: Record<string, string> = {
	party_parrot: `data:image/svg+xml,${encodeURIComponent(
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#9c66ff"/></svg>',
	)}`,
};

const CustomFrame = (props: { value: TextWithFacets }) => (
	<RichTextProvider
		value={{
			...resolvers,
			customEmoji: (name) =>
				CUSTOM_EMOJI[name] ? { name, src: CUSTOM_EMOJI[name] } : undefined,
		}}
	>
		<div class="bg-background p-4 text-base leading-message text-foreground">
			<RichTextRenderer value={props.value} />
		</div>
	</RichTextProvider>
);

export const CustomEmoji: Story = {
	render: () => (
		<>
			<CustomFrame
				value={build([
					"Ship it :party_parrot: but not :unknown: or ",
					mark(":party_parrot:", f.code),
					" 🐦",
				])}
			/>
			<CustomFrame
				value={{ text: ":party_parrot::party_parrot:", facets: [] }}
			/>
		</>
	),
	play: async ({ canvasElement }) => {
		const [inline, jumbo] = Array.from(
			canvasElement.querySelectorAll("[data-rich-text]"),
		);
		const images = inline.querySelectorAll("img[data-custom-emoji]");
		await expect(images.length).toBe(1);
		await expect(images[0]).toHaveAttribute("alt", ":party_parrot:");
		await expect(inline.textContent).toContain(":unknown:");
		await expect(inline.querySelector("code")?.textContent).toBe(
			":party_parrot:",
		);
		await expect(inline.querySelectorAll("[data-emoji-button]").length).toBe(1);
		await expect(inline).not.toHaveAttribute("data-jumbo");
		await expect(jumbo).toHaveAttribute("data-jumbo");
		await expect(jumbo.querySelectorAll("img[data-custom-emoji]").length).toBe(
			2,
		);
	},
};

const OWL_URI = "at://did:plc:owls/blue.moji.collection.item/owl";

const openedEmoji = fn();

const ForeignFrame = (props: { value: TextWithFacets }) => (
	<RichTextProvider
		value={{
			...resolvers,
			customEmojiFeature: (feature) =>
				feature.$type === CUSTOM_EMOJI_FEATURE && feature.uri === OWL_URI
					? {
							id: OWL_URI,
							name: "owl",
							src: CUSTOM_EMOJI.party_parrot as string,
							alt: "An owl",
						}
					: undefined,
		}}
	>
		<div class="bg-background p-4 text-base leading-message text-foreground">
			<RichTextRenderer value={props.value} />
		</div>
	</RichTextProvider>
);

const foreignFacet = (text: string, token: string, uri = OWL_URI) => {
	const byteStart = encoder.encode(text.slice(0, text.indexOf(token))).length;
	return {
		$type: FACET,
		index: { byteStart, byteEnd: byteStart + encoder.encode(token).length },
		features: [{ $type: CUSTOM_EMOJI_FEATURE, uri }],
	} as unknown as NonNullable<TextWithFacets["facets"]>[number];
};

export const CustomEmojiPending: Story = {
	render: () => {
		const [ready, setReady] = createSignal(false);
		return (
			<RichTextProvider
				value={{
					...resolvers,
					customEmojiFeature: (feature) =>
						feature.$type === CUSTOM_EMOJI_FEATURE && feature.uri === OWL_URI
							? ready()
								? {
										id: OWL_URI,
										name: "owl",
										src: CUSTOM_EMOJI.party_parrot as string,
									}
								: { id: OWL_URI, name: "", src: "", pending: true }
							: undefined,
				}}
			>
				<div class="bg-background p-4 text-base leading-message text-foreground">
					<RichTextRenderer
						value={{
							text: "hoot :owl: hoot",
							facets: [foreignFacet("hoot :owl: hoot", ":owl:")],
						}}
					/>
				</div>
				<button type="button" onClick={() => setReady(true)}>
					Resolve
				</button>
			</RichTextProvider>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const skeleton = canvasElement.querySelector<HTMLElement>(
			"[data-custom-emoji-pending]",
		);
		await expect(skeleton).toHaveAttribute("aria-label", ":owl:");
		await expect(skeleton).toHaveAttribute("data-skeleton");
		const box = skeleton?.getBoundingClientRect();
		await expect(Math.round(box?.width ?? 0)).toBe(22);
		await expect(Math.round(box?.height ?? 0)).toBe(22);
		await expect(canvasElement.textContent).not.toContain(":owl:");
		await userEvent.click(canvas.getByRole("button", { name: "Resolve" }));
		await waitFor(() =>
			expect(
				canvasElement.querySelector("img[data-custom-emoji='owl']"),
			).not.toBeNull(),
		);
		await expect(
			canvasElement.querySelector("[data-custom-emoji-pending]"),
		).toBeNull();
		await waitFor(() =>
			expect(
				canvasElement.querySelector("img[data-custom-emoji='owl']"),
			).not.toHaveAttribute("data-skeleton"),
		);
	},
};

export const CustomEmojiTap: Story = {
	render: () => (
		<RichTextProvider
			value={{
				...resolvers,
				customEmoji: (name) =>
					CUSTOM_EMOJI[name]
						? { id: `emoji:${name}`, name, src: CUSTOM_EMOJI[name] }
						: undefined,
				onCustomEmojiOpen: openedEmoji,
			}}
		>
			<div class="bg-background p-4 text-base leading-message text-foreground">
				<RichTextRenderer value={build(["Party :party_parrot: time"])} />
			</div>
		</RichTextProvider>
	),
	play: async ({ canvasElement }) => {
		openedEmoji.mockClear();
		const button = canvasElement.querySelector<HTMLElement>(
			"[data-custom-emoji-button]",
		);
		await expect(button).toHaveAttribute("aria-label", ":party_parrot:");
		await userEvent.click(button as HTMLElement);
		await expect(openedEmoji).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "emoji:party_parrot",
				name: "party_parrot",
			}),
			button,
		);
		button?.focus();
		await userEvent.keyboard("{Enter}");
		await expect(openedEmoji).toHaveBeenCalledTimes(2);
	},
};

export const CustomEmojiFacet: Story = {
	render: () => (
		<>
			<ForeignFrame
				value={{
					text: "Grüße 🦉 from the owls",
					facets: [foreignFacet("Grüße 🦉 from the owls", "🦉")],
				}}
			/>
			<ForeignFrame
				value={{
					text: ":owl:",
					facets: [foreignFacet(":owl:", ":owl:")],
				}}
			/>
			<ForeignFrame
				value={{
					text: "lost :unicorn: here",
					facets: [
						foreignFacet(
							"lost :unicorn: here",
							":unicorn:",
							"at://did:plc:owls/blue.moji.collection.item/unicorn",
						),
					],
				}}
			/>
		</>
	),
	play: async ({ canvasElement }) => {
		const [inline, jumbo, unresolved] = Array.from(
			canvasElement.querySelectorAll("[data-rich-text]"),
		);
		const image = inline.querySelector("img[data-custom-emoji]");
		await expect(image).toHaveAttribute("data-custom-emoji", "owl");
		await expect(image).toHaveAttribute("alt", "An owl");
		await expect(inline.textContent).not.toContain("🦉");
		await expect(inline).not.toHaveAttribute("data-jumbo");
		await expect(jumbo).toHaveAttribute("data-jumbo");
		await expect(unresolved.querySelector("img[data-custom-emoji]")).toBeNull();
		await expect(unresolved.textContent).toContain(":unicorn:");
	},
};

const encodedLength = (value: string) => encoder.encode(value).length;

const MALFORMED: TextWithFacets = {
	text: "Grüße 🐦 overlap end",
	facets: [
		{
			$type: FACET,
			index: { byteStart: 3, byteEnd: 9 },
			features: [f.bold],
		},
		{
			$type: FACET,
			index: { byteStart: encodedLength("Grüße "), byteEnd: 300 },
			features: [f.italic],
		},
		{
			$type: FACET,
			index: { byteStart: 12, byteEnd: 4 },
			features: [f.underline],
		},
		{
			$type: FACET,
			index: { byteStart: 0, byteEnd: 5 },
			features: [feature("sparkle")],
		},
	] as ColibriRichTextFacet[],
};

export const MalformedFacets: Story = {
	render: () => <Frame value={MALFORMED} />,
	play: async ({ canvasElement }) => {
		const root = canvasElement.querySelector("[data-rich-text]");
		await expect(root?.textContent).toBe("Grüße 🐦 overlap end");
		await expect(root?.textContent).not.toContain("�");
		await expect(root?.textContent).not.toContain("UNKNOWN");
		const italic = Array.from(root?.querySelectorAll("em") ?? [])
			.map((element) => element.textContent)
			.join("");
		await expect(italic).toBe("🐦 overlap end");
		const bold = Array.from(root?.querySelectorAll("strong") ?? [])
			.map((element) => element.textContent)
			.join("");
		await expect(bold).toBe("ße 🐦");
	},
};

export const LiveUpdate: Story = {
	render: () => {
		const [value, setValue] = createSignal<TextWithFacets>({
			text: "Original message",
			facets: [],
		});
		return (
			<div>
				<button
					type="button"
					onClick={() => setValue(build(["Edited ", mark("message", f.bold)]))}
				>
					Edit
				</button>
				<RichTextProvider value={resolvers}>
					<RichTextRenderer value={value()} />
				</RichTextProvider>
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole("button", { name: "Edit" }));
		const root = canvasElement.querySelector("[data-rich-text]");
		await expect(root).toHaveTextContent("Edited message");
		await expect(root?.querySelector("strong")).toHaveTextContent("message");
	},
};
