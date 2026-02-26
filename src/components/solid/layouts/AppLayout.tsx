import { actions } from "astro:actions";
import type { Details } from "@kobalte/core/file-field";
import { A, type Navigator, useNavigate } from "@solidjs/router";
import {
	type Accessor,
	createSignal,
	For,
	Match,
	type ParentComponent,
	type Setter,
	Switch,
} from "solid-js";
import { useGlobalContext } from "../contexts/GlobalContext";
import { Gear } from "../icons/Gear";
import { House } from "../icons/House";
import { Image } from "../icons/Image";
import { Plus } from "../icons/Plus";
import { Spinner } from "../icons/Spinner";
import { Button } from "../shadcn-solid/Button";
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
import {
	TextField,
	TextFieldDescription,
	TextFieldInput,
	TextFieldLabel,
} from "../shadcn-solid/text-field";

const NewCommunityModal: ParentComponent<{
	navigate: Navigator;
}> = (props) => {
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
						<Button
							variant="secondary"
							disabled={loading()}
							onClick={() => setOpen(false)}
						>
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

const AppLayout: ParentComponent = (props) => {
	const [globalState] = useGlobalContext();
	const navigate = useNavigate();

	if (
		window.location.pathname === "/app" &&
		globalState.communities.length > 0
	) {
		navigate(`/c/${globalState.communities[0].rkey}`);
	}

	// params.community is the currently selected community's record id

	return (
		<div class="flex flex-col w-screen h-screen bg-card">
			<div class="flex w-full h-10 pl-2 items-center gap-2">
				<img src="/logo.png" width={32} height={32} alt="Colibri Social logo" />
				<span class="font-black text-lg bg-clip-text text-transparent bg-[linear-gradient(69deg,#090615_-145.97%,#31226D_-87.27%,#6C5AA6_-26.22%,#AE99CB_30.13%,#E0DEEC_75.92%)]">
					colibri.social
				</span>
			</div>
			<div class="flex h-full w-full">
				<aside class="flex flex-col h-full w-14 p-2 pb-3">
					<nav class="w-full h-full flex flex-col gap-2">
						<div class="w-full h-full flex flex-col gap-2">
							<div class="w-10 flex h-10 rounded-md bg-muted items-center justify-center cursor-pointer">
								<House />
							</div>
							<hr class="m-0 border-muted" />
							<For each={globalState.communities}>
								{(item) => {
									return (
										<A
											href={`/c/${item.rkey}`}
											class="w-10 h-10 rounded-md bg-muted flex items-center justify-center"
											activeClass="outline outline-foreground outline-2 -outline-offset-2"
										>
											<Switch>
												<Match when={item.image}>
													<img
														src={item.image}
														alt={item.name}
														class="w-10 h-10 rounded-md object-cover"
													/>
												</Match>
												<Match when={!item.image}>
													<span class="font-bold">
														{/*TODO: Server images*/}
														{item.name
															.split(" ")
															.map((x) => x.substring(0, 1))
															.join("")
															.substring(0, 3)}
													</span>
												</Match>
											</Switch>
										</A>
									);
								}}
							</For>
							<NewCommunityModal navigate={navigate}>
								<button
									type="button"
									class="w-10 flex h-10 rounded-md bg-muted items-center justify-center cursor-pointer"
								>
									<Plus />
								</button>
							</NewCommunityModal>
						</div>
					</nav>
					<div class="w-10 flex h-10 rounded-md bg-muted items-center justify-center cursor-pointer">
						<div class="block w-fit h-fit">
							<Gear />
						</div>
					</div>
				</aside>
				<main class="w-full h-full">{props.children}</main>
			</div>
		</div>
	);
};

export default AppLayout;
