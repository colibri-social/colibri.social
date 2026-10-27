import type { JSX } from "solid-js";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import {
	AcknowledgementsSettings,
	type Contributor,
	type OpenSourceLibrary,
} from "./AcknowledgementsSettings";

type Args = {
	onOpenLink?: (event: MouseEvent, href: string) => void;
	onOpenContributor?: (event: MouseEvent, contributor: Contributor) => void;
};

const meta: Meta<Args> = {
	title: "Surfaces/Acknowledgements settings",
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

type Platform = "mobile" | "desktop";

const Frame = (props: { platform: Platform; children: JSX.Element }) => (
	<div
		data-frame={props.platform}
		class={
			props.platform === "mobile"
				? "h-[844px] w-[402px] max-w-full overflow-y-auto bg-background px-4 py-6"
				: "h-[860px] w-[720px] overflow-y-auto bg-background px-8 py-8"
		}
	>
		{props.children}
	</div>
);

const frameOf = (canvasElement: HTMLElement) =>
	canvasElement.querySelector<HTMLElement>("[data-frame]") as HTMLElement;

const contributor = (
	name: string,
	handle?: string,
	did?: string,
	role?: string,
): Contributor => ({
	name,
	handle,
	did,
	role,
	href: did ? `https://bsky.app/profile/${did}` : undefined,
});

const CONTRIBUTORS: Contributor[] = [
	contributor(
		"Felix Schneider",
		"felixs.dev",
		"did:plc:pbjvqaziagcyv2vqodldn5op",
	),
	contributor("José Miguel", "omixann.me", "did:plc:l4sh3guti7k2mzcn2gzox2vy"),
	contributor(
		"Kyanoxia",
		"kyanoxia.com",
		"did:plc:cocpebhxzqhh2vxsp4ivzdbr",
		"Sound Designer",
	),
	contributor(
		"Louis Escher",
		"lou.gg",
		"did:plc:w64dlsa4zwjv2wljlvmymldc",
		"Core Maintainer",
	),
	contributor("Matthew Justice"),
	contributor(
		"Reuben Tier",
		"otterlord.dev",
		"did:plc:dfpvdx5gjxeqtrye4jj76unc",
		"Core Maintainer",
	),
	contributor("Roman", "rman.dev", "did:plc:kv4anwhiuzuljtxqjkzoll6v"),
];

const npm = (
	name: string,
	version: string,
	license: string | undefined,
	href?: string,
): OpenSourceLibrary => ({ name, version, license, href, ecosystem: "npm" });

const rust = (
	name: string,
	version: string,
	license: string | undefined,
	href?: string,
): OpenSourceLibrary => ({ name, version, license, href, ecosystem: "rust" });

const LIBRARIES: OpenSourceLibrary[] = [
	npm("solid-js", "1.9.9", "MIT", "https://github.com/solidjs/solid"),
	npm(
		"@kobalte/core",
		"0.13.14",
		"MIT",
		"https://github.com/kobaltedev/kobalte",
	),
	npm("@corvu/drawer", "0.2.4", "MIT", "https://github.com/corvudev/corvu"),
	npm("@tiptap/core", "3.31.3", "MIT", "https://github.com/ueberdosis/tiptap"),
	npm(
		"@solar-icons/solid",
		"2.3.2",
		"CC-BY-4.0",
		"https://github.com/solar-icons/solar-icons",
	),
	npm(
		"@atproto/api",
		"0.16.9",
		"MIT OR Apache-2.0",
		"https://github.com/bluesky-social/atproto",
	),
	npm(
		"mediasoup-client",
		"3.15.6",
		"ISC",
		"https://github.com/versatica/mediasoup-client",
	),
	npm("chrono-node", "2.10.1", "MIT", "https://github.com/wanasit/chrono"),
	npm("emojilib", "4.0.3", "MIT", "https://github.com/muan/emojilib"),
	npm("gifenc", "1.0.3", "MIT", "https://github.com/mattdesl/gifenc"),
	npm(
		"@thisbeyond/solid-dnd",
		"0.7.5",
		"MIT",
		"https://github.com/thisbeyond/solid-dnd",
	),
	npm("an-unlisted-helper", "0.0.1", undefined),
	rust(
		"tauri",
		"2.8.5",
		"Apache-2.0 OR MIT",
		"https://github.com/tauri-apps/tauri",
	),
	rust(
		"serde",
		"1.0.228",
		"MIT OR Apache-2.0",
		"https://github.com/serde-rs/serde",
	),
	rust("tokio", "1.47.1", "MIT", "https://github.com/tokio-rs/tokio"),
	rust(
		"reqwest",
		"0.12.23",
		"MIT OR Apache-2.0",
		"https://github.com/seanmonstar/reqwest",
	),
	rust(
		"cef",
		"140.3.0",
		"Apache-2.0 OR MIT",
		"https://github.com/tauri-apps/cef-rs",
	),
	rust(
		"wry",
		"0.53.3",
		"Apache-2.0 OR MIT",
		"https://github.com/tauri-apps/wry",
	),
	rust("objc2", "0.6.2", "MIT", "https://github.com/madsmtm/objc2"),
	rust(
		"windows",
		"0.61.3",
		"MIT OR Apache-2.0",
		"https://github.com/microsoft/windows-rs",
	),
	rust(
		"ring",
		"0.17.14",
		"Apache-2.0 AND ISC",
		"https://github.com/briansmith/ring",
	),
	rust("sentry", "0.42.0", "MIT", "https://github.com/getsentry/sentry-rust"),
];

const MANY_LIBRARIES: OpenSourceLibrary[] = Array.from(
	{ length: 600 },
	(_, index) =>
		rust(
			`crate-${String(index + 1).padStart(3, "0")}`,
			"1.0.0",
			"MIT",
			`https://crates.io/crates/crate-${index + 1}`,
		),
);

const AcknowledgementsStory = (props: {
	platform: Platform;
	libraries?: OpenSourceLibrary[];
	contributors?: Contributor[];
	onOpenLink?: (event: MouseEvent, href: string) => void;
	onOpenContributor?: (event: MouseEvent, contributor: Contributor) => void;
}) => (
	<Frame platform={props.platform}>
		<AcknowledgementsSettings
			contributors={props.contributors ?? CONTRIBUTORS}
			libraries={props.libraries ?? LIBRARIES}
			onOpenContributor={props.onOpenContributor}
			onOpenLink={(event, href) => {
				event.preventDefault();
				props.onOpenLink?.(event, href);
			}}
		/>
	</Frame>
);

const libraryNames = (canvasElement: HTMLElement) =>
	[...canvasElement.querySelectorAll<HTMLElement>("[data-library]")].map(
		(row) => row.dataset.library,
	);

const searchOf = (canvasElement: HTMLElement) =>
	within(canvasElement).getByRole("searchbox", { name: "Search libraries" });

export const Mobile: Story = {
	render: (args) => (
		<AcknowledgementsStory platform="mobile" onOpenLink={args.onOpenLink} />
	),
	args: { onOpenLink: fn() },
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		await expect(
			canvasElement.querySelectorAll("[data-contributor]"),
		).toHaveLength(7);
		await expect(
			canvasElement.querySelectorAll("[data-contributor-role]"),
		).toHaveLength(3);
		await expect(
			canvasElement.querySelector(
				'[data-contributor="felixs.dev"] [data-contributor-role]',
			),
		).toBeNull();
		await expect(
			canvasElement.querySelector('[data-contributor="Matthew Justice"]')
				?.tagName,
		).toBe("DIV");
		await expect(canvas.getByText("@lou.gg")).toBeVisible();
		await waitFor(() =>
			expect(libraryNames(canvasElement)[0]).toBe("@atproto/api"),
		);

		const search = searchOf(canvasElement);
		await userEvent.type(search, "tokio");
		await waitFor(() => expect(libraryNames(canvasElement)).toEqual(["tokio"]));
		await expect(
			canvasElement.querySelector('[data-library-group="npm"]'),
		).toBeNull();

		await userEvent.clear(search);
		await userEvent.type(search, "apache isc");
		await waitFor(() => expect(libraryNames(canvasElement)).toEqual(["ring"]));

		await userEvent.clear(search);
		await userEvent.type(search, "zzz");
		await waitFor(() =>
			expect(
				canvas.getByText(
					'Nothing matches "zzz". Try a different name or license.',
				),
			).toBeVisible(),
		);

		await userEvent.clear(search);
		await userEvent.type(search, "solid-js");
		const solid = await canvas.findByRole("link", {
			name: /^solid-js\s*1\.9\.9\s*MIT$/,
		});
		await userEvent.click(solid);
		await expect(args.onOpenLink).toHaveBeenCalledWith(
			expect.anything(),
			"https://github.com/solidjs/solid",
		);

		await userEvent.clear(search);
		await userEvent.type(search, "unlisted");
		await expect(await canvas.findByText("License not listed")).toBeVisible();
		await userEvent.clear(search);
		await expectNoLayoutIssues(frameOf(canvasElement));
	},
};

