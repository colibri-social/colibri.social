import {
	type Accessor,
	type Component,
	createEffect,
	createSignal,
	on,
	type Setter,
} from "solid-js";
import { toast } from "somoto";
import BugIcon from "~icons/ph/bug";
import WarningDiamondIcon from "~icons/ph/warning-diamond";
import WrenchIcon from "~icons/ph/wrench";
import type { Category } from "../../../atproto/xrpc/social/colibri/community/listCategories";
import {
	useCommunityContext,
	usePermissions,
} from "../../../contexts/Community";
import { useUserContext } from "../../../contexts/User";
import { Spinner } from "../../icons/Spinner";
import { Button } from "../../ui/Button";
import { TextField, TextFieldInput, TextFieldLabel } from "../../ui/TextField";
import { SettingsInfoPage } from "../common/SettingsInfoPage";
import { SettingsModal, SettingsPage } from "../common/SettingsModal";

const GeneralCategorySettings: Component<{ category: Category }> = (props) => {
	const user = useUserContext();
	const community = useCommunityContext();

	const initialName = () => props.category.name;

	const [loading, setLoading] = createSignal(false);
	const [name, setName] = createSignal(initialName());

	// Re-sync when the record changes underneath us — our own optimistic patch,
	// the `category_event` echo, or another moderator's edit. See the matching
	// note in ChannelSettingsModal.
	createEffect(on(initialName, (n) => setName(n), { defer: true }));

	const handleSave = async () => {
		const trimmed = name().trim();
		if (trimmed.length === 0) return;
		setLoading(true);
		try {
			const res = await user.xrpc.social.colibri.category.update(
				props.category.uri,
				trimmed,
			);
			if (!res) {
				toast.error("Failed to save category.");
				return;
			}
			// Optimistically reflect the save so the form leaves its dirty state
			// immediately; the `category_event` echo re-applies the same name.
			community().utils.patchCategory(props.category.uri, { name: trimmed });
		} catch {
			toast.error("Failed to save category.");
		} finally {
			setLoading(false);
		}
	};

	const isDirty = () => {
		return name() !== initialName();
	};

	const handleReset = () => {
		setLoading(false);
		setName(initialName());
	};

	return (
		<SettingsPage
			loading={loading}
			canReset={isDirty()}
			title="Category Settings"
			onSave={handleSave}
			onReset={handleReset}
		>
			<TextField class="gap-1.5">
				<TextFieldLabel>Name</TextFieldLabel>
				<TextFieldInput
					value={name()}
					maxLength={32}
					min={1}
					required
					onInput={(e) => setName(e.currentTarget.value)}
				/>
			</TextField>
		</SettingsPage>
	);
};

const DangerSettingsPage: Component<{
	setOpen: Setter<boolean>;
	category: Category;
}> = (props) => {
	const user = useUserContext();

	const [loading, setLoading] = createSignal<boolean>(false);
	const [categoryNameReset, setCategoryNameReset] = createSignal("");

	const isValid = () => categoryNameReset() === props.category.name;

	const deleteCategory = async () => {
		setLoading(true);
		try {
			await user.xrpc.social.colibri.category.delete(props.category.uri);
			props.setOpen(false);
		} catch {
			toast.error("Failed to delete category.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<SettingsPage loading={loading} title="Danger Zone">
			<h3 class="m-0 font-semibold">Delete this Category?</h3>
			<p class="m-0">
				To delete this category, first type in the name of the category below.{" "}
				<strong>This action cannot be undone.</strong> Channels inside it are
				not deleted.
			</p>
			<div class="flex flex-row gap-2 items-baseline-last">
				<TextField
					value={categoryNameReset()}
					onChange={setCategoryNameReset}
					validationState={isValid() ? "valid" : "invalid"}
					disabled={loading()}
				>
					<TextFieldInput
						placeholder={props.category.name}
						maxLength={32}
						minLength={1}
						type="text"
						required
					/>
				</TextField>
				<Button
					variant="destructive"
					disabled={loading() || !isValid()}
					onClick={deleteCategory}
				>
					<Spinner
						classList={{
							hidden: !loading(),
							block: loading(),
						}}
					/>
					Delete Category
				</Button>
			</div>
		</SettingsPage>
	);
};

export const CategorySettingsModal: Component<{
	category: Category;
	open: Accessor<boolean>;
	setOpen: Setter<boolean>;
}> = (props) => {
	const user = useUserContext();
	const {
		canUpdateCategory: _canUpdateCategory,
		canDeleteCategory: _canDeleteCategory,
	} = usePermissions();

	const canUpdateCategory = () => _canUpdateCategory(user.did);
	const canDeleteCategory = () => _canDeleteCategory(user.did);

	return (
		<SettingsModal
			open={props.open}
			setOpen={props.setOpen}
			pages={[
				{
					title: "General",
					id: "general",
					component: () => <GeneralCategorySettings category={props.category} />,
					icon: () => <WrenchIcon />,
					visible: canUpdateCategory,
				},
			]}
			dangerPage={{
				title: "Danger Zone",
				id: "danger",
				component: () => (
					<DangerSettingsPage setOpen={props.setOpen} category={props.category} />
				),
				icon: () => <WarningDiamondIcon />,
				visible: canDeleteCategory,
			}}
			debugPage={{
				title: "Debug Information",
				id: "info",
				component: () => <SettingsInfoPage uri={props.category.uri} />,
				icon: () => <BugIcon />,
			}}
		/>
	);
};
