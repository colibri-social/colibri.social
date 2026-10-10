import { createMemo, createSignal, For, Index, type JSX, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { ContextMenu } from "../ContextMenu/Menu";
import {
	type DropdownMenuEntry,
	MenuEntryGroups,
} from "../DropdownMenu/DropdownMenu";
import { SkeletonText } from "../Skeleton/Skeleton";

export type TableBreakpoint = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";

export type TableAlign = "start" | "center" | "end";

export type TableFold<T> = {
	into: string;
	below: TableBreakpoint;
	cell?: (row: T) => JSX.Element;
};

export type TableColumn<T> = {
	id: string;
	header: string;
	hideHeader?: boolean;
	cell: (row: T) => JSX.Element;
	align?: TableAlign;
	width?: string;
	truncate?: boolean;
	fold?: TableFold<T>;
	skeleton?: () => JSX.Element;
};

export type TableRowState = {
	dimmed?: boolean;
	description?: string;
};

export type TableActionsVisibility = "always" | "hover";

export type TableProps<T> = {
	label: string;
	rows: readonly T[];
	columns: readonly TableColumn<T>[];
	rowKey: (row: T) => string;
	rowState?: (row: T) => TableRowState | undefined;
	actions?: (row: T) => JSX.Element;
	actionsLabel?: string;
	actionsWidth?: string;
	actionsVisibility?: TableActionsVisibility;
	actionsSkeleton?: () => JSX.Element;
	contextMenu?: (row: T, anchor: HTMLElement) => DropdownMenuEntry[];
	contextMenuLabel?: (row: T) => string;
	loading?: boolean;
	loadingLabel?: string;
	skeletonRows?: number;
	empty?: JSX.Element;
	maxHeight?: string;
	class?: string;
};

const foldedOut: Record<TableBreakpoint, { cell: string; col: string }> = {
	xs: { cell: "hidden @xs:table-cell", col: "hidden @xs:table-column" },
	sm: { cell: "hidden @sm:table-cell", col: "hidden @sm:table-column" },
	md: { cell: "hidden @md:table-cell", col: "hidden @md:table-column" },
	lg: { cell: "hidden @lg:table-cell", col: "hidden @lg:table-column" },
	xl: { cell: "hidden @xl:table-cell", col: "hidden @xl:table-column" },
	"2xl": { cell: "hidden @2xl:table-cell", col: "hidden @2xl:table-column" },
	"3xl": { cell: "hidden @3xl:table-cell", col: "hidden @3xl:table-column" },
};

const foldedIn: Record<TableBreakpoint, string> = {
	xs: "@xs:hidden",
	sm: "@sm:hidden",
	md: "@md:hidden",
	lg: "@lg:hidden",
	xl: "@xl:hidden",
	"2xl": "@2xl:hidden",
	"3xl": "@3xl:hidden",
};

const alignClass: Record<TableAlign, string> = {
	start: "text-start",
	center: "text-center",
	end: "text-end",
};

const cellClass = "px-3 py-2 align-middle";

const actionsCellClass = cx(
	cellClass,
	"pr-2",
	"[&_button]:relative [&_button]:after:absolute [&_button]:after:-inset-[5px] [&_button]:after:content-['']",
);

const hoverReveal = cx(
	"opacity-0 transition-opacity duration-(--duration-color) motion-reduce:transition-none",
	"group-hover/row:opacity-100 group-focus-within/row:opacity-100",
	"group-has-[[data-expanded]]/row:opacity-100 group-data-menu-open/row:opacity-100",
	"[@media(hover:none)]:opacity-100",
);

const skeletonWidths = [120, 96, 56, 72, 88];

export const Table = <T,>(props: TableProps<T>) => {
	const [target, setTarget] = createSignal<{ row: T; element: HTMLElement }>();
	const [menuOpen, setMenuOpen] = createSignal(false);

	const folded = (column: TableColumn<T>) =>
		props.columns.filter((other) => other.fold?.into === column.id);

	const menuEntries = createMemo(() => {
		const current = target();
		if (!current || !props.contextMenu) return [];
		return props.contextMenu(current.row, current.element);
	});

	const colClass = (column: TableColumn<T>) =>
		column.fold ? foldedOut[column.fold.below].col : undefined;

	const columnCellClass = (column: TableColumn<T>) =>
		cx(
			cellClass,
			alignClass[column.align ?? "start"],
			column.truncate && "truncate",
			column.fold && foldedOut[column.fold.below].cell,
		);

	const Columns = () => (
		<colgroup>
			<For each={props.columns}>
				{(column) => (
					<col
						class={colClass(column)}
						style={column.width ? { width: column.width } : undefined}
					/>
				)}
			</For>
			<Show when={props.actions}>
				<col style={{ width: props.actionsWidth ?? "5.5rem" }} />
			</Show>
		</colgroup>
	);

	const Head = () => (
		<thead class="sticky top-0 z-1 bg-secondary">
			<tr class="h-9 text-xs text-muted-foreground">
				<For each={props.columns}>
					{(column) => (
						<th
							scope="col"
							class={cx(
								"px-3 font-semibold",
								alignClass[column.align ?? "start"],
								column.fold && foldedOut[column.fold.below].cell,
							)}
						>
							<Show when={column.hideHeader} fallback={column.header}>
								<span class="sr-only">{column.header}</span>
							</Show>
						</th>
					)}
				</For>
				<Show when={props.actions}>
					<th scope="col" class="px-3">
						<span class="sr-only">{props.actionsLabel ?? "Actions"}</span>
					</th>
				</Show>
			</tr>
		</thead>
	);

	const Row = (rowProps: { row: T }) => {
		const state = () => props.rowState?.(rowProps.row);
		const isTarget = () => menuOpen() && target()?.row === rowProps.row;
		return (
			<tr
				data-table-row={props.rowKey(rowProps.row)}
				data-dimmed={state()?.dimmed || undefined}
				data-menu-open={isTarget() || undefined}
				onContextMenu={(event) =>
					setTarget({ row: rowProps.row, element: event.currentTarget })
				}
				class={cx(
					"group/row h-13 border-t border-border transition-[background-color] duration-(--duration-color)",
					"hover:bg-secondary/60 has-[[data-expanded]]:bg-secondary/60 data-menu-open:bg-secondary/60",
					state()?.dimmed ? "text-muted-foreground" : "text-foreground",
				)}
			>
				<For each={props.columns}>
					{(column, index) => (
						<td class={columnCellClass(column)}>
							{column.cell(rowProps.row)}
							<For each={folded(column)}>
								{(inner) => (
									<span
										data-table-folded={inner.id}
										class={cx(
											"block min-w-0 truncate text-xs text-muted-foreground",
											inner.fold && foldedIn[inner.fold.below],
										)}
									>
										{inner.fold?.cell ? (
											inner.fold.cell(rowProps.row)
										) : (
											<>
												{inner.header}: {inner.cell(rowProps.row)}
											</>
										)}
									</span>
								)}
							</For>
							<Show when={index() === 0 && state()?.description}>
								<span class="sr-only">, {state()?.description}</span>
							</Show>
						</td>
					)}
				</For>
				<Show when={props.actions}>
					{(actions) => (
						<td class={actionsCellClass}>
							<span
								class={cx(
									"flex items-center justify-end gap-2",
									props.actionsVisibility === "hover" && hoverReveal,
								)}
							>
								{actions()(rowProps.row)}
							</span>
						</td>
					)}
				</Show>
			</tr>
		);
	};

	const SkeletonRows = () => (
		<Index each={Array.from({ length: props.skeletonRows ?? 4 })}>
			{() => (
				<tr data-table-skeleton="" class="h-13 border-t border-border">
					<For each={props.columns}>
						{(column, index) => (
							<td
								class={cx(
									cellClass,
									column.fold && foldedOut[column.fold.below].cell,
								)}
							>
								{column.skeleton?.() ?? (
									<SkeletonText
										size="sm"
										width={skeletonWidths[index() % skeletonWidths.length]}
									/>
								)}
							</td>
						)}
					</For>
					<Show when={props.actions}>
						<td class={cellClass}>
							<span class="flex justify-end gap-2">
								{props.actionsSkeleton?.()}
							</span>
						</td>
					</Show>
				</tr>
			)}
		</Index>
	);

	const scroller = () => (
		<div
			data-table-scroller=""
			onContextMenu={(event) => {
				if (!(event.target as Element).closest("tbody [data-table-row]"))
					setTarget(undefined);
			}}
			style={props.maxHeight ? { "max-height": props.maxHeight } : undefined}
			class="min-w-0 overflow-y-auto rounded-control border border-border"
		>
			<table
				aria-label={props.label}
				aria-busy={props.loading || undefined}
				class="w-full table-fixed border-collapse text-sm"
			>
				<Columns />
				<Head />
				<tbody>
					<Show when={!props.loading} fallback={<SkeletonRows />}>
						<For each={props.rows}>{(row) => <Row row={row} />}</For>
					</Show>
				</tbody>
			</table>
		</div>
	);

	const menuLabel = () => {
		const current = target();
		if (!current) return props.label;
		return props.contextMenuLabel?.(current.row) ?? `${props.label} options`;
	};

	return (
		<div data-table="" class={cx("@container min-w-0", props.class)}>
			<Show when={props.loading}>
				<span role="status" aria-live="polite" class="sr-only">
					{props.loadingLabel ?? "Loading"}
				</span>
			</Show>
			<Show
				when={props.loading || props.rows.length > 0 || !props.empty}
				fallback={props.empty}
			>
				<Show when={props.contextMenu} fallback={scroller()}>
					<ContextMenu
						aria-label={menuLabel()}
						disabled={menuEntries().length === 0}
						onOpenChange={setMenuOpen}
						menu={<MenuEntryGroups entries={menuEntries()} />}
					>
						{scroller()}
					</ContextMenu>
				</Show>
			</Show>
		</div>
	);
};