export const Desktop: Story = {
	parameters: desktop,
	render: (args) => (
		<AcknowledgementsStory platform="desktop" onOpenLink={args.onOpenLink} />
	),
	args: { onOpenLink: fn() },
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole("link", { name: /^Louis Escher/ }));
		await expect(args.onOpenLink).toHaveBeenCalledWith(
			expect.anything(),
			"https://bsky.app/profile/did:plc:w64dlsa4zwjv2wljlvmymldc",
		);

		await userEvent.click(canvas.getByRole("radio", { name: "Rust" }));
		await waitFor(() =>
			expect(
				canvasElement.querySelectorAll('[data-ecosystem="npm"]'),
			).toHaveLength(0),
		);
		await expect(
			canvasElement.querySelector('[data-library-group="rust"]'),
		).toHaveTextContent(
			`Rust · ${LIBRARIES.filter((library) => library.ecosystem === "rust").length}`,
		);

		await userEvent.type(searchOf(canvasElement), "solid");
		await waitFor(() =>
			expect(
				canvas.getByText(
					'Nothing matches "solid". Try a different name or license.',
				),
			).toBeVisible(),
		);

		await userEvent.click(canvas.getByRole("radio", { name: "JavaScript" }));
		await waitFor(() =>
			expect(libraryNames(canvasElement)).toEqual([
				"@solar-icons/solid",
				"@thisbeyond/solid-dnd",
				"solid-js",
			]),
		);
		await expectNoLayoutIssues(frameOf(canvasElement));
	},
};

