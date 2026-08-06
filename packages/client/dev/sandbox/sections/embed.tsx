import { createSignal, For, type JSX } from "solid-js";
import { EmbedJoinGate } from "../../../src/components/app/community/EmbedJoinGate";
import { OpenInColibriLink } from "../../../src/components/app/community/PoweredByColibri";
import { EmbedScopeNotice } from "../../../src/components/app/onboarding/EmbedScopeNotice";
import { Button } from "../../../src/components/ui/Button";
import { deriveBrandTokens } from "../../../src/embed/theme";
import {
	EMBED_THEME_TOKENS,
	type EmbedThemeToken,
	type EmbedThemeTokens,
} from "../../../src/embed/types";
import { Demo } from "../helpers";
import type { SandboxCategory } from "../types";

const MAINTAINERS_SPACE: Partial<EmbedThemeTokens> = {
	primary: "#eab308",
	"primary-hover": "#facc15",
	"primary-foreground": "#18181b",
	ring: "#eab308",
	background: "#09090b",
	foreground: "#fafafa",
	card: "#18181b",
	"card-foreground": "#fafafa",
	popover: "#18181b",
	"popover-foreground": "#fafafa",
	muted: "#27272a",
	"muted-foreground": "#a1a1aa",
	accent: "#27272a",
	"accent-foreground": "#fafafa",
	secondary: "#27272a",
	"secondary-foreground": "#fafafa",
	border: "#27272a",
	input: "#27272a",
	sidebar: "#18181b",
	"sidebar-foreground": "#fafafa",
	"sidebar-primary": "#eab308",
	"sidebar-primary-foreground": "#18181b",
	"sidebar-accent": "#27272a",
	"sidebar-accent-foreground": "#fafafa",
	"sidebar-border": "#27272a",
	radius: "0.5rem",
	"font-sans": '"Geist Variable", system-ui, sans-serif',
};

const ACCENTS: Array<{ id: string; label: string; swatch: string }> = [
	{ id: "brand", label: "Yellow", swatch: "#eab308" },
	{ id: "red", label: "Red", swatch: "#ef4444" },
	{ id: "orange", label: "Orange", swatch: "#f97316" },
	{ id: "amber", label: "Amber", swatch: "#f59e0b" },
	{ id: "lime", label: "Lime", swatch: "#84cc16" },
	{ id: "green", label: "Green", swatch: "#22c55e" },
	{ id: "emerald", label: "Emerald", swatch: "#10b981" },
	{ id: "teal", label: "Teal", swatch: "#14b8a6" },
	{ id: "cyan", label: "Cyan", swatch: "#06b6d4" },
	{ id: "sky", label: "Sky", swatch: "#0ea5e9" },
	{ id: "blue", label: "Blue", swatch: "#3b82f6" },
	{ id: "indigo", label: "Indigo", swatch: "#6366f1" },
	{ id: "violet", label: "Violet", swatch: "#8b5cf6" },
	{ id: "purple", label: "Purple", swatch: "#a855f7" },
	{ id: "fuchsia", label: "Fuchsia", swatch: "#d946ef" },
	{ id: "pink", label: "Pink", swatch: "#ec4899" },
	{ id: "rose", label: "Rose", swatch: "#f43f5e" },
];

const asStyle = (theme: Partial<EmbedThemeTokens>): JSX.CSSProperties =>
	Object.fromEntries(
		Object.entries(theme).map(([token, value]) => [`--${token}`, value]),
	) as JSX.CSSProperties;

const Scoped = (props: {
	theme: Partial<EmbedThemeTokens>;
	children: JSX.Element;
}) => (
	<div
		class="bg-background text-foreground border border-border rounded-lg overflow-hidden"
		style={asStyle(props.theme)}
	>
		{props.children}
	</div>
);

