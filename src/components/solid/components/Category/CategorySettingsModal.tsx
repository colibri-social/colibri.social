import { actions } from "astro:actions";
import type { ParentComponent } from "solid-js";
import { type Component, createSignal } from "solid-js";
import { toast } from "somoto";
import { RECORD_IDs } from "@/utils/atproto/lexicons";
import { parseZodToErrorOrDisplay } from "@/utils/parse-zod-to-error-or-display";
import type { SidebarCategoryData } from "@/utils/sdk";
import { useGlobalContext } from "../../contexts/GlobalContext";
import { Spinner } from "../../icons/Spinner";
import { Button } from "../../shadcn-solid/Button";
import {
	TextField,
	TextFieldInput,
	TextFieldLabel,
} from "../../shadcn-solid/text-field";
import { SettingsInfoPage } from "../SettingsInfoPage";
import { SettingsModal, SettingsPage } from "../SettingsModal";

const GeneralSettingsPage: Component<{ category: SidebarCategoryData }> = (
	props,
) => {
	const [, { addCategory }] = useGlobalContext();

	const [loading, setLoading] = createSignal<boolean>(false);
	const [name, setName] = createSignal(props.category.name);

	const hasEdited = (): boolean => name() !== props.category.name;

	const editCategoryData = async () => {
		setLoading(true);

		const categoryData = await actions.editCategory({
			name: name(),
			rkey: props.category.rkey,
		});

		if (categoryData.error) {
			setLoading(false);
			toast.error("Failed to update category", {
				description: parseZodToErrorOrDisplay(categoryData.error.message),
			});
			return;
		}

		addCategory(categoryData.data!);
		setLoading(false);
	};

	const resetCategoryData = () => {
		setName(props.category.name);
	};

	return (
		<SettingsPage
			loading={loading}
			canReset={hasEdited()}
			title="General"
			onSave={editCategoryData}
			onReset={resetCategoryData}
		>
			<TextField
				value={name()}
				onChange={setName}
				validationState={
					name() !== undefined &&
					name()!.trim().length < 33 &&
					name()!.trim().length > 0
						? "valid"
						: "invalid"
				}
			>
				<TextFieldLabel>Category Name</TextFieldLabel>
				<TextFieldInput maxLength={32} minLength={1} type="text" required />
			</TextField>
		</SettingsPage>
	);
};

const DangerSettingsPage: Component<{ category: SidebarCategoryData }> = (
	props,
) => {
	const [, { removeCategory }] = useGlobalContext();

	const [loading, setLoading] = createSignal<boolean>(false);
	const [categoryNameReset, setCategoryNameReset] = createSignal("");

	const isValid = () => categoryNameReset() === props.category.name;

	const deleteCategory = async () => {
		setLoading(true);

		const deletedCategory = await actions.deleteCategory({
			rkey: props.category.rkey,
		});

		setLoading(false);

		if (deletedCategory.error) {
			toast.error("Failed to delete category", {
				description: parseZodToErrorOrDisplay(deletedCategory.error.message),
			});
			return;
		}

		removeCategory(props.category.rkey);
	};

	return (
		<SettingsPage loading={loading} title="Danger Zone">
			<h3 class="m-0 font-semibold">Delete this category</h3>
			<p class="m-0">
				To delete this category and all associated data, first type in the name
				of the category below. Channels within this category will also be
				deleted. <strong>This action cannot be undone.</strong>
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

export const CategorySettingsModal: ParentComponent<{
	category: SidebarCategoryData;
}> = (props) => {
	const did = props.category.uri.split("/")[2];

	return (
		<SettingsModal
			pages={[
				{
					title: "General",
					id: "general",
					component: () => <GeneralSettingsPage category={props.category} />,
				},
			]}
			dangerPage={{
				title: "Danger Zone",
				id: "danger",
				component: () => <DangerSettingsPage category={props.category} />,
			}}
			debugPage={{
				title: "Debug Information",
				id: "info",
				component: () => (
					<SettingsInfoPage
						did={did}
						collection={RECORD_IDs.CATEGORY}
						rkey={props.category.rkey}
					/>
				),
			}}
		>
			{props.children}
		</SettingsModal>
	);
};
