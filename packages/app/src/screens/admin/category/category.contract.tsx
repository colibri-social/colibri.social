import {
	AudiencePicker,
	Button,
	ConfirmDialog,
	DeveloperModeCard,
	ListGroup,
	Modal,
	ModalContent,
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
	createEffect,
	createMemo,
	createSignal,
	onCleanup,
	Show,
} from "solid-js";
import type { Did } from "../../../data/types";
import { defineContract, slot } from "../../../screen/define";
import { usePlatform } from "../../../screen/platform";
import { NEW_ENTRY } from "../../../shell/layers";
import type { AdminArgs } from "../../../shell/registry";
import { useStack } from "../../../shell/stack";
import {
	type Audience,
	type AudienceKind,
	createAudienceOptions,
	sameAudience,
} from "../channel/audience";
import { AdminNavHeader } from "../desktop/page-header";
import {
	openPermissions,
	providePermissionDraft,
} from "../permissions/permissions";
import { useAdminSpace } from "../space-admin";
import { isRestricted } from "./category-audience";

export const CATEGORY_NAME_MAX = 32;

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

		const savedVisible = createMemo(
			(): Audience => ({
				roles: [...(category()?.visibleToRoles ?? [])],
				members: [...(category()?.visibleToMembers ?? [])],
			}),
		);
		const savedPost = createMemo(
			(): Audience => ({
				roles: [...(category()?.allowedRoles ?? [])],
				members: [...(category()?.allowedMembers ?? [])],
			}),
		);
		const savedOwnerOnly = () => !!category()?.ownerOnly;
		const isOwner = () => !!community()?.viewer.isOwner;

		const [step, setStep] = createSignal<1 | 2>(1);
		const [name, setName] = createSignal("");
		const [restricted, setRestricted] = createSignal(false);
		const [audience, setAudience] = createSignal<Audience>(NO_AUDIENCE);
		const [post, setPost] = createSignal<Audience>(NO_AUDIENCE);
		const [ownerOnly, setOwnerOnly] = createSignal(false);
		const [saving, setSaving] = createSignal(false);
		const [attempted, setAttempted] = createSignal(false);
		const [discardOpen, setDiscardOpen] = createSignal(false);
		const [deleteOpen, setDeleteOpen] = createSignal(false);

		let seeded = creating;
		createEffect(() => {
			if (seeded) return;
			const view = category();
			if (!view) return;
			setName(view.name);
			setAudience(savedVisible());
			setPost(savedPost());
			setOwnerOnly(savedOwnerOnly());
			seeded = true;
		});

		const options = createAudienceOptions(community, space);
		const trimmed = () => name().trim();
		const nameError = () =>
			attempted() && !trimmed() ? "Give the category a name." : undefined;
		const visibleChanged = () =>
			!creating && !sameAudience(audience(), savedVisible());
		const postChanged = () => !creating && !sameAudience(post(), savedPost());
		const ownerOnlyChanged = () =>
			!creating && ownerOnly() !== savedOwnerOnly();
		const audienceChanged = () =>
			visibleChanged() || postChanged() || ownerOnlyChanged();
		const audienceOf = (kind: AudienceKind) =>
			kind === "visible" ? audience() : post();
		const setAudienceOf = (kind: AudienceKind, next: Audience) =>
			kind === "visible" ? setAudience(next) : setPost(next);
		if (!creating) {
			providePermissionDraft("category", args.space, args.id ?? "", {
				ownerOnly,
				get setOwnerOnly() {
					return isOwner() ? setOwnerOnly : undefined;
				},
				audience: audienceOf,
				setAudience: setAudienceOf,
				options,
				disabled: () => saving() || !canEditChannels(),
			});
		}
		const dirty = createMemo(() =>
			creating
				? !!trimmed() || restricted()
				: trimmed() !== (category()?.name ?? trimmed()) || audienceChanged(),
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
				blocked: () => !saving() && (step() === 2 || dirty()),
				onBlocked: () => {
					if (step() === 2) setStep(1);
					else setDiscardOpen(true);
				},
			}),
		);

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
			const visibility = restricted()
				? isRestricted(picked)
					? picked
					: { roles: [], members: [data.viewer.did] }
				: NO_AUDIENCE;
			const created = await data.categories.create(current.did, trimmed(), {
				visibleToRoles: visibility.roles,
				visibleToMembers: visibility.members as Did[],
			});
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

		const save = () => {
			setAttempted(true);
			const current = community();
			const view = category();
			if (!current || !view || saving() || !trimmed()) return;
			void run(async () => {
				const visible = audience();
				const posting = post();
				await data.categories.update(current.did, view.rkey, {
					...(trimmed() !== view.name ? { name: trimmed() } : {}),
					...(visibleChanged()
						? {
								visibleToRoles: visible.roles,
								visibleToMembers: visible.members as Did[],
							}
						: {}),
					...(postChanged()
						? {
								allowedRoles: posting.roles,
								allowedMembers: posting.members as Did[],
							}
						: {}),
					...(ownerOnlyChanged() ? { ownerOnly: ownerOnly() } : {}),
				});
				toast.success("Category settings saved");
				leave();
			}, "Couldn't save the category settings");
		};

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
			setRestricted,
			audience,
			setAudience,
			hasSelection: () => isRestricted(audience()),
			options,
			openPermissions: () =>
				openPermissions(stack, "category", args.space, args.id ?? ""),
			saving,
			dirty,
			submitDetails,
			submitAudience,
			save,
			back: () => stack.pop(),
			discardOpen,
			setDiscardOpen,
			discard: () => {
				setDiscardOpen(false);
				leave();
			},
			deleteOpen,
			setDeleteOpen,
			remove,
		};
	},
	slots: {
		Header: slot((m) => {
			const ready = () => m.allowed() && !m.unavailable();
			return (
				<Show
					when={m.creating}
					fallback={
						<AdminNavHeader
							safeTop
							kind="close"
							navigateLabel="Close category settings"
							onNavigate={m.back}
							title="Category settings"
							action={
								ready() && m.canEdit() && m.dirty()
									? {
											type: "text",
											label: "Save",
											onClick: m.save,
											loading: m.saving(),
										}
									: undefined
							}
						/>
					}
				>
					<AdminNavHeader
						safeTop
						kind={
							m.step() === 2 || usePlatform()() !== "desktop" ? "back" : "close"
						}
						onNavigate={m.back}
						title={
							m.step() === 2 ? "Add members and roles" : "Create new category"
						}
						action={
							ready()
								? {
										type: "text",
										label:
											m.step() === 2
												? m.hasSelection()
													? "Create"
													: "Skip"
												: m.restricted()
													? "Next"
													: "Create",
										onClick:
											m.step() === 2 ? m.submitAudience : m.submitDetails,
										loading: m.saving(),
									}
								: undefined
						}
					/>
				</Show>
			);
		}),
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
				<ListGroup>
					<ToggleRow
						title="Make category private?"
						description="Private categories can only be seen by certain members and roles. All channels in the category follow this, unless they're set otherwise."
						checked={m.restricted()}
						onChange={m.setRestricted}
						disabled={m.saving()}
					/>
				</ListGroup>
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
			<Show when={m.developerMode() && m.category() && m.community()}>
				<DeveloperModeCard
					copyLabel="Copy AT-URI"
					copyValue={`at://${m.community()?.did}/social.colibri.beta.category/${m.category()?.rkey}`}
					pdslsHref={`https://pdsls.dev/at://${m.community()?.did}/social.colibri.beta.category/${m.category()?.rkey}`}
				/>
			</Show>
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
		Discard: slot((m) => (
			<Modal open={m.discardOpen()} onOpenChange={m.setDiscardOpen}>
				<ModalContent
					title="Discard changes?"
					description={
						m.creating
							? "This category won't be created."
							: "Your changes to this category won't be saved."
					}
					footer={
						<>
							<Button
								variant="secondary"
								onClick={() => m.setDiscardOpen(false)}
							>
								Keep editing
							</Button>
							<Button variant="destructive" onClick={m.discard}>
								Discard
							</Button>
						</>
					}
				/>
			</Modal>
		)),
	},
});