const BrandTokensDemo = () => {
	const [brand, setBrand] = createSignal("#eab308");

	const theme = () => ({
		...MAINTAINERS_SPACE,
		...deriveBrandTokens(brand()).tokens,
	});

	const contrast = () => deriveBrandTokens(brand()).lowContrast;

	return (
		<div class="flex flex-col gap-4 w-full">
			<Demo label="Accent, applied through setTheme">
				<div class="flex flex-wrap gap-2">
					<For each={ACCENTS}>
						{(accent) => (
							<button
								type="button"
								title={accent.label}
								onClick={() => setBrand(accent.swatch)}
								class="size-7 rounded-full cursor-pointer ring-2 ring-offset-2 ring-offset-background transition"
								classList={{
									"ring-foreground": brand() === accent.swatch,
									"ring-transparent": brand() !== accent.swatch,
								}}
								style={{ "background-color": accent.swatch }}
							/>
						)}
					</For>
				</div>
			</Demo>

			<p class="text-xs text-muted-foreground m-0">
				{brand()}
				{contrast()
					? " — cannot carry legible text at any foreground, so the closest one is used and an error event is emitted"
					: " — derived foreground clears WCAG AA"}
			</p>

			<Scoped theme={theme()}>
				<div class="p-4 flex flex-col gap-3">
					<div class="flex flex-wrap items-center gap-2">
						<Button>Primary</Button>
						<Button variant="secondary">Secondary</Button>
						<Button variant="outline">Outline</Button>
						<Button variant="ghost">Ghost</Button>
						<Button variant="destructive">Destructive</Button>
					</div>
					<div class="bg-card text-card-foreground border border-border rounded-lg p-3">
						<p class="text-sm m-0">A card on the embed background.</p>
						<p class="text-xs text-muted-foreground m-0 mt-1">
							Muted foreground, for timestamps and hints.
						</p>
					</div>
					<div class="bg-sidebar text-sidebar-foreground border border-sidebar-border rounded-lg p-3">
						<p class="text-sm m-0">The channel pane uses the sidebar tokens.</p>
					</div>
				</div>
			</Scoped>
		</div>
	);
};

const RADIUS_PRESETS = [
	{ label: "Square", value: "0px" },
	{ label: "Slight", value: "0.25rem" },
	{ label: "Default", value: "0.625rem" },
	{ label: "Round", value: "1rem" },
	{ label: "Pill", value: "1.75rem" },
];

const RADIUS_STEPS: Array<{ token: EmbedThemeToken; offset: number }> = [
	{ token: "radius-sm", offset: -4 },
	{ token: "radius-md", offset: -2 },
	{ token: "radius-lg", offset: 0 },
	{ token: "radius-xl", offset: 4 },
	{ token: "radius-2xl", offset: 8 },
	{ token: "radius-3xl", offset: 12 },
	{ token: "radius-4xl", offset: 16 },
];

const RadiusDemo = () => {
	const [radius, setRadius] = createSignal("0.625rem");

	const theme = () => ({ ...MAINTAINERS_SPACE, radius: radius() });

	const stepValue = (offset: number) =>
		offset === 0 ? radius() : `calc(${radius()} + ${offset}px)`;

	return (
		<div class="flex flex-col gap-4 w-full">
			<Demo label="Base radius">
				<div class="flex flex-wrap gap-2">
					<For each={RADIUS_PRESETS}>
						{(preset) => (
							<Button
								variant={radius() === preset.value ? "secondary" : "outline"}
								size="sm"
								onClick={() => setRadius(preset.value)}
							>
								{preset.label}
							</Button>
						)}
					</For>
				</div>
			</Demo>

			<Scoped theme={theme()}>
				<div class="p-4 flex flex-col gap-3">
					<div class="flex flex-wrap items-center gap-2">
						<Button>Button</Button>
						<Button variant="outline">Outline</Button>
						<div class="size-9 rounded-full bg-muted shrink-0" />
					</div>
					<div class="bg-card text-card-foreground border border-border rounded-lg p-3">
						<p class="text-sm m-0">
							rounded-lg, the card and message surfaces.
						</p>
					</div>
					<div class="bg-muted rounded-md px-3 py-2 text-sm">
						rounded-md, inputs and menu rows.
					</div>
					<div class="bg-muted rounded-sm px-3 py-2 text-sm">
						rounded-sm, the tightest step.
					</div>
					<p class="text-xs text-muted-foreground m-0">
						The circle stays circular at every setting: rounded-full is not
						derived from the radius scale.
					</p>
				</div>
			</Scoped>

			<Demo label="Steps derived from the base">
				<div class="flex flex-wrap items-end gap-3">
					<For each={RADIUS_STEPS}>
						{(step) => (
							<div class="flex flex-col items-center gap-1">
								<div
									class="size-12 bg-primary"
									style={{ "border-radius": stepValue(step.offset) }}
								/>
								<code class="text-[10px] text-muted-foreground">
									{step.token}
								</code>
							</div>
						)}
					</For>
				</div>
			</Demo>

			<p class="text-xs text-muted-foreground m-0">
				Setting the base moves the whole scale, which is what most embedders
				want. Each step above is also its own token, so a single one can be
				pinned without disturbing the others. Per-step overrides only take
				effect under embed.css, where the utilities read them through a variable
				rather than inlining the calc, so they are inert in this sandbox and
				visible in the Host isolation frame.
			</p>
		</div>
	);
};

