import {
	AudiencePicker,
	Button,
	Drawer,
	DrawerContent,
	ListGroup,
	Modal,
	ModalContent,
	NavRow,
	RadioRow,
	RadioRowGroup,
	Select,
	StatusScreen,
	TextArea,
	TextField,
	ToggleRow,
	toast,
} from "@colibri-social/ui";
import { ChatSquareDotsIcon } from "@solar-icons/solid/bold/chat-square-dots";
import { DangerTriangleIcon } from "@solar-icons/solid/bold/danger-triangle";
import { FolderWithFilesIcon } from "@solar-icons/solid/bold/folder-with-files";
import { ShieldUserIcon } from "@solar-icons/solid/bold/shield-user";
import { VolumeLoudIcon } from "@solar-icons/solid/bold/volume-loud";
import {
	batch,
	createEffect,
	createMemo,
	createSignal,
	For,
	onCleanup,
	Show,
} from "solid-js";
import { channelSlug, isVoiceChannel } from "../../../data/ids";
import type {
	CreateChannelInput,
	UpdateChannelInput,
} from "../../../data/source";
import type { ChannelView, Did } from "../../../data/types";
import { defineContract, slot } from "../../../screen/define";
import { type Platform, usePlatform } from "../../../screen/platform";
import type { AdminArgs } from "../../../shell/registry";
import { useStack } from "../../../shell/stack";
import { useUnsavedChanges } from "../../../shell/unsaved-changes";
import { createUnsavedForm, UnsavedBar } from "../../settings/unsaved-form";
import { isRestricted } from "../category/category-audience";
import { AdminNavHeader } from "../desktop/page-header";
import { AdminDeveloper } from "../developer";
import {
	openPermissions,
	providePermissionDraft,
} from "../permissions/permissions";
import { useAdminSpace } from "../space-admin";
import {
	type Audience,
	type AudienceKind,
	createAudienceOptions,
	sameAudience,
} from "./audience";
import { parseEntryId } from "./channel-target";

export const CHANNEL_NAME_MAX = 32;
export const CHANNEL_DESCRIPTION_MAX = 256;

const TEXT_TYPE = "social.colibri.beta.channel.text";
const VOICE_TYPE = "social.colibri.beta.channel.voice";
const NO_CATEGORY = "";

type ChannelKind = "text" | "voice";

export type LinkPreviewChoice = "space" | "on" | "off";

export const linkPreviewChoiceOf = (
	view: ChannelView | undefined,
): LinkPreviewChoice =>
	view?.linkEmbeds === undefined ? "space" : view.linkEmbeds ? "on" : "off";

export const linkPreviewChange = (
	choice: LinkPreviewChoice,
): Pick<UpdateChannelInput, "linkEmbeds" | "removeLinkEmbeds"> =>
	choice === "space"
		? { removeLinkEmbeds: true }
		: { linkEmbeds: choice === "on" };

const NO_AUDIENCE: Audience = { roles: [], members: [] };

const visibleOf = (view: ChannelView | undefined): Audience => ({
	roles: [...(view?.visibleToRoles ?? [])],
	members: [...(view?.visibleToMembers ?? [])],
});

const postOf = (view: ChannelView | undefined): Audience => ({
	roles: [...(view?.allowedRoles ?? [])],
	members: [...(view?.allowedMembers ?? [])],
});

