import { DangerCircleIcon } from "@solar-icons/solid/bold/danger-circle";
import { GripVerticalIcon } from "@solar-icons/solid/bold/grip-vertical";
import { LockKeyholeMinimalisticIcon } from "@solar-icons/solid/bold/lock-keyhole-minimalistic";
import { TransferVerticalIcon } from "@solar-icons/solid/bold/transfer-vertical";
import { createMemo, createSignal, For, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { Button } from "../Button/Button";
import { SectionLabel } from "../List/List";
import { SortableList } from "../Sortable/Sortable";
import { type RoleIdentity, RoleMark } from "./RoleBadge";
import { RoleRow } from "./RoleRow";

export type SpaceRole = RoleIdentity & {
	id: string;
	protected?: boolean;
};

export type SpaceRoleListProps = {
	roles: readonly SpaceRole[];
	label?: string;
	onOpen?: (role: SpaceRole) => void;
	onReorder?: (ids: string[]) => void | Promise<void>;
	canReorder?: boolean;
	class?: string;
};

const listBox =
	"flex flex-col divide-y divide-border overflow-hidden rounded-control bg-secondary";

const splitProtected = (roles: readonly SpaceRole[]) => {
	let start = 0;
	while (start < roles.length && roles[start].protected) start++;
	let end = roles.length;
	while (end > start && roles[end - 1].protected) end--;
	return {
		head: roles.slice(0, start),
		middle: roles.slice(start, end),
		tail: roles.slice(end),
	};
};

const LockedRow = (props: { role: SpaceRole }) => (
	<div
		data-role-row=""
		data-locked=""
		class="flex h-10 w-full items-center gap-2 px-3 text-muted-foreground"
	>
		<RoleMark role={props.role} interactive={false} />
		<span class="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
			{props.role.name}
		</span>
		<span
			role="img"
			aria-label="Fixed position"
			class="flex size-4 shrink-0 items-center justify-center [&>svg]:size-4"
		>
			<LockKeyholeMinimalisticIcon />
		</span>
	</div>
);

export const SpaceRoleList = (props: SpaceRoleListProps) => {
	const [reordering, setReordering] = createSignal(false);
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
					<div class={listBox}>
						<For each={props.roles}>
							{(role) => (
								<RoleRow role={role} onClick={() => props.onOpen?.(role)} />
							)}
						</For>
					</div>
				}
			>
				<p class="m-0 text-xs text-pretty text-muted-foreground">
					Drag roles to change their order. Roles higher up outrank the ones
					below them.
				</p>
				<div class={listBox}>
					<For each={parts().head}>{(role) => <LockedRow role={role} />}</For>
					<SortableList
						items={draftRoles()}
						getId={(role) => role.id}
						itemLabel={(role) => role.name}
						onReorder={setDraft}
						disabled={saving()}
						aria-label="Roles in order"
						class="divide-y divide-border"
						itemClass="bg-secondary data-dragging:shadow-overlay data-dragging:rounded-control"
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
				<Show when={failed()}>
					<div
						role="alert"
						class="flex items-start gap-2 rounded-control bg-destructive/10 px-3 py-2 text-sm text-destructive"
					>
						<DangerCircleIcon
							class="mt-px size-4 shrink-0"
							aria-hidden="true"
						/>
						<span>The new order couldn't be saved. Try again.</span>
					</div>
				</Show>
				<div class="flex justify-end gap-2">
					<Button variant="secondary" onClick={stop} disabled={saving()}>
						Cancel
					</Button>
					<Button onClick={save} loading={saving()} disabled={!changed()}>
						Save order
					</Button>
				</div>
			</Show>
		</section>
	);
};
