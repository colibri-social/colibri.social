import { ArrowRightUpIcon } from "@solar-icons/solid/linear/arrow-right-up";
import {
	createEffect,
	createMemo,
	createSignal,
	For,
	type JSX,
	Match,
	onCleanup,
	onMount,
	Show,
	Switch,
	splitProps,
	untrack,
} from "solid-js";
import { Dynamic } from "solid-js/web";
import {
	type CustomItemComponentProps,
	Virtualizer,
	WindowVirtualizer,
} from "virtua/solid";
import { cx } from "../../utils/cx";
import { foldText } from "../../utils/fold-text";
import { createRipple } from "../../utils/ripple";
import { findScrollParent } from "../../utils/virtual-anchor";
import { Avatar } from "../Avatar/Avatar";
import { SectionLabel } from "../List/List";
import { SegmentedControl } from "../SegmentedControl/SegmentedControl";
import { SearchField } from "../TextField/TextField";
import { SettingsEmpty, SettingsField, SettingsPage } from "./shared";

export type Contributor = {
	name: string;
	handle?: string;
	did?: string;
	avatar?: string;
	role?: string;
	href?: string;
};

export type LibraryEcosystem = "npm" | "rust";

export type OpenSourceLibrary = {
	name: string;
	version: string;
	license?: string;
	href?: string;
	ecosystem: LibraryEcosystem;
};

export type AcknowledgementsSettingsProps = {
	contributors: Contributor[];
	libraries: OpenSourceLibrary[];
	onOpenContributor?: (event: MouseEvent, contributor: Contributor) => void;
	onOpenLink?: (event: MouseEvent, href: string) => void;
	class?: string;
};

type EcosystemFilter = "all" | LibraryEcosystem;

type LibraryListRow =
	| {
			kind: "header";
			key: string;
			ecosystem: LibraryEcosystem;
			count: number;
			first: boolean;
	  }
	| {
			kind: "library";
			key: string;
			library: OpenSourceLibrary;
			first: boolean;
			last: boolean;
	  };

type ScrollTarget = { element: HTMLElement | null };

const ECOSYSTEM_LABELS: Record<LibraryEcosystem, string> = {
	npm: "JavaScript",
	rust: "Rust",
};

const ECOSYSTEM_ORDER: readonly LibraryEcosystem[] = ["npm", "rust"];

const BUFFER_PX = 400;

const LIBRARY_ROW_HEIGHT = 53;

const groupClass =
	"flex flex-col overflow-hidden rounded-control bg-secondary [&>*]:border-border [&>*~*]:border-t";

const rowClass =
	"flex min-h-12 w-full min-w-0 items-center gap-3 px-3 py-2 text-left text-foreground";

const interactiveRowClass =
	"ripple cursor-pointer outline-none hover:bg-secondary-highlight focus-ring-inset";

const ExternalMark = () => (
	<span
		aria-hidden="true"
		class="flex size-4 shrink-0 items-center justify-center text-muted-foreground [&>svg]:size-4"
	>
		<ArrowRightUpIcon />
	</span>
);

const LinkRow = (props: {
	href?: string;
	onOpenLink?: (event: MouseEvent, href: string) => void;
	onPress?: (event: MouseEvent) => void;
	children: JSX.Element;
	[key: `data-${string}`]: string | undefined;
}) => {
	const [local, rest] = splitProps(props, [
		"href",
		"onOpenLink",
		"onPress",
		"children",
	]);
	const ripple = createRipple();
	const interactive = () => Boolean(local.href || local.onPress);
	const component = () => {
		if (local.href) return "a";
		return local.onPress ? "button" : "div";
	};
	return (
		<Dynamic
			{...rest}
			ref={(element: HTMLElement) => {
				if (interactive()) ripple(element);
			}}
			component={component()}
			type={component() === "button" ? "button" : undefined}
			href={local.href}
			target={local.href ? "_blank" : undefined}
			rel={local.href ? "noreferrer" : undefined}
			onClick={(event: MouseEvent) => {
				if (local.onPress) local.onPress(event);
				else if (local.href) local.onOpenLink?.(event, local.href);
			}}
			class={cx(rowClass, interactive() && interactiveRowClass)}
		>
			{local.children}
			<Show when={interactive()}>
				<ExternalMark />
			</Show>
		</Dynamic>
	);
};

