import {
	createEffect,
	createSignal,
	For,
	Match,
	Show,
	Switch,
	type Accessor,
	type Component,
	type ParentComponent,
	type Setter,
} from "solid-js";
import {
	Dialog,
	DialogCloseButton,
	DialogContent,
	DialogPortal,
	DialogTrigger,
} from "../../shadcn-solid/Dialog";
import { X } from "../../icons/X";
import {
	TextField,
	TextFieldInput,
	TextFieldLabel,
} from "../../shadcn-solid/text-field";
import { useGlobalContext } from "../../contexts/GlobalContext";
import { useParams } from "@solidjs/router";
import {
	FileField,
	FileFieldDropzone,
	FileFieldHiddenInput,
	FileFieldItem,
	FileFieldItemList,
	FileFieldItemPreviewImage,
	FileFieldLabel,
	FileFieldTrigger,
} from "../../shadcn-solid/file-field";
import type { Details } from "@kobalte/core/file-field";
import { Image } from "../../icons/Image";
import { XCircle } from "../../icons/XCircle";
import { Button } from "../../shadcn-solid/Button";
import { Spinner } from "../../icons/Spinner";
import { actions } from "astro:actions";

const SettingsPage: ParentComponent<{
	loading: Accessor<boolean>;
	title: string;
	onSave: () => void;
	canReset: boolean;
	onReset: () => void;
}> = (props) => {
	return (
		<div class="w-full flex flex-col justify-between gap-4 h-128">
			<div class=" flex flex-col gap-4 py-4">
				<h2 class="m-0 px-4">{props.title}</h2>
				<div class="w-full h-full flex flex-col gap-4 px-4">
					{props.children}
				</div>
			</div>
			<div class="w-full border-t border-border p-4 flex flex-row items-center justify-end gap-2">
				<Show when={props.canReset}>
					<Button
						variant="secondary"
						onClick={props.onReset}
						disabled={props.loading()}
					>
						Reset
					</Button>
				</Show>
				<Button
					onClick={props.onSave}
					disabled={props.loading() || !props.canReset}
				>
					<Spinner
						classList={{
							hidden: !props.loading(),
							block: props.loading(),
						}}
					/>
					Save
				</Button>
			</div>
		</div>
	);
};

const GeneralSettingsPage: Component = () => {
	const [globalData] = useGlobalContext();
	const params = useParams();

	const community = () =>
		globalData.communities.find((x) => x.rkey === params.community)!;

	const [loading, setLoading] = createSignal<boolean>(false);
	const [name, setName] = createSignal(community().name);
	const [description, setDescription] = createSignal(community().description);
	const [image, setImage] = createSignal<Details>();
	const [imageRemoved, setImageRemoved] = createSignal(false);

	const existingImageUrl = () =>
		!imageRemoved() && image() === undefined
			? (community().picture ?? null)
			: null;

	const hasEdited = (): boolean =>
		name() !== community().name ||
		description() !== community().description ||
		!!existingImageUrl();

	const clearNewFile = (e?: MouseEvent) => {
		e?.preventDefault();
		e?.stopPropagation();
		setImage(undefined);
	};

	const removeExistingImage = (e: MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setImageRemoved(true);
	};

	const editCommunityData = async () => {
		setLoading(true);
		// await actions.editCommunity();
	};

	const resetCommunityData = () => {
		setName(community().name);
		setDescription(community().description);
		clearNewFile();
		setImageRemoved(false);
	};

	return (
		<SettingsPage
			loading={loading}
			canReset={hasEdited()}
			title="Community Profile"
			onSave={editCommunityData}
			onReset={resetCommunityData}
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
				<TextFieldLabel>Community Name</TextFieldLabel>
				<TextFieldInput maxLength={32} minLength={1} type="text" required />
			</TextField>
			<TextField
				value={description()}
				onChange={setDescription}
				validationState={
					description() !== undefined && description()!.trim().length < 257
						? "valid"
						: "invalid"
				}
			>
				<TextFieldLabel>Community Description</TextFieldLabel>
				<TextFieldInput maxLength={256} minLength={1} type="text" required />
			</TextField>
			<FileField class="items-start" onFileChange={setImage} maxFiles={1}>
				<FileFieldLabel>Community Image</FileFieldLabel>
				<FileFieldDropzone class="h-32 w-32 min-h-0">
					<FileFieldTrigger class="h-32 w-32 bg-muted/25 hover:bg-muted/50">
						<Switch>
							<Match when={image() !== undefined}>
								<div class="relative w-32 h-32">
									<FileFieldItemList class="w-32 h-32 m-0 p-0">
										{() => (
											<FileFieldItem class="w-32 h-32 m-0 p-0 border-none [&>div]:w-32">
												<FileFieldItemPreviewImage class="w-32 h-32 object-cover" />
											</FileFieldItem>
										)}
									</FileFieldItemList>
									<button
										type="button"
										class="absolute top-1 right-1 text-white drop-shadow cursor-pointer"
										onClick={clearNewFile}
										aria-label="Remove selected image"
									>
										<XCircle className="w-5! h-5!" />
									</button>
								</div>
							</Match>
							<Match when={existingImageUrl() !== null}>
								<div class="relative w-32 h-32">
									<img
										src={existingImageUrl()!}
										alt={community().name}
										class="w-32 h-32 object-cover"
									/>
									<button
										type="button"
										class="absolute top-1 right-1 text-white drop-shadow cursor-pointer"
										onClick={removeExistingImage}
										aria-label="Remove image"
									>
										<XCircle className="w-5! h-5!" />
									</button>
								</div>
							</Match>
							<Match when={true}>
								<div class="flex flex-col items-center justify-center gap-1">
									<Image className="w-6! h-6!" />
									<span>Upload</span>
								</div>
							</Match>
						</Switch>
					</FileFieldTrigger>
				</FileFieldDropzone>
				<FileFieldHiddenInput />
			</FileField>
		</SettingsPage>
	);
};

