import {
	AudiencePicker,
	Button,
	ConfirmDialog,
	ListGroup,
	NavRow,
	StatusScreen,
	TextField,
	ToggleRow,
	toast,
} from "@colibri-social/ui";
import { DangerTriangleIcon } from "@solar-icons/solid/bold/danger-triangle";
import { FolderIcon } from "@solar-icons/solid/bold/folder";
import { ShieldUserIcon } from "@solar-icons/solid/bold/shield-user";
import {
	batch,
	createEffect,
	createMemo,
	createSignal,
	onCleanup,
	Show,
} from "solid-js";
import type { PermissionOverride } from "../../../data/types";
import { defineContract, slot } from "../../../screen/define";
import { NEW_ENTRY } from "../../../shell/layers";
import type { AdminArgs } from "../../../shell/registry";
import { useStack } from "../../../shell/stack";
import { useUnsavedChanges } from "../../../shell/unsaved-changes";
import { createUnsavedForm, UnsavedBar } from "../../settings/unsaved-form";
import { type Audience, createAudienceOptions } from "../channel/audience";
import { privateOverrides } from "../channel/channel.contract";
import { AdminNavHeader } from "../desktop/page-header";
import { AdminDeveloper } from "../developer";
import { createOverrideTargets } from "../permissions/override-targets";
import {
	cleanOverrides,
	openPermissions,
	providePermissionDraft,
	sameOverrides,
} from "../permissions/permissions";
import { useAdminSpace } from "../space-admin";
import { isRestricted } from "./category-audience";

const CATEGORY_NAME_MAX = 32;

const NO_AUDIENCE: Audience = { roles: [], members: [] };