const ContributorRow = (props: {
	contributor: Contributor;
	onOpenContributor?: (event: MouseEvent, contributor: Contributor) => void;
	onOpenLink?: (event: MouseEvent, href: string) => void;
}) => (
	<LinkRow
		data-contributor={props.contributor.handle ?? props.contributor.name}
		href={props.contributor.href}
		onOpenLink={props.onOpenLink}
		onPress={
			props.onOpenContributor
				? (event) => props.onOpenContributor?.(event, props.contributor)
				: undefined
		}
	>
		<Avatar
			size="md"
			name={props.contributor.name}
			src={props.contributor.avatar}
			seed={props.contributor.did ?? props.contributor.handle}
		/>
		<span class="flex min-w-0 flex-1 flex-col">
			<span class="flex min-w-0 items-baseline gap-2">
				<span class="truncate text-sm font-semibold">
					{props.contributor.name}
				</span>
				<Show when={props.contributor.handle}>
					{(handle) => (
						<span class="truncate text-xs text-muted-foreground">
							@{handle()}
						</span>
					)}
				</Show>
			</span>
			<Show when={props.contributor.role}>
				{(role) => (
					<span
						data-contributor-role=""
						class="truncate text-sm text-muted-foreground"
					>
						{role()}
					</span>
				)}
			</Show>
		</span>
	</LinkRow>
);

const LibraryRow = (props: {
	library: OpenSourceLibrary;
	onOpenLink?: (event: MouseEvent, href: string) => void;
}) => (
	<LinkRow
		data-library={props.library.name}
		data-ecosystem={props.library.ecosystem}
		href={props.library.href}
		onOpenLink={props.onOpenLink}
	>
		<span class="flex min-w-0 flex-1 flex-col">
			<span class="flex min-w-0 items-baseline gap-2">
				<span class="truncate text-sm font-semibold">{props.library.name}</span>
				<span class="shrink-0 text-xs text-muted-foreground tabular-nums">
					{props.library.version}
				</span>
			</span>
			<span class="truncate text-xs text-muted-foreground">
				{props.library.license ?? "License not listed"}
			</span>
		</span>
	</LinkRow>
);

const matchesQuery = (library: OpenSourceLibrary, tokens: string[]) => {
	if (tokens.length === 0) return true;
	const haystack = foldText(`${library.name} ${library.license ?? ""}`);
	return tokens.every((token) => haystack.includes(token));
};

const libraryKey = (library: OpenSourceLibrary) =>
	`${library.ecosystem}:${library.name}@${library.version}`;

const toRows = (libraries: OpenSourceLibrary[]): LibraryListRow[] => {
	const rows: LibraryListRow[] = [];
	for (const ecosystem of ECOSYSTEM_ORDER) {
		const members = libraries.filter(
			(library) => library.ecosystem === ecosystem,
		);
		if (members.length === 0) continue;
		rows.push({
			kind: "header",
			key: `header:${ecosystem}`,
			ecosystem,
			count: members.length,
			first: rows.length === 0,
		});
		members.forEach((library, index) => {
			rows.push({
				kind: "library",
				key: libraryKey(library),
				library,
				first: index === 0,
				last: index === members.length - 1,
			});
		});
	}
	return rows;
};

