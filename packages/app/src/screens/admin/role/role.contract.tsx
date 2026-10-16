import {
	Button,
	ColorPicker,
	ConfirmDialog,
	ListGroup,
	NavRow,
	NavRowSkeleton,
	ROLE_COLOR_PRESETS,
	RoleBadgeSetting,
	StatusScreen,
	TextField,
	ToggleRow,
	toast,
} from "@colibri-social/ui";
import { ShieldKeyholeIcon } from "@solar-icons/solid/bold/shield-keyhole";
import {
	batch,
	createEffect,
	createMemo,
	createSignal,
	Match,
	on,
	onCleanup,
	Show,
	Switch,
	untrack,
} from "solid-js";
import { createStore } from "solid-js/store";
import { displayNameOf } from "../../../data/adapters/authors";
import { isVisibleRole } from "../../../data/roles";
import type { MemberView } from "../../../data/types";
import { defineContract, slot } from "../../../screen/define";
import { usePlatform } from "../../../screen/platform";
import { NEW_ENTRY } from "../../../shell/layers";
import type { AdminArgs } from "../../../shell/registry";
import { useStack } from "../../../shell/stack";
import { useUnsavedChanges } from "../../../shell/unsaved-changes";
import { uiPresence } from "../../members/member-adapter";
import { createUnsavedForm, UnsavedBar } from "../../settings/unsaved-form";
import { AdminNavHeader } from "../desktop/page-header";
import { AdminDeveloper } from "../developer";
import { useRoleAccess } from "../roles/role-access";
import {
	DEFAULT_ROLE_NAME,
	deleteDescription,
	draftOf,
	formOf,
	ROLE_NAME_MAX,
	type RoleForm,
	roleNameError,
	rolePatch,
	sameBadge,
	samePermissions,
} from "./role-form";
import { openRolePage, provideRoleDraft } from "./role-pages";

const memberIdentity = (
	member: MemberView,
	presence: ReturnType<typeof uiPresence>,
) => ({
	id: member.actor.did,
	name: displayNameOf(member.actor, member),
	handle: member.actor.handle,
	avatarSrc: member.actor.avatar,
	presence,
	bot: member.actor.isBot,
});

