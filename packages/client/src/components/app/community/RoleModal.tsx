import { TwitterPicker } from "solid-color";
import {
	createSignal,
	For,
	Switch as LogicSwitch,
	Match,
	onCleanup,
	type ParentComponent,
} from "solid-js";
import { toast } from "somoto";
import { PERMISSIONS } from "../../../atproto/permissions";
import { useCommunityContext } from "../../../contexts/Community";
import { useUserContext } from "../../../contexts/User";
import { Button } from "../../ui/Button";
import {
	Checkbox,
	CheckboxControl,
	CheckboxDescription,
	CheckboxInput,
	CheckboxLabel,
} from "../../ui/Checkbox";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogPortal,
	DialogTitle,
	DialogTrigger,
} from "../../ui/Dialog";
import { Separator } from "../../ui/Separator";
import {
	Switch,
	SwitchControl,
	SwitchDescription,
	SwitchInput,
	SwitchLabel,
	SwitchThumb,
} from "../../ui/Switch";
import {
	Tabs,
	TabsContent,
	TabsIndicator,
	TabsList,
	TabsTrigger,
} from "../../ui/Tabs";
import { TextField, TextFieldInput, TextFieldLabel } from "../../ui/TextField";

export const RoleModal: ParentComponent<{
	/** URI of the role to pre-fill. */
	role?: string;
}> = (props) => {
	const user = useUserContext();
	const community = useCommunityContext();
	const [open, setOpen] = createSignal(false);
	const [loading, setLoading] = createSignal(false);

	const existingRole = () => {
		if (!props.role) return undefined;

		return community().assignableRoles.find((x) => x.uri === props.role);
	};

	const [name, setName] = createSignal(existingRole()?.name ?? "New Role");
	const [color, setColor] = createSignal(existingRole()?.color ?? "#ffffff");
	const [hoisted, setHoisted] = createSignal(existingRole()?.hoisted ?? false);
	const [mentionable, setMentionable] = createSignal(
		existingRole()?.mentionable ?? false,
	);
	const [permissions, setPermissions] = createSignal(
		existingRole()?.permissions ?? [],
	);

	const isInPermsSet = (nsid: string) => permissions().some((x) => x === nsid);

	const contrastingColor = () => {
		const c = color();
		const r = parseInt(c.slice(1, 3), 16);
		const g = parseInt(c.slice(3, 5), 16);
		const b = parseInt(c.slice(5, 7), 16);

		// Perceived luminance formula (WCAG)
		const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

		return luminance > 0.5 ? "#000000" : "#ffffff";
	};

	const isDirty = () => {
		const existing = existingRole();
		// Creating a new role: nothing to diff against, so it's always actionable.
		if (!existing) return true;

		if (name() !== existing.name) return true;
		if (color() !== (existing.color ?? "#ffffff")) return true;
		if (hoisted() !== (existing.hoisted ?? false)) return true;
		if (mentionable() !== (existing.mentionable ?? false)) return true;

		// Permissions are an unordered set; compare by membership, not position.
		const current = permissions();
		const existingPerms = existing.permissions ?? [];
		if (current.length !== existingPerms.length) return true;
		const existingSet = new Set(existingPerms);
		return current.some((p) => !existingSet.has(p));
	};

	const handleUpdate = async () => {
		if (!props.role) return;

		setLoading(true);

		try {
			await user.xrpc.social.colibri.role.update(
				props.role,
				name(),
				color(),
				permissions(),
				existingRole()!.position,
				hoisted(),
				mentionable(),
			);
		} catch {
			toast.error("Failed to update role.");
		} finally {
			setLoading(false);
		}
	};

	const handleCreate = async () => {
		setLoading(true);
		try {
			await user.xrpc.social.colibri.role.create(
				community().community.uri,
				name(),
				0,
				permissions(),
				color(),
				hoisted(),
				mentionable(),
			);

			setOpen(false);
		} catch {
			toast.error("Failed to create role.");
		} finally {
			setLoading(false);
		}
	};

	const presetColors = [
		"#ef4444",
		"#f59e0b",
		"#84cc16",
		"#10b981",
		"#06b6d4",
		"#6366f1",
		"#ffffff",
	];

	onCleanup(() => {
		setLoading(false);
		setHoisted(false);
		setMentionable(false);
		setName(existingRole()?.name || "New Role");
		setColor(existingRole()?.color || "#ffffff");
		setPermissions(existingRole()?.permissions || []);
	});

	return (
		<Dialog open={open()} onOpenChange={setOpen}>
			<DialogTrigger>{props.children}</DialogTrigger>
			<DialogPortal>
				<DialogContent class="h-6/12 overflow-auto">
					<DialogHeader>
						<DialogTitle>
							{props.role ? "Edit" : "Create"} Role — {name()}
						</DialogTitle>
					</DialogHeader>
					<Tabs defaultValue="display">
						<TabsList>
							<TabsTrigger value="display">Display</TabsTrigger>
							<TabsTrigger value="permissions">Permissions</TabsTrigger>
							<TabsIndicator />
						</TabsList>
						<TabsContent value="display" class="min-h-[calc(50vh-174px)]">
							<TextField class="gap-1.5">
								<TextFieldLabel>Name</TextFieldLabel>
								<TextFieldInput
									placeholder="New Role"
									value={name()}
									onInput={(e) => setName(e.currentTarget.value)}
								/>
							</TextField>
							<div
								style={{
									"--color": color(),
									"--contrast": contrastingColor(),
								}}
								class="w-full"
							>
								<span class="text-sm font-medium select-none ">Color</span>
								<TwitterPicker
									colors={presetColors}
									triangle="hide"
									width={"100%"}
									className={`bg-transparent! [&>div]:p-0! [&_input]:shadow-none! [&_input]:w-max! [&_input]:text-foreground! [&_input]:border! [&_input]:border-(--color)! [&_div_div]:nth-8:bg-(--color)! [&_div_div]:nth-8:text-(--contrast)!`}
									color={color()}
									onChange={(e) => {
										setColor(e.hex);
									}}
								/>
							</div>
							<Switch
								class="flex flex-row gap-4 items-center w-full justify-between"
								checked={hoisted()}
								onChange={setHoisted}
							>
								<div>
									<SwitchLabel>Display separately</SwitchLabel>
									<SwitchDescription>
										Controls whether the role is shown as its own group in the
										member sidebar.
									</SwitchDescription>
								</div>
								<div>
									<SwitchInput />
									<SwitchControl>
										<SwitchThumb />
									</SwitchControl>
								</div>
							</Switch>
							<Switch
								class="flex flex-row gap-4 items-center w-full justify-between"
								checked={mentionable()}
								onChange={setMentionable}
							>
								<div>
									<SwitchLabel>Mentionable</SwitchLabel>
									<SwitchDescription>
										Controls whether this role can be mentioned by members.
									</SwitchDescription>
								</div>
								<div>
									<SwitchInput />
									<SwitchControl>
										<SwitchThumb />
									</SwitchControl>
								</div>
							</Switch>
						</TabsContent>
						<TabsContent value="permissions" class="min-h-[calc(50vh-174px)]">
							<For each={Object.entries(PERMISSIONS)}>
								{([key, value]) => (
									<div>
										<h3 class="text-base my-4 leading-none font-semibold">
											{key}
										</h3>
										<For each={value}>
											{(permission) => (
												<>
													<Checkbox
														class="flex flex-row gap-4 items-center w-full justify-between"
														checked={isInPermsSet(permission.key)}
														onChange={(checked) => {
															if (checked) {
																setPermissions((current) => [
																	...current,
																	permission.key,
																]);
															} else {
																setPermissions((current) =>
																	current.filter((x) => x !== permission.key),
																);
															}
														}}
													>
														<div>
															<CheckboxLabel>{permission.name}</CheckboxLabel>
															<CheckboxDescription>
																{permission.description}
															</CheckboxDescription>
														</div>
														<div>
															<CheckboxControl />
															<CheckboxInput />
														</div>
													</Checkbox>
													<Separator class="my-1" />
												</>
											)}
										</For>
									</div>
								)}
							</For>
						</TabsContent>
					</Tabs>
					<DialogFooter>
						<Button variant="secondary" onClick={() => setOpen(false)}>
							Cancel
						</Button>
						<LogicSwitch>
							<Match when={!props.role}>
								<Button
									onClick={handleCreate}
									disabled={loading() || !isDirty()}
								>
									Create
								</Button>
							</Match>
							<Match when={props.role}>
								<Button
									onClick={handleUpdate}
									disabled={loading() || !isDirty()}
								>
									Update
								</Button>
							</Match>
						</LogicSwitch>
					</DialogFooter>
				</DialogContent>
			</DialogPortal>
		</Dialog>
	);
};