const LibraryList = (props: {
	rows: LibraryListRow[];
	onOpenLink?: (event: MouseEvent, href: string) => void;
}) => {
	let root: HTMLDivElement | undefined;
	const [target, setTarget] = createSignal<ScrollTarget>();
	const [startMargin, setStartMargin] = createSignal(0);
	const [focusedKey, setFocusedKey] = createSignal<string>();

	const keepMounted = createMemo(() => {
		const key = focusedKey();
		if (key === undefined) return [];
		const index = props.rows.findIndex((row) => row.key === key);
		return index === -1 ? [] : [index];
	});

	const measureStartMargin = () => {
		const element = untrack(target)?.element;
		if (!element || !root) return;
		const value =
			root.getBoundingClientRect().top -
			element.getBoundingClientRect().top -
			element.clientTop +
			element.scrollTop;
		if (Math.abs(value - untrack(startMargin)) > 0.5) setStartMargin(value);
	};

	onMount(() => {
		if (!root) return;
		setTarget({ element: findScrollParent(root) ?? null });
	});

	createEffect(() => {
		const element = target()?.element;
		if (!element || !root) return;
		measureStartMargin();
		let frame = 0;
		const resize = new ResizeObserver(() => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(measureStartMargin);
		});
		resize.observe(element);
		const content = root.parentElement;
		if (content) resize.observe(content);
		element.addEventListener("scroll", measureStartMargin, { passive: true });
		onCleanup(() => {
			cancelAnimationFrame(frame);
			resize.disconnect();
			element.removeEventListener("scroll", measureStartMargin);
		});
	});

	const keyFromEvent = (event: Event) =>
		(event.target as Element | null)?.closest?.<HTMLElement>("[data-row-key]")
			?.dataset.rowKey;

	const Item = (item: CustomItemComponentProps) => (
		<div ref={item.ref} style={item.style} data-index={item.index}>
			{item.children}
		</div>
	);

	const renderRow = (row: LibraryListRow): JSX.Element => (
		<div data-row-key={row.key}>
			{row.kind === "header" ? (
				<div
					data-library-group={row.ecosystem}
					class={cx("pb-2", !row.first && "pt-4")}
				>
					<SectionLabel
						label={ECOSYSTEM_LABELS[row.ecosystem]}
						count={row.count}
					/>
				</div>
			) : (
				<div
					class={cx(
						"overflow-hidden bg-secondary",
						row.first && "rounded-t-control",
						row.last && "rounded-b-control",
						!row.first && "border-t border-border",
					)}
				>
					<LibraryRow library={row.library} onOpenLink={props.onOpenLink} />
				</div>
			)}
		</div>
	);

	return (
		<div
			ref={root}
			data-library-list=""
			onFocusIn={(event) => setFocusedKey(keyFromEvent(event))}
			onFocusOut={(event) => {
				const next = event.relatedTarget as Node | null;
				if (next && root?.contains(next)) return;
				setFocusedKey(undefined);
			}}
		>
			<Switch>
				<Match when={target()?.element}>
					{(element) => (
						<Virtualizer
							data={props.rows}
							scrollRef={element()}
							startMargin={startMargin()}
							bufferSize={BUFFER_PX}
							itemSize={LIBRARY_ROW_HEIGHT}
							keepMounted={keepMounted()}
							item={Item}
						>
							{renderRow}
						</Virtualizer>
					)}
				</Match>
				<Match when={target() && !target()?.element}>
					<WindowVirtualizer
						data={props.rows}
						bufferSize={BUFFER_PX}
						itemSize={LIBRARY_ROW_HEIGHT}
					>
						{renderRow}
					</WindowVirtualizer>
				</Match>
			</Switch>
		</div>
	);
};

export const AcknowledgementsSettings = (
	props: AcknowledgementsSettingsProps,
) => {
	const [query, setQuery] = createSignal("");
	const [ecosystem, setEcosystem] = createSignal<EcosystemFilter>("all");

	const sorted = createMemo(() =>
		[...props.libraries].sort((a, b) => a.name.localeCompare(b.name)),
	);

	const matches = createMemo(() => {
		const tokens = foldText(query().trim()).split(/\s+/).filter(Boolean);
		const filter = ecosystem();
		return sorted().filter(
			(library) =>
				(filter === "all" || library.ecosystem === filter) &&
				matchesQuery(library, tokens),
		);
	});

	const rows = createMemo(() => toRows(matches()));

	return (
		<SettingsPage
			class={props.class}
			intro="Colibri is made by a small team and built on the work of thousands of open source developers. Thank you to everyone listed here."
		>
			<Show when={props.contributors.length > 0}>
				<SettingsField label="Made by">
					<div data-contributors="" class={groupClass}>
						<For each={props.contributors}>
							{(contributor) => (
								<ContributorRow
									contributor={contributor}
									onOpenContributor={props.onOpenContributor}
									onOpenLink={props.onOpenLink}
								/>
							)}
						</For>
					</div>
				</SettingsField>
			</Show>

			<SettingsField label="Open source libraries">
				<p class="-mt-2 text-sm text-muted-foreground">
					These free libraries make Colibri possible. Each one keeps its own
					license, and you can open any of them to learn more.
				</p>
				<SearchField
					aria-label="Search libraries"
					placeholder="Search by name or license"
					value={query()}
					onChange={setQuery}
				/>
				<SegmentedControl
					aria-label="Show libraries for"
					size="sm"
					value={ecosystem()}
					onChange={(value) => setEcosystem(value as EcosystemFilter)}
					options={[
						{ value: "all", label: "All" },
						...ECOSYSTEM_ORDER.map((id) => ({
							value: id,
							label: ECOSYSTEM_LABELS[id],
						})),
					]}
				/>
				<Show
					when={matches().length > 0}
					fallback={
						<SettingsEmpty>
							<Show when={query().trim()} fallback="Nothing to show here yet.">
								{(text) => (
									<>{`Nothing matches "${text()}". Try a different name or license.`}</>
								)}
							</Show>
						</SettingsEmpty>
					}
				>
					<LibraryList rows={rows()} onOpenLink={props.onOpenLink} />
				</Show>
			</SettingsField>
		</SettingsPage>
	);
};
