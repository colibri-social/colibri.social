import {
	type Accessor,
	type Component,
	createEffect,
	createSignal,
	on,
	type Setter,
} from "solid-js";
import BugIcon from "~icons/ph/bug";
import WarningDiamondIcon from "~icons/ph/warning-diamond";
import WrenchIcon from "~icons/ph/wrench";
import { colibri } from "../../../atproto/lexicons";
import type { CategoryView } from "../../../atproto/views";
import { clientForManagingApp } from "../../../atproto/xrpc";
import {
	useCommunityContext,
	usePermissions,
} from "../../../contexts/Community";
import { useUserContext } from "../../../contexts/User";
import { showError } from "../../../errors/show-error";
import { Spinner } from "../../icons/Spinner";
import { Button } from "../../ui/Button";
import { TextField, TextFieldInput, TextFieldLabel } from "../../ui/TextField";
import { SettingsInfoPage } from "../common/SettingsInfoPage";
import { SettingsModal, SettingsPage } from "../common/SettingsModal";

const GeneralCategorySettings: Component<{ category: CategoryView }> = (
	props,
) => {
	const user = useUserContext();
	const community = useCommunityContext();

	const initialName = () => props.category.name;

	const [loading, setLoading] = createSignal(false);
	const [name, setName] = createSignal(initialName());

	createEffect(on(initialName, (n) => setName(n), { defer: true }));

	const handleSave = async () => {
		const trimmed = name().trim();
		if (trimmed.length === 0) return;
		setLoading(true);
		const client = clientForManagingApp(
			user.atproto.agent,
			community().community.managingApp,
		);
		const res = await client.call(colibri.category.update.main, {
			body: {
				community: community().community.did,
				category: props.category.rkey,
				name: trimmed,
			},
		});
		setLoading(false);
		if (!res.ok) {
			showError(res.error, { fallbackTitle: "Failed to save category." });
			return;
		}
		community().utils.patchCategory(props.category.rkey, { name: trimmed });
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
	category: CategoryView;
}> = (props) => {
	const user = useUserContext();
	const community = useCommunityContext();

	const [loading, setLoading] = createSignal<boolean>(false);
	const [categoryNameReset, setCategoryNameReset] = createSignal("");

	const isValid = () => categoryNameReset() === props.category.name;

	const deleteCategory = async () => {
		setLoading(true);
		const client = clientForManagingApp(
			user.atproto.agent,
			community().community.managingApp,
		);
		const res = await client.call(colibri.category.delete.main, {
			body: {
				community: community().community.did,
				category: props.category.rkey,
			},
		});
		setLoading(false);
		if (!res.ok) {
			showError(res.error, { fallbackTitle: "Failed to delete category." });
			return;
		}
		props.setOpen(false);
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
	category: CategoryView;
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
					component: () => (
						<GeneralCategorySettings category={props.category} />
					),
					icon: () => <WrenchIcon />,
					visible: canUpdateCategory,
				},
			]}
			dangerPages={[
				{
					title: "Danger Zone",
					id: "danger",
					component: () => (
						<DangerSettingsPage
							setOpen={props.setOpen}
							category={props.category}
						/>
					),
					icon: () => <WarningDiamondIcon />,
					visible: canDeleteCategory,
				},
			]}
			debugPage={{
				title: "Debug Information",
				id: "info",
				component: () => <SettingsInfoPage uri={props.category.rkey} />,
				icon: () => <BugIcon />,
			}}
		/>
	);
};