const TokenListDemo = () => (
	<Demo label={`${EMBED_THEME_TOKENS.length} public tokens`}>
		<div class="grid grid-cols-2 gap-x-6 gap-y-1 w-full">
			<For each={EMBED_THEME_TOKENS}>
				{(token: EmbedThemeToken) => (
					<div class="flex items-center gap-2 min-w-0">
						<span
							class="size-3.5 shrink-0 rounded-sm border border-border"
							style={{
								background: MAINTAINERS_SPACE[token] ?? "transparent",
							}}
						/>
						<code class="text-xs truncate">--colibri-embed-{token}</code>
					</div>
				)}
			</For>
		</div>
	</Demo>
);

const HostIsolationDemo = () => (
	<div class="flex flex-col gap-2 w-full">
		<p class="text-xs text-muted-foreground m-0">
			Loaded in an iframe so it gets <code>embed.css</code> and nothing else.
			The cream serif half is host markup that must stay untouched; the dashed
			box is the same tags inside <code>.colibri-embed</code>.
		</p>
		<iframe
			src="/embed-isolation.html"
			title="Embed CSS isolation"
			class="w-full h-140 rounded-lg border border-border bg-white"
		/>
	</div>
);

const BannerDemo = () => (
	<div class="flex flex-col gap-4 w-full">
		<Demo label="At the foot of a 288px community pane">
			<Scoped theme={MAINTAINERS_SPACE}>
				<div class="w-72 flex flex-col">
					<div class="px-3 py-2 text-sm text-muted-foreground">
						...channel list
					</div>
					<OpenInColibriLink href="https://colibri.social/app/c/did:plc:example" />
					<div class="h-14 flex items-center gap-2 p-2 bg-card">
						<div class="size-8 rounded-full bg-muted shrink-0" />
						<div class="flex flex-col">
							<span class="font-bold leading-5 text-sm">entropic.software</span>
							<span class="text-xs text-muted-foreground">Online</span>
						</div>
					</div>
				</div>
			</Scoped>
		</Demo>
		<Demo label="With a voice connection between it and the status bar">
			<Scoped theme={MAINTAINERS_SPACE}>
				<div class="w-72 flex flex-col">
					<div class="px-3 py-2 text-sm text-muted-foreground">
						...channel list
					</div>
					<OpenInColibriLink href="https://colibri.social/app/c/did:plc:example" />
					<div class="w-full p-3 border-t border-border flex flex-col gap-2">
						<div class="flex flex-row items-center gap-2">
							<div class="min-w-8 h-8 bg-green-400/15 rounded-sm shrink-0" />
							<div class="flex flex-col">
								<span class="text-sm leading-4">General</span>
								<span class="text-xs text-muted-foreground">Connected</span>
							</div>
						</div>
					</div>
					<div class="h-14 flex items-center gap-2 p-2 bg-card">
						<div class="size-8 rounded-full bg-muted shrink-0" />
						<div class="flex flex-col">
							<span class="font-bold leading-5 text-sm">entropic.software</span>
							<span class="text-xs text-muted-foreground">Online</span>
						</div>
					</div>
				</div>
			</Scoped>
		</Demo>
	</div>
);

const JoinGateDemo = () => {
	const [busy, setBusy] = createSignal(false);

	return (
		<div class="flex flex-col gap-4 w-full">
			<Demo label="Open community">
				<Scoped theme={MAINTAINERS_SPACE}>
					<div class="h-64 w-full">
						<EmbedJoinGate
							name="maintainers.space"
							busy={busy()}
							onJoin={() => {
								setBusy(true);
								setTimeout(() => setBusy(false), 1200);
							}}
						/>
					</div>
				</Scoped>
			</Demo>
			<Demo label="Requires approval">
				<Scoped theme={MAINTAINERS_SPACE}>
					<div class="h-64 w-full">
						<EmbedJoinGate name="maintainers.space" gated onJoin={() => {}} />
					</div>
				</Scoped>
			</Demo>
		</div>
	);
};

const BlockingStatesDemo = () => (
	<Demo label="Missing permissions, which only the host can fix">
		<Scoped theme={MAINTAINERS_SPACE}>
			<div class="h-64 w-full">
				<EmbedScopeNotice
					missing={[
						"social.colibri.permissionMessaging",
						"social.colibri.permissionNotification",
					]}
				/>
			</div>
		</Scoped>
	</Demo>
);

export const EMBED: SandboxCategory = {
	id: "embed",
	title: "Embed",
	items: [
		{ id: "embed-brand", title: "Brand tokens", component: BrandTokensDemo },
		{ id: "embed-radius", title: "Radius", component: RadiusDemo },
		{ id: "embed-tokens", title: "Token list", component: TokenListDemo },
		{
			id: "embed-isolation",
			title: "Host isolation",
			component: HostIsolationDemo,
		},
		{ id: "embed-banner", title: "Banner", component: BannerDemo },
		{ id: "embed-join", title: "Join gate", component: JoinGateDemo },
		{
			id: "embed-blocking",
			title: "Blocking states",
			component: BlockingStatesDemo,
		},
	],
};
