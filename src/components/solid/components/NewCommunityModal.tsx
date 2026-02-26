import { createSignal, Switch, type ParentComponent } from "solid-js";
import { useGlobalContext } from "../contexts/GlobalContext";
import type { Navigator } from "@solidjs/router";
import type { Details } from "@kobalte/core/file-field";
import { actions } from "astro:actions";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogPortal,
	DialogTrigger,
} from "../shadcn-solid/Dialog";
import {
	FileField,
	FileFieldDropzone,
	FileFieldHiddenInput,
	FileFieldItem,
	FileFieldItemList,
	FileFieldItemPreviewImage,
	FileFieldTrigger,
} from "../shadcn-solid/file-field";
import { Match } from "solid-js";
import { Image } from "../icons/Image";
import {
	TextField,
	TextFieldDescription,
	TextFieldInput,
	TextFieldLabel,
} from "../shadcn-solid/text-field";
import { Button } from "../shadcn-solid/Button";
import { Spinner } from "../icons/Spinner";

export const NewCommunityModal: ParentComponent<{ navigate: Navigator }> = (
	props,
) => {
	const [, globalContext] = useGlobalContext();
	const [name, setName] = createSignal<string>("");
	const [image, setImage] = createSignal<Details>();
	const [loading, setLoading] = createSignal<boolean>(false);
	const [open, setOpen] = createSignal(false);

	const createCommunity = async () => {
		setLoading(true);

		let base64Image: string | undefined;

		if (image()) {
			base64Image = await new Promise<string>((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => resolve(reader.result as string);
				reader.onerror = reject;
				reader.readAsDataURL(image()!.acceptedFiles[0]);
			});
		}

		const mimeType = image()!.acceptedFiles[0].type;

		const { data, error } = await actions.createCommunity({
			name: name(),
			image: base64Image
				? {
						base64: base64Image,
						type: mimeType,
					}
				: undefined,
		});

		if (error) {
			setLoading(false);
			alert(error.message);
			return;
		}

		globalContext.addCommunity({
			rkey: data.community,
			name: name(),
			image: base64Image,
			description: "",
			categoryOrder: [],
		});

		setLoading(false);
		setOpen(false);
		props.navigate(`/c/${data.community}`);
	};

	return (
		<Dialog open={open()} onOpenChange={setOpen}>
			<DialogTrigger>{props.children}</DialogTrigger>
			<DialogPortal>
				<DialogContent class="w-92">
					<DialogHeader>
						<h2 class="m-0 text-center">Create a community</h2>
					</DialogHeader>
					<div class="flex flex-col items-center justify-center w-full gap-4">
						<FileField onFileChange={setImage} maxFiles={1}>
							<FileFieldDropzone class="w-20 h-20 min-h-0 rounded-full overflow-hidden">
								<FileFieldTrigger class="h-20 w-20 bg-muted/25 hover:bg-muted/50">
									<Switch>
										<Match when={image() === undefined}>
											<div class="flex flex-col items-center justify-center gap-1">
												<Image className="w-6! h-6!" />
												<span>Upload</span>
											</div>
										</Match>
										<Match when={image() !== undefined}>
											<FileFieldItemList class="w-20 h-20 m-0 p-0 relative">
												{() => (
													<FileFieldItem class="w-20 h-20 m-0 p-0 border-none [&>div]:w-20">
														<FileFieldItemPreviewImage class="w-20 h-20 object-cover" />
													</FileFieldItem>
												)}
											</FileFieldItemList>
										</Match>
									</Switch>
								</FileFieldTrigger>
							</FileFieldDropzone>
							<FileFieldHiddenInput />
						</FileField>
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
							<TextFieldLabel>
								Community Name <span class="text-destructive">*</span>
							</TextFieldLabel>
							<TextFieldInput
								maxLength={32}
								minLength={1}
								type="text"
								required
							/>
							<TextFieldDescription>
								Must be between one and 32 characters long.
							</TextFieldDescription>
						</TextField>
					</div>
					<DialogFooter>
						<Button variant="secondary" disabled={loading()}>
							Cancel
						</Button>
						<Button disabled={loading()} onClick={createCommunity}>
							<Spinner
								classList={{
									hidden: !loading(),
									block: loading(),
								}}
							/>
							Create
						</Button>
					</DialogFooter>
				</DialogContent>
			</DialogPortal>
		</Dialog>
	);
};
