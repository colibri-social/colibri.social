import { UserMinusIcon } from "@solar-icons/solid/bold/user-minus";
import { UserPlusIcon } from "@solar-icons/solid/bold/user-plus";
import { createMemo, createSignal, For, type JSX, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { foldText } from "../../utils/fold-text";
import { Button } from "../Button/Button";
import { Drawer, DrawerContent } from "../Drawer/Drawer";
import { IconButton } from "../IconButton/IconButton";
import { SectionLabel } from "../List/List";
import {
	MemberIdentity,
	type MemberIdentityData,
} from "../Members/MemberIdentity";
import { Modal, ModalContent } from "../Modal/Modal";
import { MemberSelectRow } from "../Selection/SelectionRows";
import { SearchField } from "../TextField/TextField";

export const matchesMember = (member: MemberIdentityData, query: string) => {
	const needle = foldText(query.trim().replace(/^@/, ""));
	if (!needle) return true;
	return (
		foldText(member.name).includes(needle) ||
		foldText(member.handle ?? "").includes(needle)
	);
};

export type MemberPickerProps = {
	candidates: readonly MemberIdentityData[];
	selected: readonly string[];
	onChange: (ids: string[]) => void;
	searchLabel?: string;
	emptyLabel?: string;
	class?: string;
};

export const MemberPicker = (props: MemberPickerProps) => {
	const [query, setQuery] = createSignal("");
	const visible = createMemo(() =>
		props.candidates.filter((member) => matchesMember(member, query())),
	);
	const toggle = (id: string, on: boolean) => {
		const rest = props.selected.filter((entry) => entry !== id);
		props.onChange(on ? [...rest, id] : rest);
	};

	return (
		<div class={cx("flex flex-col gap-4", props.class)}>
			<SearchField
				aria-label={props.searchLabel ?? "Search members"}
				placeholder={props.searchLabel ?? "Search members..."}
				value={query()}
				onChange={setQuery}
			/>
			<Show
				when={visible().length > 0}
				fallback={
					<p class="m-0 py-6 text-center text-sm text-muted-foreground">
						{query().trim()
							? `No members match "${query().trim()}".`
							: (props.emptyLabel ?? "Everyone already has this role.")}
					</p>
				}
			>
				<div data-member-picker="" class="flex flex-col">
					<For each={visible()}>
						{(member) => (
							<MemberSelectRow
								member={member}
								checked={props.selected.includes(member.id)}
								onChange={(on) => toggle(member.id, on)}
							/>
						)}
					</For>
				</div>
			</Show>
		</div>
	);
};

export type RoleMembersProps = {
	roleName: string;
	members: readonly MemberIdentityData[];
	candidates: readonly MemberIdentityData[];
	onRemove?: (member: MemberIdentityData) => void | Promise<void>;
	onAdd?: (ids: string[]) => void | Promise<void>;
	platform?: "desktop" | "mobile";
	canManage?: boolean;
	class?: string;
};

export const RoleMembers = (props: RoleMembersProps) => {
	const [open, setOpen] = createSignal(false);
	const [picked, setPicked] = createSignal<string[]>([]);
	const [adding, setAdding] = createSignal(false);
	const [removing, setRemoving] = createSignal<string[]>([]);
	const canManage = () => props.canManage ?? true;
	const memberIds = createMemo(
		() => new Set(props.members.map((member) => member.id)),
	);
	const available = createMemo(() =>
		props.candidates.filter((member) => !memberIds().has(member.id)),
	);

	const openPicker = () => {
		setPicked([]);
		setOpen(true);
	};

	const add = async () => {
		const ids = picked();
		if (ids.length === 0) return;
		setAdding(true);
		try {
			await props.onAdd?.(ids);
			setOpen(false);
		} finally {
			setAdding(false);
		}
	};

	const remove = async (member: MemberIdentityData) => {
		setRemoving((current) => [...current, member.id]);
		try {
			await props.onRemove?.(member);
		} finally {
			setRemoving((current) => current.filter((id) => id !== member.id));
		}
	};

	const addLabel = () =>
		picked().length > 1
			? `Add ${picked().length} members`
			: picked().length === 1
				? "Add 1 member"
				: "Add members";

	const picker = (): JSX.Element => (
		<MemberPicker
			candidates={available()}
			selected={picked()}
			onChange={setPicked}
		/>
	);

	const footer = () => (
		<>
			<Button variant="secondary" onClick={() => setOpen(false)}>
				Cancel
			</Button>
			<Button onClick={add} loading={adding()} disabled={picked().length === 0}>
				{addLabel()}
			</Button>
		</>
	);

	return (
		<section
			data-role-members=""
			class={cx("flex w-full flex-col gap-2", props.class)}
		>
			<SectionLabel
				label="Members"
				count={props.members.length}
				action={
					canManage() && props.onAdd
						? {
								label: "Add members",
								icon: <UserPlusIcon />,
								onClick: openPicker,
							}
						: undefined
				}
			/>
			<Show
				when={props.members.length > 0}
				fallback={
					<p class="m-0 rounded-control bg-secondary px-3 py-6 text-center text-sm text-muted-foreground">
						No one has the {props.roleName} role yet.
					</p>
				}
			>
				<div class="flex flex-col divide-y divide-border overflow-hidden rounded-control bg-secondary">
					<For each={props.members}>
						{(member) => (
							<div
								data-role-member={member.id}
								class="flex h-14 items-center gap-2 py-2 pr-2 pl-2"
							>
								<MemberIdentity member={member} class="flex-1" />
								<Show when={canManage() && props.onRemove}>
									<IconButton
										variant="ghost"
										size="md"
										label={`Remove ${member.name} from ${props.roleName}`}
										icon={<UserMinusIcon />}
										loading={removing().includes(member.id)}
										onClick={() => remove(member)}
										class="text-muted-foreground hover:text-destructive"
									/>
								</Show>
							</div>
						)}
					</For>
				</div>
			</Show>
			<Show
				when={props.platform === "mobile"}
				fallback={
					<Modal open={open()} onOpenChange={setOpen}>
						<ModalContent
							title={`Add members to ${props.roleName}`}
							class="md:w-[440px]"
							footer={footer()}
						>
							<div class="-mx-2 max-h-[min(420px,60dvh)] overflow-x-hidden overflow-y-auto px-2 ring-room-y">
								{picker()}
							</div>
						</ModalContent>
					</Modal>
				}
			>
				<Drawer open={open()} onOpenChange={setOpen} initialFocus="content">
					<DrawerContent
						title={`Add members to ${props.roleName}`}
						footer={<div class="flex gap-2 [&>*]:flex-1">{footer()}</div>}
					>
						{picker()}
					</DrawerContent>
				</Drawer>
			</Show>
		</section>
	);
};