export const LongList: Story = {
	render: () => (
		<AcknowledgementsStory platform="mobile" libraries={MANY_LIBRARIES} />
	),
	play: async ({ canvasElement }) => {
		const frame = frameOf(canvasElement);
		await waitFor(() =>
			expect(libraryNames(canvasElement).length).toBeGreaterThan(0),
		);
		await expect(libraryNames(canvasElement).length).toBeLessThan(60);
		await expect(
			canvasElement.querySelector('[data-library-group="rust"]'),
		).toHaveTextContent("Rust · 600");

		frame.scrollTop = frame.scrollHeight;
		await waitFor(() =>
			expect(libraryNames(canvasElement)).toContain("crate-600"),
		);
		await expect(libraryNames(canvasElement)).not.toContain("crate-001");

		frame.scrollTop = 0;
		await userEvent.type(searchOf(canvasElement), "crate-42");
		await waitFor(() =>
			expect(libraryNames(canvasElement)).toEqual([
				"crate-420",
				"crate-421",
				"crate-422",
				"crate-423",
				"crate-424",
				"crate-425",
				"crate-426",
				"crate-427",
				"crate-428",
				"crate-429",
			]),
		);
	},
};

export const ContributorCallback: Story = {
	render: (args) => (
		<AcknowledgementsStory
			platform="mobile"
			contributors={CONTRIBUTORS.map(({ href: _, ...rest }) => rest)}
			onOpenContributor={args.onOpenContributor}
		/>
	),
	args: { onOpenContributor: fn() },
	play: async ({ canvasElement, args }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: /^Reuben Tier/ }),
		);
		await expect(args.onOpenContributor).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ handle: "otterlord.dev" }),
		);
	},
};

export const NoContributors: Story = {
	render: () => <AcknowledgementsStory platform="mobile" contributors={[]} />,
	play: async ({ canvasElement }) => {
		await expect(within(canvasElement).queryByText("Made by")).toBeNull();
		await waitFor(() =>
			expect(libraryNames(canvasElement).length).toBeGreaterThan(0),
		);
	},
};