const DangerSettingsPage: Component = () => {
	const [loading, setLoading] = createSignal<boolean>(false);
	return (
		<SettingsPage
			loading={loading}
			title="Danger Zone"
			onSave={() => {}}
			canReset={false}
			onReset={() => {}}
		>
			Content
		</SettingsPage>
	);
};

type SettingsPage = "general" | "danger";

const SettingsPageSelector: ParentComponent<{
	onClick: Setter<SettingsPage>;
	danger?: boolean;
	activePage: boolean;
}> = (props) => {
	return (
		<button
			type="button"
			class="w-full hover:bg-muted/25 px-2 py-1 rounded-sm cursor-pointer text-left"
			classList={{
				"text-destructive hover:bg-destructive/15!": props.danger,
				"bg-muted/25": props.activePage && !props.danger,
				"bg-destructive/10!": props.activePage && props.danger,
			}}
			onClick={props.onClick}
		>
			{props.children}
		</button>
	);
};

export const CommunitySettingsModal: ParentComponent = (props) => {
	const [activePage, setActivePage] = createSignal<SettingsPage>("general");
	const [open, setOpen] = createSignal(false);

	createEffect(() => {
		if (open() === false) return;

		setActivePage("general");
	});

	const PAGES: Array<SettingsPage> = ["general"];
	const LABELS: Record<SettingsPage, string> = {
		general: "Community Profile",
		danger: "Danger Zone",
	};

	return (
		<Dialog open={open()} onOpenChange={setOpen}>
			<DialogTrigger>{props.children}</DialogTrigger>
			<DialogPortal>
				<DialogContent class="w-[75vw] min-w-92 h-fit min-h-128 max-w-192! p-0 flex flex-row gap-0">
					<div class="absolute top-4 right-4 flex items-center justify-center w-6 h-6 hover:bg-muted/50 cursor-pointer rounded-sm">
						<DialogCloseButton class="absolute cursor-pointer">
							<X />
						</DialogCloseButton>
					</div>
					<div class="h-full min-h-128 flex flex-col justify-between p-4 w-64 border-r border-border">
						<div class="h-full flex flex-col gap-1">
							<For each={PAGES}>
								{(item) => (
									<SettingsPageSelector
										activePage={activePage() === item}
										onClick={() => setActivePage(item)}
									>
										{LABELS[item]}
									</SettingsPageSelector>
								)}
							</For>
						</div>
						<SettingsPageSelector
							activePage={activePage() === "danger"}
							danger
							onClick={() => setActivePage("danger")}
						>
							{LABELS["danger"]}
						</SettingsPageSelector>
					</div>
					<Switch
						fallback={<div>No settings page for this category found.</div>}
					>
						<Match when={activePage() === "general"}>
							<GeneralSettingsPage />
						</Match>
						<Match when={activePage() === "danger"}>
							<DangerSettingsPage />
						</Match>
					</Switch>
				</DialogContent>
			</DialogPortal>
		</Dialog>
	);
};
