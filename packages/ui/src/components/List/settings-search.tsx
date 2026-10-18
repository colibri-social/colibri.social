import { MagnifierIcon } from "@solar-icons/solid/bold/magnifier";
import {
	type Accessor,
	createContext,
	createEffect,
	createMemo,
	createSignal,
	type JSX,
	onCleanup,
	Show,
	useContext,
} from "solid-js";
import { cx } from "../../utils/cx";
import { foldText } from "../../utils/fold-text";

const HIGHLIGHT_NAME = "settings-search";
const SEARCH_TEXT_SELECTOR = "[data-search-label], [data-search-description]";

type SearchEntry = {
	element: HTMLElement;
	keywords: Accessor<readonly string[] | undefined>;
};

type SearchContextValue = {
	tokens: Accessor<string[]>;
	active: Accessor<boolean>;
	register: (entry: SearchEntry) => () => void;
	matches: (element: HTMLElement) => boolean;
	visibleIn: (container: HTMLElement) => boolean;
	hasResults: Accessor<boolean>;
	query: Accessor<string>;
};

const SearchContext = createContext<SearchContextValue>();

const tokenize = (query: string) =>
	foldText(query.trim()).split(/\s+/).filter(Boolean);

const haystackFor = (entry: SearchEntry) =>
	foldText(
		[
			entry.element.textContent ?? "",
			entry.element.getAttribute("aria-label") ?? "",
			...(entry.keywords() ?? []),
		].join(" "),
	);

const supportsHighlights = () =>
	typeof CSS !== "undefined" &&
	"highlights" in CSS &&
	typeof Highlight !== "undefined";

const labelRanges = (root: HTMLElement, tokens: string[]) => {
	const ranges: Range[] = [];
	const labels = root.matches(SEARCH_TEXT_SELECTOR)
		? [root]
		: Array.from(root.querySelectorAll<HTMLElement>(SEARCH_TEXT_SELECTOR));
	for (const label of labels) {
		const walker = document.createTreeWalker(label, NodeFilter.SHOW_TEXT);
		for (let node = walker.nextNode(); node; node = walker.nextNode()) {
			const text = node.textContent ?? "";
			const folded = foldText(text);
			if (folded.length !== text.length) continue;
			for (const token of tokens) {
				let from = folded.indexOf(token);
				while (from !== -1) {
					const range = document.createRange();
					range.setStart(node, from);
					range.setEnd(node, from + token.length);
					ranges.push(range);
					from = folded.indexOf(token, from + token.length);
				}
			}
		}
	}
	return ranges;
};

export type SettingsSearchProps = {
	query: string;
	children: JSX.Element;
};

export const SettingsSearch = (props: SettingsSearchProps) => {
	const [entries, setEntries] = createSignal<SearchEntry[]>([]);
	const tokens = createMemo(() => tokenize(props.query), undefined, {
		equals: (previous, next) =>
			previous.length === next.length &&
			previous.every((token, index) => token === next[index]),
	});
	const active = () => tokens().length > 0;

	const matchSet = createMemo(() => {
		const current = tokens();
		const matched = new Set<HTMLElement>();
		for (const entry of entries()) {
			if (current.length === 0) {
				matched.add(entry.element);
				continue;
			}
			const haystack = haystackFor(entry);
			if (current.every((token) => haystack.includes(token)))
				matched.add(entry.element);
		}
		return matched;
	});

	const register = (entry: SearchEntry) => {
		setEntries((list) => [...list, entry]);
		return () => setEntries((list) => list.filter((item) => item !== entry));
	};

	const matches = (element: HTMLElement) => matchSet().has(element);

	const visibleIn = (container: HTMLElement) => {
		const matched = matchSet();
		let registered = false;
		for (const entry of entries()) {
			if (!container.contains(entry.element)) continue;
			registered = true;
			if (matched.has(entry.element)) return true;
		}
		return !registered;
	};

	const hasResults = () => !active() || matchSet().size > 0;

	createEffect(() => {
		if (!supportsHighlights()) return;
		const current = tokens();
		const ranges: Range[] = [];
		if (current.length > 0) {
			for (const element of matchSet())
				ranges.push(...labelRanges(element, current));
		}
		if (ranges.length === 0) CSS.highlights.delete(HIGHLIGHT_NAME);
		else CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(...ranges));
	});

	onCleanup(() => {
		if (supportsHighlights()) CSS.highlights.delete(HIGHLIGHT_NAME);
	});

	return (
		<SearchContext.Provider
			value={{
				tokens,
				active,
				register,
				matches,
				visibleIn,
				hasResults,
				query: () => props.query,
			}}
		>
			{props.children}
		</SearchContext.Provider>
	);
};

export const useSettingsSearch = () => {
	const context = useContext(SearchContext);
	return {
		active: () => context?.active() ?? false,
		hasResults: () => context?.hasResults() ?? true,
		query: () => context?.query() ?? "",
	};
};

export const createSearchable = (
	keywords: Accessor<readonly string[] | undefined> = () => undefined,
) => {
	const context = useContext(SearchContext);
	const [element, setElement] = createSignal<HTMLElement>();

	createEffect(() => {
		const node = element();
		if (!node || !context) return;
		onCleanup(context.register({ element: node, keywords }));
	});

	return {
		ref: (node: HTMLElement) => setElement(node),
		hidden: () => {
			const node = element();
			if (!context || !node || !context.active()) return false;
			return !context.matches(node);
		},
	};
};

export const createSearchGroup = () => {
	const context = useContext(SearchContext);
	const [element, setElement] = createSignal<HTMLElement>();

	return {
		ref: (node: HTMLElement) => setElement(node),
		hidden: () => {
			const node = element();
			if (!context || !node || !context.active()) return false;
			return !context.visibleIn(node);
		},
	};
};

export type SettingsSearchEmptyProps = {
	title?: (query: string) => JSX.Element;
	description?: JSX.Element;
	class?: string;
};

export const SettingsSearchEmpty = (props: SettingsSearchEmptyProps) => {
	const search = useSettingsSearch();

	return (
		<Show when={!search.hasResults()}>
			<div
				role="status"
				data-settings-search-empty=""
				class={cx(
					"flex flex-col items-center gap-2 px-4 py-10 text-center",
					props.class,
				)}
			>
				<MagnifierIcon
					aria-hidden="true"
					class="size-8 text-muted-foreground"
				/>
				<p class="m-0 text-base font-semibold text-foreground">
					{props.title?.(search.query().trim()) ??
						`No settings match "${search.query().trim()}"`}
				</p>
				<p class="m-0 text-sm text-muted-foreground">
					{props.description ?? "Try a different word or check the spelling."}
				</p>
			</div>
		</Show>
	);
};
