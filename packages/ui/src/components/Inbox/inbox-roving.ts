const ROW = "[data-inbox-row]";
const CELL = "[data-inbox-cell]";

const EXITING = "[data-inbox-exiting]";

const rowsIn = (container: HTMLElement) =>
	Array.from(container.querySelectorAll<HTMLElement>(ROW)).filter(
		(row) => row.querySelector(CELL) !== null && !row.closest(EXITING),
	);

const cellsIn = (row: HTMLElement) =>
	Array.from(row.querySelectorAll<HTMLElement>(CELL)).filter(
		(cell) => !cell.hasAttribute("disabled") && !cell.hidden,
	);

const allCells = (container: HTMLElement) =>
	Array.from(container.querySelectorAll<HTMLElement>(CELL));

const setCurrent = (container: HTMLElement, target: HTMLElement) => {
	for (const cell of allCells(container)) cell.tabIndex = -1;
	target.tabIndex = 0;
};

export const syncRoving = (container: HTMLElement | undefined) => {
	if (!container) return;
	const cells = allCells(container);
	const current = cells.find((cell) => cell.tabIndex === 0);
	if (
		current?.isConnected &&
		!current.hasAttribute("disabled") &&
		!current.closest(EXITING)
	) {
		for (const cell of cells) if (cell !== current) cell.tabIndex = -1;
		return;
	}
	const first = rowsIn(container)[0];
	const target = first ? cellsIn(first)[0] : undefined;
	for (const cell of cells) cell.tabIndex = -1;
	if (target) target.tabIndex = 0;
};

export type FocusHandoff = "kept" | "moved" | "lost";

export const focusPastRows = (
	container: HTMLElement | undefined,
	leaving: (row: HTMLElement) => boolean,
): FocusHandoff => {
	if (!container) return "kept";
	const cell = (
		document.activeElement as HTMLElement | null
	)?.closest<HTMLElement>(CELL);
	const row = cell?.closest<HTMLElement>(ROW);
	if (!cell || !row || !container.contains(row) || !leaving(row)) return "kept";
	const rows = rowsIn(container);
	const index = rows.indexOf(row);
	const column = Math.max(0, cellsIn(row).indexOf(cell));
	const candidates =
		index < 0
			? rows
			: [...rows.slice(index + 1), ...rows.slice(0, index).reverse()];
	const next = candidates.find((candidate) => !leaving(candidate));
	const cells = next ? cellsIn(next) : [];
	const target = cells[Math.min(column, cells.length - 1)];
	if (!target) return "lost";
	setCurrent(container, target);
	target.focus();
	return "moved";
};

export const firstRovingCell = (container: HTMLElement | undefined) => {
	if (!container) return undefined;
	syncRoving(container);
	return allCells(container).find((cell) => cell.tabIndex === 0) ?? undefined;
};

export const createRoving = (container: () => HTMLElement | undefined) => {
	const onFocusIn = (event: FocusEvent) => {
		const root = container();
		const cell = (event.target as HTMLElement | null)?.closest<HTMLElement>(
			CELL,
		);
		if (root && cell && root.contains(cell)) setCurrent(root, cell);
	};

	const onKeyDown = (event: KeyboardEvent) => {
		const root = container();
		if (!root) return;
		const cell = (event.target as HTMLElement | null)?.closest<HTMLElement>(
			CELL,
		);
		const row = cell?.closest<HTMLElement>(ROW);
		if (!cell || !row || !root.contains(row)) return;
		const rows = rowsIn(root);
		const rowIndex = rows.indexOf(row);
		const cells = cellsIn(row);
		const column = Math.max(0, cells.indexOf(cell));
		let target: HTMLElement | undefined;
		const inRow = (index: number) => {
			const next = rows[index];
			if (!next) return undefined;
			const nextCells = cellsIn(next);
			return nextCells[Math.min(column, nextCells.length - 1)];
		};
		switch (event.key) {
			case "ArrowDown":
				target = inRow(Math.min(rows.length - 1, rowIndex + 1));
				break;
			case "ArrowUp":
				target = inRow(Math.max(0, rowIndex - 1));
				break;
			case "ArrowRight":
				target = cells[Math.min(cells.length - 1, column + 1)];
				break;
			case "ArrowLeft":
				target = cells[Math.max(0, column - 1)];
				break;
			case "Home":
				target = rows[0] ? cellsIn(rows[0])[0] : undefined;
				break;
			case "End": {
				const last = rows.at(-1);
				target = last ? cellsIn(last)[0] : undefined;
				break;
			}
			default:
				return;
		}
		event.preventDefault();
		if (!target || target === cell) return;
		setCurrent(root, target);
		target.focus();
	};

	return { onFocusIn, onKeyDown };
};