export const adminChannel = defineContract({
	id: "adminChannel",
	model: (args: AdminArgs) => {
		const stack = useStack();
		const admin = useAdminSpace(args.space);
		const { data, community, can } = admin;
		const target = parseEntryId(args.id);
		const creating = target.creating;
		const space = createMemo(() => {
			const current = community();
			return current ? data.space(current) : undefined;
		});
		const channel = createMemo(() =>
			target.creating ? undefined : space()?.channelBySlug(target.key ?? ""),
		);
		const categories = createMemo(() => space()?.categories.value() ?? []);
		const loading = () =>
			data.communities.loading() || !!space()?.channels.loading();
		const unavailable = () =>
			!loading() && (!community() || (!creating && !channel()));
		const canEdit = () => can("channel.update");
		const canDelete = () => can("channel.delete");
		const allowed = () =>
			creating ? can("channel.create") : canEdit() || canDelete();
		const isOwner = () => !!community()?.viewer.isOwner;
		const developerMode = () => data.controls().developerMode;

		const [step, setStep] = createSignal<1 | 2>(1);
		const [kind, setKind] = createSignal<ChannelKind>("text");
		const [name, setName] = createSignal("");
		const [description, setDescription] = createSignal("");
		const [category, setCategory] = createSignal(NO_CATEGORY);
		const [restricted, setRestricted] = createSignal(false);
		const [ownerOnly, setOwnerOnly] = createSignal(false);
		const [linkPreviews, setLinkPreviews] =
			createSignal<LinkPreviewChoice>("space");
		const [visible, setVisible] = createSignal<Audience>(NO_AUDIENCE);
		const [post, setPost] = createSignal<Audience>(NO_AUDIENCE);
		const [categoryOpen, setCategoryOpen] = createSignal(false);
		const [saving, setSaving] = createSignal(false);
		const [attempted, setAttempted] = createSignal(false);
		const [deleteOpen, setDeleteOpen] = createSignal(false);
		const [confirmation, setConfirmation] = createSignal("");
		const [deleting, setDeleting] = createSignal(false);

		const seedFrom = (view: ChannelView) => {
			batch(() => {
				setName(view.name);
				setDescription(view.description ?? "");
				setCategory(view.category ?? NO_CATEGORY);
				setOwnerOnly(!!view.ownerOnly);
				setLinkPreviews(linkPreviewChoiceOf(view));
				setVisible(visibleOf(view));
				setPost(postOf(view));
				setAttempted(false);
			});
		};

		let seeded = false;
		createEffect(() => {
			if (seeded) return;
			if (creating) {
				if (space()?.categories.loading()) return;
				const preset = categories().find(
					(entry) => entry.rkey === target.category,
				);
				setCategory(preset?.rkey ?? NO_CATEGORY);
				seeded = true;
				return;
			}
			const view = channel();
			if (!view) return;
			seedFrom(view);
			seeded = true;
		});

		const audience = (which: AudienceKind) =>
			which === "visible" ? visible() : post();
		const setAudience = (which: AudienceKind, next: Audience) =>
			which === "visible" ? setVisible(next) : setPost(next);
		const options = createAudienceOptions(community, space);
		if (!creating) {
			providePermissionDraft("channel", args.space, args.id ?? "", {
				ownerOnly,
				get setOwnerOnly() {
					return isOwner() ? setOwnerOnly : undefined;
				},
				audience,
				setAudience,
				options,
				disabled: () => saving() || !canEdit(),
				get form() {
					return unsaved;
				},
			});
		}

		const trimmedName = () => name().trim();
		const nameError = () =>
			attempted() && !trimmedName() ? "Give the channel a name." : undefined;
		const categoryName = () =>
			categories().find((entry) => entry.rkey === category())?.name ??
			"No category";

		const changes = (): Omit<UpdateChannelInput, "channel"> => {
			const view = channel();
			if (!view) return {};
			const patch: Omit<UpdateChannelInput, "channel"> = {};
			if (trimmedName() !== view.name) patch.name = trimmedName();
			if (description() !== (view.description ?? "")) {
				patch.description = description();
			}
			if (category() && category() !== (view.category ?? NO_CATEGORY)) {
				patch.category = category();
			}
			if (ownerOnly() !== !!view.ownerOnly) patch.ownerOnly = ownerOnly();
			if (linkPreviews() !== linkPreviewChoiceOf(view)) {
				Object.assign(patch, linkPreviewChange(linkPreviews()));
			}
			if (!sameAudience(visible(), visibleOf(view))) {
				patch.visibleToRoles = visible().roles;
				patch.visibleToMembers = visible().members as Did[];
			}
			if (!sameAudience(post(), postOf(view))) {
				patch.allowedRoles = post().roles;
				patch.allowedMembers = post().members as Did[];
			}
			return patch;
		};

		const dirty = createMemo(() => {
			if (creating) return !!trimmedName() || restricted();
			const view = channel();
			if (!view) return false;
			return Object.keys(changes()).length > 0;
		});

		const depth = () =>
			stack
				.mounted()
				.findIndex(
					(layer) =>
						layer.kind === "admin" &&
						layer.page === "channel" &&
						layer.space === args.space &&
						layer.id === args.id,
				) + 1;

		onCleanup(
			stack.setPopGuard({
				get depth() {
					return depth();
				},
				blocked: () => !saving() && !deleting() && step() === 2,
				onBlocked: () => setStep(1),
			}),
		);
		if (creating) {
			useUnsavedChanges({
				depth,
				dirty: () => !saving() && !deleting() && dirty(),
				description: () => "This channel won't be created.",
			});
		}

		const leave = () => stack.forcePop();

		const pickedAudience = () => {
			const picked = visible();
			return isRestricted(picked)
				? picked
				: { roles: [], members: [data.viewer.did] };
		};

		const create = async () => {
			const current = community();
			if (!current) return;
			const input: CreateChannelInput = {
				community: current.did,
				type: kind() === "voice" ? VOICE_TYPE : TEXT_TYPE,
				name: trimmedName(),
			};
			if (category()) input.category = category();
			if (restricted()) {
				const picked = pickedAudience();
				input.visibleToRoles = picked.roles;
				input.visibleToMembers = picked.members as Did[];
			}
			const created = await data.channels.create(input);
			toast.success(`Created #${created.name}`);
			if (isVoiceChannel(created)) {
				leave();
				return;
			}
			stack.replaceTop({
				kind: "chat",
				space: args.space,
				channel: channelSlug(created),
				channelType: created.type,
			});
		};

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

		const submitDetails = () => {
			setAttempted(true);
			if (saving() || !trimmedName()) return;
			if (restricted()) {
				setStep(2);
				return;
			}
			void run(create, "Couldn't create the channel");
		};

		const submitAudience = () => {
			if (saving()) return;
			void run(create, "Couldn't create the channel");
		};

		const save = () => {
			setAttempted(true);
			const view = channel();
			if (saving() || !view || !trimmedName() || !dirty()) return;
			void run(async () => {
				const updated = await data.channels.update({
					channel: view.space,
					...changes(),
				});
				seedFrom(updated);
				toast.success("Channel settings saved");
			}, "Couldn't save the channel settings");
		};

		const unsaved = creating
			? undefined
			: createUnsavedForm({
					depth,
					dirty: () => canEdit() && !deleting() && dirty(),
					saving,
					save,
					reset: () => {
						const view = channel();
						if (view) seedFrom(view);
					},
				});

		const matches = () => {
			const view = channel();
			return !!view && confirmation() === view.name;
		};

		const remove = async () => {
			const view = channel();
			if (!view || !matches() || deleting()) return;
			setDeleting(true);
			try {
				await data.channels.remove(view);
				setDeleteOpen(false);
				toast.success(`Deleted #${view.name}`);
				leave();
			} catch {
				setDeleting(false);
				toast.error("Couldn't delete the channel");
			}
		};

		const hasSelection = () => isRestricted(visible());

		return {
			...admin,
			creating,
			step,
			channel,
			categories,
			categoryName,
			loading,
			unavailable,
			allowed,
			canEdit,
			canDelete,
			isOwner,
			developerMode,
			kind,
			setKind,
			name,
			setName,
			description,
			setDescription,
			category,
			setCategory,
			restricted,
			setRestricted,
			ownerOnly,
			setOwnerOnly,
			linkPreviews,
			setLinkPreviews,
			spaceLinkPreviews: () => community()?.linkEmbeds !== false,
			audience,
			setAudience,
			visible,
			setVisible,
			hasSelection,
			options,
			openPermissions: () =>
				openPermissions(stack, "channel", args.space, args.id ?? ""),
			categoryOpen,
			setCategoryOpen,
			saving,
			dirty,
			nameError,
			submitDetails,
			submitAudience,
			save,
			unsaved,
			back: () => stack.pop(),
			deleteOpen,
			setDeleteOpen,
			confirmation,
			setConfirmation,
			matches,
			deleting,
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
							navigateLabel="Close channel settings"
							onNavigate={m.back}
							title="Channel settings"
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
							m.step() === 2 ? "Add members and roles" : "Create new channel"
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
								? "You can't create channels here"
								: "You can't manage this channel"
						}
						description="Only members with permission to manage channels can do this."
					/>
				}
			>
				<StatusScreen
					tone="neutral"
					icon={<ChatSquareDotsIcon />}
					title={
						m.community()
							? "This channel doesn't exist anymore"
							: "This Space isn't available"
					}
					description={
						m.community()
							? "It may have been deleted, or you no longer have access to it."
							: "It may have been deleted, or you're no longer a member."
					}
				/>
			</Show>
		)),
		Details: slot((m) => (
			<div data-channel-create="" class="flex flex-col gap-6">
				<TextField
					label="Channel name"
					placeholder="New channel"
					value={m.name()}
					onChange={m.setName}
					maxLength={CHANNEL_NAME_MAX}
					error={m.nameError()}
					disabled={m.saving()}
					autocomplete="off"
				/>
				<RadioRowGroup
					aria-label="Channel type"
					value={m.kind()}
					onChange={(value) => m.setKind(value as ChannelKind)}
					disabled={m.saving()}
				>
					<RadioRow
						value="text"
						icon={<ChatSquareDotsIcon />}
						title="Text"
						description="Normal group chat conversations, images, and bird facts."
					/>
					<RadioRow
						value="voice"
						icon={<VolumeLoudIcon />}
						title="Voice"
						description="Hang out together with voice, video, and screen share."
					/>
				</RadioRowGroup>
				<ListGroup>
					<ToggleRow
						title="Make channel private?"
						description="Private channels can only be seen by certain members and roles."
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
				selectedRoles={m.visible().roles}
				selectedMembers={m.visible().members}
				onRolesChange={(roles) => m.setVisible({ ...m.visible(), roles })}
				onMembersChange={(members) => m.setVisible({ ...m.visible(), members })}
				canSelectRole={m.options.canSelectRole}
				canSelectMember={m.options.canSelectMember}
			/>
		)),
		General: slot((m) => (
			<div class="flex flex-col gap-6">
				<TextField
					label="Channel name"
					value={m.name()}
					onChange={m.setName}
					maxLength={CHANNEL_NAME_MAX}
					error={m.nameError()}
					disabled={m.saving() || !m.canEdit()}
					autocomplete="off"
				/>
				<TextArea
					label="Channel description"
					placeholder="What's this channel about?"
					rows={4}
					maxLength={CHANNEL_DESCRIPTION_MAX}
					value={m.description()}
					onChange={m.setDescription}
					disabled={m.saving() || !m.canEdit()}
				/>
			</div>
		)),
		LinkPreviews: slot((m) => (
			<RadioRowGroup
				label="Link previews"
				value={m.linkPreviews()}
				onChange={(value) => m.setLinkPreviews(value as LinkPreviewChoice)}
				disabled={m.saving() || !m.canEdit()}
			>
				<RadioRow
					value="space"
					title="Follow the Space"
					description={
						m.spaceLinkPreviews()
							? "Use the Space setting. Previews are on there right now."
							: "Use the Space setting. Previews are off there right now."
					}
				/>
				<RadioRow
					value="on"
					title="Show previews"
					description="Messages here show a preview card for the links they contain."
				/>
				<RadioRow
					value="off"
					title="Hide previews"
					description="Messages here never show a preview card for links."
				/>
			</RadioRowGroup>
		)),
		Options: slot((m, p: { platform?: Platform }) => (
			<Show
				when={p.platform !== "desktop"}
				fallback={
					<Show when={m.categories().length > 0}>
						<Select
							platform="desktop"
							label="Category"
							options={m.categories().map((entry) => ({
								value: entry.rkey,
								label: entry.name,
							}))}
							value={m.category() || undefined}
							placeholder="No category"
							onChange={m.setCategory}
							disabled={m.saving() || !m.canEdit()}
						/>
					</Show>
				}
			>
				<ListGroup>
					<NavRow
						icon={<FolderWithFilesIcon />}
						label="Category"
						value={m.categoryName()}
						disabled={m.saving() || !m.canEdit() || m.categories().length === 0}
						onClick={() => m.setCategoryOpen(true)}
					/>
					<NavRow
						icon={<ShieldUserIcon />}
						label="Channel permissions"
						disabled={m.saving() || !m.canEdit()}
						onClick={m.openPermissions}
					/>
				</ListGroup>
			</Show>
		)),
		Developer: slot((m) => (
			<AdminDeveloper
				target={(() => {
					const view = m.channel();
					return m.developerMode() && view
						? { copyValue: view.space }
						: undefined;
				})()}
			/>
		)),
		Delete: slot((m) => (
			<Show when={m.canDelete()}>
				<Button
					variant="destructive"
					block
					onClick={() => {
						m.setConfirmation("");
						m.setDeleteOpen(true);
					}}
				>
					Delete channel
				</Button>
				<Modal open={m.deleteOpen()} onOpenChange={m.setDeleteOpen}>
					<ModalContent
						title={`Delete #${m.channel()?.name ?? ""}?`}
						description="Type the channel's name to confirm. Messages members wrote here stay in their own repos, but nobody except their authors can read them afterward. This can't be undone."
						footer={
							<>
								<Button
									variant="secondary"
									onClick={() => m.setDeleteOpen(false)}
								>
									Cancel
								</Button>
								<Button
									variant="destructive"
									disabled={!m.matches()}
									loading={m.deleting()}
									onClick={() => void m.remove()}
								>
									Delete channel
								</Button>
							</>
						}
					>
						<TextField
							label="Channel name"
							value={m.confirmation()}
							onChange={m.setConfirmation}
							placeholder={m.channel()?.name}
							maxLength={CHANNEL_NAME_MAX}
							disabled={m.deleting()}
							autocomplete="off"
						/>
					</ModalContent>
				</Modal>
			</Show>
		)),
		Sheets: slot((m) => (
			<>
				<Drawer open={m.categoryOpen()} onOpenChange={m.setCategoryOpen}>
					<DrawerContent title="Category">
						<RadioRowGroup
							aria-label="Category"
							value={m.category()}
							onChange={(value) => {
								m.setCategory(value);
								m.setCategoryOpen(false);
							}}
						>
							<For each={m.categories()}>
								{(entry) => <RadioRow value={entry.rkey} title={entry.name} />}
							</For>
						</RadioRowGroup>
					</DrawerContent>
				</Drawer>
			</>
		)),
	},
});