export const adminCategory = defineContract({
	id: "adminCategory",
	model: (args: AdminArgs) => {
		const stack = useStack();
		const admin = useAdminSpace(args.space);
		const { data, community, can } = admin;
		const creating = args.id === NEW_ENTRY;
		const space = createMemo(() => {
			const current = community();
			return current ? data.space(current) : undefined;
		});
		const category = createMemo(() =>
			creating
				? undefined
				: space()
						?.categories.value()
						?.find((entry) => entry.rkey === args.id),
		);
		const loading = () =>
			data.communities.loading() || !!space()?.categories.loading();
		const unavailable = () =>
			!loading() && (!community() || (!creating && !category()));
		const canEdit = () => can("category.update");
		const canDelete = () => can("category.delete");
		const canEditChannels = () => can("channel.update");
		const allowed = () =>
			creating ? can("category.create") : canEdit() || canDelete();
		const developerMode = () => data.controls().developerMode;

		const savedOverrides = createMemo((): PermissionOverride[] =>
			(category()?.permissionOverrides ?? []).map((override) => ({
				...override,
			})),
		);

		const [step, setStep] = createSignal<1 | 2>(1);
		const [name, setName] = createSignal("");
		const [restricted, setRestricted] = createSignal(false);
		const [audience, setAudience] = createSignal<Audience>(NO_AUDIENCE);
		const [overrides, setOverrides] = createSignal<PermissionOverride[]>([]);
		const [saving, setSaving] = createSignal(false);
		const [attempted, setAttempted] = createSignal(false);
		const [deleteOpen, setDeleteOpen] = createSignal(false);

		const seed = (view: { name: string }) => {
			batch(() => {
				setName(view.name);
				setOverrides(savedOverrides());
				setAttempted(false);
			});
		};

		let seeded = creating;
		createEffect(() => {
			if (seeded) return;
			const view = category();
			if (!view) return;
			seed(view);
			seeded = true;
		});

		const options = createAudienceOptions(community, space);
		const trimmed = () => name().trim();
		const nameError = () =>
			attempted() && !trimmed() ? "Give the category a name." : undefined;
		const targets = createOverrideTargets(community, space);
		const canOverride = () => can("role.manage");
		const canRestrict = () => canOverride() && !!targets.defaultRole();
		const overridesChanged = () =>
			!creating && !sameOverrides(overrides(), savedOverrides());
		const dirty = createMemo(() =>
			creating
				? !!trimmed() || restricted()
				: trimmed() !== (category()?.name ?? trimmed()) || overridesChanged(),
		);

		const depth = () =>
			stack
				.mounted()
				.findIndex(
					(layer) =>
						layer.kind === "admin" &&
						layer.page === "category" &&
						layer.space === args.space &&
						layer.id === args.id,
				) + 1;

		onCleanup(
			stack.setPopGuard({
				get depth() {
					return depth();
				},
				blocked: () => !saving() && step() === 2,
				onBlocked: () => setStep(1),
			}),
		);
		if (creating) {
			useUnsavedChanges({
				depth,
				dirty: () => !saving() && dirty(),
				description: () => "This category won't be created.",
			});
		}

		const leave = () => stack.forcePop();

		const run = async (work: () => Promise<void>, failure: string) => {
			setSaving(true);
			try {
				await work();
			} catch {
				toast.error(failure);
			} finally {
				setSaving(false);
			}
		};

		const create = async () => {
			const current = community();
			if (!current) return;
			const picked = audience();
			const fallback = targets.defaultRole();
			const visibility = isRestricted(picked)
				? picked
				: { roles: [], members: [data.viewer.did] };
			const created = await data.categories.create(
				current.did,
				trimmed(),
				restricted() && fallback
					? { permissionOverrides: privateOverrides(fallback, visibility) }
					: {},
			);
			toast.success(`Created ${created.name}`);
			leave();
		};

		const submitDetails = () => {
			setAttempted(true);
			if (saving() || !trimmed()) return;
			if (restricted()) {
				setStep(2);
				return;
			}
			void run(create, "Couldn't create the category");
		};

		const submitAudience = () => {
			if (saving()) return;
			void run(create, "Couldn't create the category");
		};

		const hasSelection = () => isRestricted(audience());
		const createTitle = () =>
			step() === 2 ? "Add members and roles" : "Create new category";
		const submitLabel = () =>
			step() === 2
				? hasSelection()
					? "Create"
					: "Skip"
				: restricted()
					? "Next"
					: "Create";
		const submit = () => (step() === 2 ? submitAudience() : submitDetails());

		const save = () => {
			setAttempted(true);
			const current = community();
			const view = category();
			if (!current || !view || saving() || !trimmed() || !dirty()) return;
			void run(async () => {
				const updated = await data.categories.update(current.did, view.rkey, {
					...(trimmed() !== view.name ? { name: trimmed() } : {}),
					...(overridesChanged()
						? { permissionOverrides: cleanOverrides(overrides()) }
						: {}),
				});
				seed(updated);
				toast.success("Category settings saved");
			}, "Couldn't save the category settings");
		};

		const unsaved = creating
			? undefined
			: createUnsavedForm({
					depth,
					dirty,
					saving,
					save,
					reset: () => {
						const view = category();
						if (view) seed(view);
					},
				});
		if (!creating) {
			providePermissionDraft("category", args.space, args.id ?? "", {
				overrides,
				setOverrides,
				targets,
				scope: () => "category",
				canChange: can,
				disabled: () => saving() || !canEdit() || !canOverride(),
				form: unsaved,
			});
		}

		const remove = async () => {
			const current = community();
			const view = category();
			if (!current || !view) return;
			try {
				await data.categories.remove(current.did, view);
			} catch (error) {
				toast.error("Couldn't delete the category");
				throw error;
			}
			toast.success(`Deleted ${view.name}`);
			leave();
		};

		return {
			...admin,
			creating,
			step,
			category,
			loading,
			unavailable,
			allowed,
			canEdit,
			canDelete,
			canEditChannels,
			developerMode,
			name,
			setName,
			nameError,
			restricted,
			canRestrict,
			setRestricted,
			audience,
			setAudience,
			hasSelection,
			options,
			openPermissions: () =>
				openPermissions(stack, "category", args.space, args.id ?? ""),
			saving,
			dirty,
			submitDetails,
			submitAudience,
			createTitle,
			submitLabel,
			submit,
			ready: () => allowed() && !unavailable(),
			save,
			unsaved,
			back: () => stack.pop(),
			deleteOpen,
			setDeleteOpen,
			remove,
		};
	},
	slots: {
		Header: slot((m) => (
			<Show
				when={m.creating}
				fallback={
					<AdminNavHeader
						safeTop
						kind="close"
						navigateLabel="Close category settings"
						onNavigate={m.back}
						title="Category settings"
					/>
				}
			>
				<AdminNavHeader
					safeTop
					kind="back"
					onNavigate={m.back}
					title={m.createTitle()}
					action={
						m.ready()
							? {
									type: "text",
									label: m.submitLabel(),
									onClick: m.submit,
									loading: m.saving(),
								}
							: undefined
					}
				/>
			</Show>
		)),
		Bar: slot((m) => <UnsavedBar form={m.unsaved} />),
		Unavailable: slot((m) => (
			<Show
				when={m.unavailable()}
				fallback={
					<StatusScreen
						tone="neutral"
						icon={<DangerTriangleIcon />}
						title={
							m.creating
								? "You can't create categories here"
								: "You can't manage this category"
						}
						description="Only members with permission to manage categories can do this."
					/>
				}
			>
				<StatusScreen
					tone="neutral"
					icon={<FolderIcon />}
					title={
						m.community()
							? "This category doesn't exist anymore"
							: "This Space isn't available"
					}
					description={
						m.community()
							? "It may have been deleted."
							: "It may have been deleted, or you're no longer a member."
					}
				/>
			</Show>
		)),
		Details: slot((m) => (
			<div data-category-create="" class="flex flex-col gap-6">
				<TextField
					label="Category name"
					placeholder="New category"
					value={m.name()}
					onChange={m.setName}
					maxLength={CATEGORY_NAME_MAX}
					error={m.nameError()}
					disabled={m.saving()}
					autocomplete="off"
				/>
				<Show when={m.canRestrict()}>
					<ListGroup>
						<ToggleRow
							title="Make category private?"
							description="Private categories can only be seen by certain members and roles. All channels in the category follow this, unless they're set otherwise."
							checked={m.restricted()}
							onChange={m.setRestricted}
							disabled={m.saving()}
						/>
					</ListGroup>
				</Show>
			</div>
		)),
		Audience: slot((m) => (
			<AudiencePicker
				searchLabel="Search members and roles"
				roles={m.options.roles()}
				members={m.options.members()}
				selectedRoles={m.audience().roles}
				selectedMembers={m.audience().members}
				onRolesChange={(roles) => m.setAudience({ ...m.audience(), roles })}
				onMembersChange={(members) =>
					m.setAudience({ ...m.audience(), members })
				}
				canSelectRole={m.options.canSelectRole}
				canSelectMember={m.options.canSelectMember}
			/>
		)),
		General: slot((m) => (
			<TextField
				label="Category name"
				value={m.name()}
				onChange={m.setName}
				maxLength={CATEGORY_NAME_MAX}
				error={m.nameError()}
				disabled={m.saving() || !m.canEdit()}
				autocomplete="off"
			/>
		)),
		Options: slot((m) => (
			<ListGroup>
				<NavRow
					icon={<ShieldUserIcon />}
					label="Category permissions"
					disabled={m.saving() || !m.canEditChannels()}
					onClick={m.openPermissions}
				/>
			</ListGroup>
		)),
		Developer: slot((m) => (
			<AdminDeveloper
				target={(() => {
					const category = m.category();
					const community = m.community();
					return m.developerMode() && category && community
						? {
								copyValue: `at://${community.did}/social.colibri.beta.category/${category.rkey}`,
							}
						: undefined;
				})()}
			/>
		)),
		Delete: slot((m) => (
			<Show when={m.canDelete()}>
				<Button
					variant="destructive"
					block
					onClick={() => m.setDeleteOpen(true)}
				>
					Delete category
				</Button>
				<ConfirmDialog
					open={m.deleteOpen()}
					onOpenChange={m.setDeleteOpen}
					title={`Delete ${m.category()?.name ?? ""}?`}
					description="This deletes the category. Channels inside it aren't deleted and move to the top of the list. This can't be undone."
					confirmLabel="Delete category"
					tone="destructive"
					onConfirm={m.remove}
				/>
			</Show>
		)),
	},
});
