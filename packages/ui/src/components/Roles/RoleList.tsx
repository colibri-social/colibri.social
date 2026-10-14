import { DangerCircleIcon } from "@solar-icons/solid/bold/danger-circle";
import { GripVerticalIcon } from "@solar-icons/solid/bold/grip-vertical";
import { TransferVerticalIcon } from "@solar-icons/solid/bold/transfer-vertical";
import {
	createEffect,
	createMemo,
	createSignal,
	For,
	on,
	Show,
} from "solid-js";
import { cx } from "../../utils/cx";
import { useHaptics } from "../../utils/haptics";
import { Button } from "../Button/Button";
import { SectionLabel } from "../List/List";
import { Skeleton } from "../Skeleton/Skeleton";
import { startReorderPress } from "../Sortable/reorder-press";
import { moveItem, SortableList } from "../Sortable/Sortable";
import { type RoleIdentity, RoleMark } from "./RoleBadge";
import { LockedRoleRow, RoleRow } from "./RoleRow";

export type SpaceRole = RoleIdentity & {
	id: string;
	protected?: boolean;
	locked?: boolean;
	memberCount?: number;
};

export type SpaceRoleListProps = {
	roles: readonly SpaceRole[];
	label?: string;
	onOpen?: (role: SpaceRole) => void;
	onReorder?: (ids: string[]) => void | Promise<void>;
	canReorder?: boolean;
	lockedLabel?: string;
	class?: string;
};

const listBox =
	"flex flex-col divide-y divide-border overflow-hidden rounded-control bg-secondary";

const isFixed = (role: SpaceRole) => !!role.protected || !!role.locked;

const splitProtected = (roles: readonly SpaceRole[]) => {
	let start = 0;
	while (start < roles.length && isFixed(roles[start])) start++;
	let end = roles.length;
	while (end > start && isFixed(roles[end - 1])) end--;
	return {
		head: roles.slice(0, start),
		middle: roles.slice(start, end),
		tail: roles.slice(end),
	};
};

const LIFT_SCALE_TOUCH = 1.03;
const LIFT_SCALE_POINTER = 1.015;

type HeldRole = {
	id: string;
	from: number;
	to: number;
	dy: number;
	originY: number;
	step: number;
	scale: number;
};

const LockedRow = (props: { role: SpaceRole }) => (
	<LockedRoleRow role={props.role} lockLabel="Fixed position" />
);

export const SpaceRoleListSkeleton = (props: {
	rows?: number;
	class?: string;
}) => (
	<div
		aria-hidden="true"
		data-space-role-list-skeleton=""
		class={cx("flex w-full flex-col gap-2", props.class)}
	>
		<div class="flex min-h-5 items-center">
			<Skeleton width={72} height={10} />
		</div>
		<div class={listBox}>
			<For each={Array.from({ length: props.rows ?? 5 }, (_, index) => index)}>
				{(index) => (
					<div class="flex h-10 items-center gap-2 px-3">
						<Skeleton width={12} height={12} class="rounded-full" />
						<Skeleton width={`${46 - (index % 3) * 9}%`} height={10} />
						<span class="flex-1" />
						<Skeleton width={56} height={8} />
					</div>
				)}
			</For>
		</div>
	</div>
);