export const adminRole = defineContract({
	id: "adminRole",
	model: (args: AdminArgs) => {
		const stack = useStack();
		const access = useRoleAccess(() => args.space);
		const isNew = args.id === NEW_ENTRY;
		const role = createMemo(() =>
			isNew
				? undefined
				: access
						.roles()
						.find((entry) => entry.rkey === args.id && isVisibleRole(entry)),
		);
		const [deleted, setDeleted] = createSignal(false);
		const missing = () =>
			access.missing() ||
			(!isNew && !deleted() && !access.loading() && !role());
		const editable = () => {
			const current = role();
			return isNew ? access.canManage() : !!current && access.editable(current);
		};

		const [form, setForm] = createStore<RoleForm>(formOf(undefined));
		const [baseline, setBaseline] = createSignal<RoleForm>();
		const dirtyAgainst = (base: RoleForm) => {
			if (form.name.trim() !== base.name) return true;
			if ((form.color ?? "") !== (base.color ?? "")) return true;
			if (!sameBadge(form.badge, base.badge)) return true;
			if (form.hoisted !== base.hoisted) return true;
			if (form.mentionable !== base.mentionable) return true;
			return !samePermissions(form.permissions, base.permissions);
		};
		createEffect(() => {
			if (baseline() || access.loading()) return;
			if (!isNew && !role()) return;
			const initial = formOf(role());
			batch(() => {
				setBaseline(initial);
				setForm(formOf(role()));
			});
		});
		createEffect(
			on(role, (current) => {
				if (!current) return;
				const latest = formOf(current);
				const base = untrack(baseline);
				if (!base || untrack(() => dirtyAgainst(base))) return;
				batch(() => {
					setBaseline(latest);
					setForm(formOf(current));
				});
			}),
		);

		const pendingImages = new Map<string, File>();
		onCleanup(() => {
			for (const url of pendingImages.keys()) URL.revokeObjectURL(url);
		});

		const dirty = createMemo(() => {
			const base = baseline();
			if (!base) return false;
			return isNew || dirtyAgainst(base);
		});

		const [saving, setSaving] = createSignal(false);
		const [attempted, setAttempted] = createSignal(false);
		const [deleteOpen, setDeleteOpen] = createSignal(false);
		const nameError = () =>
			attempted() ? roleNameError(form.name) : undefined;

		const depth = () =>
			stack
				.mounted()
				.findIndex(
					(layer) =>
						layer.kind === "admin" &&
						layer.page === "role" &&
						layer.id === args.id,
				) + 1;
		if (isNew) {
			useUnsavedChanges({
				depth,
				dirty: () => editable() && dirty() && !saving() && !deleted(),
				description: () => "This role won't be created.",
			});
		}

		const pendingImage = () =>
			form.badge?.kind === "image"
				? pendingImages.get(form.badge.url)
				: undefined;

		const save = async () => {
			setAttempted(true);
			const space = access.space();
			const base = baseline();
			if (!space || !base || saving() || roleNameError(form.name)) return;
			if (!isNew && !dirty()) return;
			setSaving(true);
			try {
				if (isNew) {
					const created = await space.createRole(draftOf(form));
					const image = pendingImage();
					if (image) await space.setRoleBadgeImage(created.rkey, image);
					setBaseline(formOf(created));
					toast.success("Role created");
					stack.replaceTop({
						kind: "admin",
						space: args.space,
						page: "role",
						id: created.rkey,
					});
					return;
				}
				const current = role();
				if (!current) return;
				const patch = rolePatch(base, form);
				if (Object.keys(patch).length > 0) {
					await space.updateRole(current.rkey, patch);
				}
				const image = pendingImage();
				if (image) await space.setRoleBadgeImage(current.rkey, image);
				const saved = { ...form, name: form.name.trim() };
				batch(() => {
					setBaseline(saved);
					setForm("name", saved.name);
					setAttempted(false);
				});
				toast.success("Role updated");
			} catch {
				toast.error(
					isNew ? "Couldn't create the role" : "Couldn't update the role",
				);
			} finally {
				setSaving(false);
			}
		};

		const reset = () => {
			const base = baseline();
			if (!base) return;
			batch(() => {
				setForm({ ...base, permissions: [...base.permissions] });
				setAttempted(false);
			});
		};

		const unsavedForm = isNew
			? undefined
			: createUnsavedForm({
					depth,
					dirty: () => editable() && dirty() && !deleted(),
					saving,
					save,
					reset,
				});

		const remove = async () => {
			const space = access.space();
			const current = role();
			if (!space || !current) return;
			setDeleted(true);
			try {
				await space.deleteRole(current.rkey);
				toast.success("Role deleted");
				stack.forcePop();
			} catch (error) {
				setDeleted(false);
				toast.error("Couldn't delete the role");
				throw error;
			}
		};

		const members = createMemo(() => access.space()?.members.value() ?? []);
		const presenceOf = (member: MemberView) =>
			uiPresence(access.data.presenceOf(member.actor.did));
		const holders = createMemo(() => {
			const current = role();
			if (!current) return [];
			return members()
				.filter((member) => member.roles?.includes(current.rkey))
				.map((member) => memberIdentity(member, presenceOf(member)));
		});
		const candidates = createMemo(() =>
			members().map((member) => memberIdentity(member, presenceOf(member))),
		);
		const setHolding = async (dids: readonly string[], holding: boolean) => {
			const space = access.space();
			const current = role();
			if (!space || !current) return;
			try {
				for (const did of dids) {
					const member = space.memberByDid(did as MemberView["actor"]["did"]);
					if (!member) continue;
					const rest = (member.roles ?? []).filter(
						(rkey) => rkey !== current.rkey,
					);
					await space.setMemberRoles(
						member.actor.did,
						holding ? [...rest, current.rkey] : rest,
					);
				}
			} catch (error) {
				toast.error(
					holding
						? "Couldn't add members to the role"
						: "Couldn't remove the member from the role",
				);
				throw error;
			}
		};

		provideRoleDraft(args.space, args.id ?? NEW_ENTRY, {
			name: () => role()?.name ?? (form.name.trim() || DEFAULT_ROLE_NAME),
			permissions: () => form.permissions,
			setPermissions: (value) => setForm("permissions", value),
			canGrant: access.canGrant,
			disabled: () => !editable() || saving(),
			holders,
			candidates,
			canManage: editable,
			addHolders: (ids) => setHolding(ids, true),
			removeHolder: (id) => setHolding([id], false),
			form: unsavedForm,
		});
		const atUri = () => {
			const community = access.community();
			const current = role();
			return community && current
				? `at://${community.did}/social.colibri.beta.role/${current.rkey}`
				: undefined;
		};

		const onUploadImage = async (file: File) => {
			const url = URL.createObjectURL(file);
			pendingImages.set(url, file);
			return url;
		};

		return {
			...access,
			args,
			stack,
			isNew,
			role,
			missing,
			editable,
			form,
			setForm,
			ready: () => !!baseline(),
			dirty,
			saving,
			save,
			unsaved: unsavedForm,
			nameError,
			deleteOpen,
			setDeleteOpen,
			remove,
			holders,
			candidates,
			addHolders: (ids: string[]) => setHolding(ids, true),
			removeHolder: (id: string) => setHolding([id], false),
			onUploadImage,
			openPermissions: () =>
				openRolePage(
					stack,
					args.space,
					args.id ?? NEW_ENTRY,
					"role-permissions",
				),
			openMembers: () =>
				openRolePage(stack, args.space, args.id ?? NEW_ENTRY, "role-members"),
			developerMode: () => access.data.controls().developerMode,
			atUri,
		};
	},
	slots: {
		Header: slot((m) => (
			<AdminNavHeader
				safeTop
				kind="back"
				navigateLabel="Back to roles"
				onNavigate={() => m.stack.pop()}
				title={
					m.isNew
						? "Create role"
						: m.role()
							? m.role()?.name
							: m.missing()
								? ""
								: "Role"
				}
				action={
					m.isNew && m.editable() && !m.missing() && m.ready()
						? {
								type: "text",
								label: "Create",
								onClick: () => void m.save(),
								loading: m.saving(),
							}
						: undefined
				}
			/>
		)),
		Bar: slot((m) => (
			<Show when={m.editable() && !m.missing() && m.ready()}>
				<UnsavedBar form={m.unsaved} />
			</Show>
		)),
		Unavailable: slot((m) => (
			<Show when={m.missing()}>
				<StatusScreen
					tone="neutral"
					icon={<ShieldKeyholeIcon />}
					title="This role doesn't exist anymore"
					description="It may have been deleted by someone else."
					actions={
						<Button block variant="secondary" onClick={() => m.stack.pop()}>
							Back to roles
						</Button>
					}
				/>
			</Show>
		)),
		Loading: slot((m) => (
			<Show when={!m.missing() && !m.ready()}>
				<div aria-hidden="true" class="flex flex-col gap-2 p-4">
					<NavRowSkeleton />
					<NavRowSkeleton />
					<NavRowSkeleton />
				</div>
			</Show>
		)),
		Locked: slot((m) => (
			<Show when={!m.editable() && m.ready()}>
				<p
					data-role-locked=""
					class="m-0 rounded-control bg-secondary px-3 py-2 text-sm text-pretty text-muted-foreground"
				>
					This role is at or above your own highest role, so you can't change
					it.
				</p>
			</Show>
		)),
		Name: slot((m) => (
			<TextField
				label="Role name"
				placeholder={DEFAULT_ROLE_NAME}
				maxLength={ROLE_NAME_MAX}
				value={m.form.name}
				onChange={(value) => m.setForm("name", value)}
				error={m.nameError()}
				disabled={!m.editable() || m.saving()}
			/>
		)),
		Color: slot((m) => (
			<ColorPicker
				platform={usePlatform()()}
				variant="row"
				label="Color"
				value={m.form.color ?? ""}
				onChange={(hex) => m.setForm("color", hex)}
				onRemove={
					m.form.color ? () => m.setForm("color", undefined) : undefined
				}
				presets={ROLE_COLOR_PRESETS}
				disabled={!m.editable() || m.saving()}
			/>
		)),
		Display: slot((m) => (
			<ListGroup>
				<ToggleRow
					title="Display separately"
					description="Display members with this role separately from online members."
					checked={m.form.hoisted}
					onChange={(on) => m.setForm("hoisted", on)}
					disabled={!m.editable() || m.saving()}
				/>
				<ToggleRow
					title="Mentionable"
					description="Let other members @-mention this role."
					checked={m.form.mentionable}
					onChange={(on) => m.setForm("mentionable", on)}
					disabled={!m.editable() || m.saving()}
				/>
			</ListGroup>
		)),
		Details: slot((m) => (
			<>
				<ListGroup>
					<NavRow
						label="Permissions"
						value={
							m.form.permissions.length > 0
								? String(m.form.permissions.length)
								: undefined
						}
						onClick={m.openPermissions}
					/>
					<RoleBadgeSetting
						platform={usePlatform()()}
						role={{
							id: m.args.id ?? NEW_ENTRY,
							name: m.form.name || DEFAULT_ROLE_NAME,
							color: m.form.color,
						}}
						value={m.form.badge}
						onChange={(badge) => m.setForm("badge", badge)}
						onUploadImage={m.onUploadImage}
						disabled={!m.editable() || m.saving()}
					/>
					<Show when={!m.isNew && m.role()}>
						<NavRow
							label="Members"
							value={String(m.holders().length)}
							onClick={m.openMembers}
						/>
					</Show>
				</ListGroup>
			</>
		)),
		Developer: slot((m) => (
			<AdminDeveloper
				target={(() => {
					const uri = m.atUri();
					return m.developerMode() && uri ? { copyValue: uri } : undefined;
				})()}
			/>
		)),
		Danger: slot((m) => (
			<Show when={!m.isNew && m.editable() && m.role()}>
				<Button
					block
					variant="destructive"
					onClick={() => m.setDeleteOpen(true)}
				>
					Delete role
				</Button>
			</Show>
		)),
		Dialogs: slot((m) => (
			<>
				<Switch>
					<Match when={m.role()}>
						{(current) => (
							<ConfirmDialog
								open={m.deleteOpen()}
								onOpenChange={m.setDeleteOpen}
								tone="destructive"
								title={`Delete the "${current().name}" role?`}
								description={deleteDescription(current().memberCount ?? 0)}
								confirmLabel="Delete role"
								onConfirm={m.remove}
							/>
						)}
					</Match>
				</Switch>
			</>
		)),
	},
});