export const SpaceRoleList = (props: SpaceRoleListProps) => {
	const haptics = useHaptics();
	const [reordering, setReordering] = createSignal(false);
	const [held, setHeld] = createSignal<HeldRole>();
	const [pending, setPending] = createSignal<string[]>();
	const [draft, setDraft] = createSignal<string[]>([]);
	const [saving, setSaving] = createSignal(false);
	const [failed, setFailed] = createSignal(false);
	const parts = createMemo(() => splitProtected(props.roles));
	const original = () => parts().middle.map((role) => role.id);
	const draftRoles = () => {
		const byId = new Map(parts().middle.map((role) => [role.id, role]));
		return draft()
			.map((id) => byId.get(id))
			.filter((role): role is SpaceRole => !!role);
	};
	const changed = () => draft().some((id, index) => id !== original()[index]);
	const canReorder = () =>
		(props.canReorder ?? !!props.onReorder) && parts().middle.length > 1;

	createEffect(
		on(
			() => props.roles,
			() => setPending(undefined),
			{ defer: true },
		),
	);

	const shown = createMemo(() => {
		const order = pending();
		if (!order) return props.roles;
		const byId = new Map(props.roles.map((role) => [role.id, role]));
		const list = order
			.map((id) => byId.get(id))
			.filter((role): role is SpaceRole => !!role);
		return list.length === props.roles.length ? list : props.roles;
	});

	const movable = (role: SpaceRole) =>
		canReorder() && !reordering() && !isFixed(role) && !!props.onReorder;

	const movableRange = () => {
		const { head, middle } = splitProtected(shown());
		return { first: head.length, last: head.length + middle.length - 1 };
	};

	const drop = () => {
		const current = held();
		setHeld(undefined);
		if (!current || current.to === current.from) return;
		haptics.impact("soft");
		const ids = moveItem(
			shown().map((role) => role.id),
			current.from,
			current.to,
		);
		setPending(ids);
		setFailed(false);
		Promise.resolve(props.onReorder?.(ids)).catch(() => {
			setPending(undefined);
			setFailed(true);
		});
	};

	const press = (
		event: PointerEvent,
		role: SpaceRole,
		element: HTMLElement,
	) => {
		if (event.button !== 0 || !event.isPrimary || !movable(role)) return;
		const from = shown().findIndex((entry) => entry.id === role.id);
		if (from < 0) return;
		startReorderPress({
			event,
			element,
			canDrag: true,
			onLift: (point, pointerType) => {
				haptics.impact("medium");
				setHeld({
					id: role.id,
					from,
					to: from,
					dy: 0,
					originY: point.y,
					step: element.offsetHeight + 1,
					scale:
						pointerType === "mouse" ? LIFT_SCALE_POINTER : LIFT_SCALE_TOUCH,
				});
			},
			onMove: (point) => {
				const current = held();
				if (!current) return;
				const { first, last } = movableRange();
				const dy = point.y - current.originY;
				const minDy = (first - current.from) * current.step;
				const maxDy = (last - current.from) * current.step;
				const clamped = Math.min(maxDy, Math.max(minDy, dy));
				const to = Math.min(
					last,
					Math.max(first, current.from + Math.round(clamped / current.step)),
				);
				if (to !== current.to) haptics.selection();
				setHeld({ ...current, dy: clamped, to });
			},
			onRelease: drop,
			onCancel: () => setHeld(undefined),
		});
	};

	const shift = (index: number) => {
		const current = held();
		if (!current) return 0;
		if (
			current.from < current.to &&
			index > current.from &&
			index <= current.to
		)
			return -current.step;
		if (
			current.to < current.from &&
			index >= current.to &&
			index < current.from
		)
			return current.step;
		return 0;
	};

	const rowStyle = (role: SpaceRole, index: number) => {
		const current = held();
		if (!current) return undefined;
		if (current.id === role.id) {
			return {
				transform: `translate3d(0,${current.dy}px,0) scale(${current.scale})`,
				"z-index": 10,
			};
		}
		return {
			transform: `translate3d(0,${shift(index)}px,0)`,
			transition: "transform 160ms var(--ease-out, ease-out)",
		};
	};

	const start = () => {
		setDraft(original());
		setFailed(false);
		setReordering(true);
	};

	const stop = () => {
		setReordering(false);
		setFailed(false);
	};

	const save = async () => {
		if (!changed()) {
			stop();
			return;
		}
		const ids = [
			...parts().head.map((role) => role.id),
			...draft(),
			...parts().tail.map((role) => role.id),
		];
		setSaving(true);
		setFailed(false);
		try {
			await props.onReorder?.(ids);
			stop();
		} catch {
			setFailed(true);
		} finally {
			setSaving(false);
		}
	};

	return (
		<section
			data-space-role-list=""
			data-reordering={reordering() || undefined}
			class={cx("flex w-full flex-col gap-2", props.class)}
		>
			<SectionLabel
				label={props.label ?? "Roles"}
				count={props.roles.length}
				action={
					canReorder() && !reordering()
						? {
								label: "Reorder",
								icon: <TransferVerticalIcon />,
								onClick: start,
							}
						: undefined
				}
			/>
			<Show
				when={reordering()}
				fallback={
					<div
						class={cx(listBox, held() && "overflow-visible")}
						data-role-holding={held() ? "" : undefined}
					>
						<For each={shown()}>
							{(role, index) => (
								<Show
									when={!role.locked}
									fallback={
										<LockedRoleRow
											role={role}
											memberCount={role.memberCount}
											lockLabel={
												props.lockedLabel ?? "You can't edit this role"
											}
										/>
									}
								>
									<div
										data-role-hold={role.id}
										data-lifted={held()?.id === role.id ? "" : undefined}
										onPointerDown={(event) => {
											const element =
												event.target instanceof Element
													? event.target.closest<HTMLElement>(
															"[data-role-hold]",
														)
													: null;
											if (element) press(event, role, element);
										}}
										style={rowStyle(role, index())}
										class={cx(
											"relative touch-pan-y",
											held()?.id === role.id &&
												"rounded-control bg-secondary-highlight shadow-overlay",
										)}
									>
										<RoleRow
											role={role}
											memberCount={role.memberCount}
											onClick={() => props.onOpen?.(role)}
										/>
									</div>
								</Show>
							)}
						</For>
					</div>
				}
			>
				<p class="m-0 text-xs text-pretty text-muted-foreground">
					Drag roles to change their order. Roles higher up outrank the ones
					below them.
				</p>
				<div class={cx(listBox, "has-data-dragging:overflow-visible")}>
					<For each={parts().head}>{(role) => <LockedRow role={role} />}</For>
					<SortableList
						items={draftRoles()}
						getId={(role) => role.id}
						itemLabel={(role) => role.name}
						onReorder={setDraft}
						disabled={saving()}
						aria-label="Roles in order"
						class="divide-y divide-border"
						itemClass="bg-secondary data-dragging:scale-[1.03] data-dragging:rounded-control data-dragging:bg-secondary-highlight data-dragging:shadow-overlay"
					>
						{(role, controls) => (
							<div
								data-role-row=""
								data-sortable-row=""
								class={cx(
									"flex h-10 w-full items-center gap-2 pr-1 pl-3",
									controls.grabbed() && "bg-secondary-highlight",
								)}
							>
								<RoleMark role={role} interactive={false} />
								<span class="min-w-0 flex-1 truncate text-sm font-semibold">
									{role.name}
								</span>
								<button
									{...controls.handleProps}
									type="button"
									aria-label={`Move ${role.name}`}
									class={cx(
										"flex size-8 shrink-0 cursor-grab items-center justify-center rounded-control-sm text-muted-foreground hover:text-foreground focus-ring-inset",
										"aria-pressed:bg-primary/15 aria-pressed:text-primary-highlight",
										"[&>svg]:size-5",
									)}
								>
									<GripVerticalIcon />
								</button>
							</div>
						)}
					</SortableList>
					<For each={parts().tail}>{(role) => <LockedRow role={role} />}</For>
				</div>
				<div class="flex justify-end gap-2">
					<Button variant="secondary" onClick={stop} disabled={saving()}>
						Cancel
					</Button>
					<Button onClick={save} loading={saving()} disabled={!changed()}>
						Save order
					</Button>
				</div>
			</Show>
			<Show when={failed()}>
				<div
					role="alert"
					class="flex items-start gap-2 rounded-control bg-destructive/10 px-3 py-2 text-sm text-destructive"
				>
					<DangerCircleIcon class="mt-px size-4 shrink-0" aria-hidden="true" />
					<span>The new order couldn't be saved. Try again.</span>
				</div>
			</Show>
		</section>
	);
};
