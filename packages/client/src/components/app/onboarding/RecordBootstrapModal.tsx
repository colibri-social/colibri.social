import {
	createSignal,
	type JSX,
	Match,
	Show,
	Switch as SwitchFlow,
} from "solid-js";
import { toast } from "somoto";
import { Spinner } from "../../icons/Spinner";
import { Button } from "../../ui/Button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogPortal,
} from "../../ui/Dialog";
import {
	RadioGroup,
	RadioGroupItem,
	RadioGroupItemInput,
	RadioGroupItemLabel,
	RadioGroupItems,
} from "../../ui/RadioGroup";
import {
	Switch,
	SwitchControl,
	SwitchDescription,
	SwitchInput,
	SwitchLabel,
	SwitchThumb,
} from "../../ui/Switch";

/**
 * The "base on an existing record (optionally kept in sync) vs. start from
 * scratch" onboarding flow, made reusable so it can drive the setup of any
 * Colibri lexicon — not just profiles. A consumer supplies a
 * {@link RecordBootstrapConfig}; this component owns the step machine, the
 * two-path choice with visual previews, the (optional) keep-in-sync toggle, and
 * the confirm/edit step.
 */
export interface RecordBootstrapImportSource<T> {
	/** Visual preview card shown for the "import" path. */
	card: JSX.Element;
	/** Radio option title. */
	label: string;
	/** Radio option description. */
	description: string;
	/** Loads the initial field values from the source (e.g. a Bluesky profile). */
	load: () => Promise<T>;
	/** Whether this source can be kept in sync (shows the toggle on confirm). */
	supportsSync: boolean;
	/** Whether the keep-in-sync toggle starts on when this path is chosen. */
	defaultSync?: boolean;
	syncLabel?: string;
	syncDescription?: string;
}

export interface RecordBootstrapScratch<T> {
	/** Visual preview card shown for the "from scratch" path. */
	card: JSX.Element;
	label: string;
	description: string;
	/** Empty/default field values. */
	initial: () => T;
}

export interface RecordBootstrapRenderProps<T> {
	value: T;
	/** Shallow-merges a patch into the field state. */
	setValue: (patch: Partial<T>) => void;
	/** Whether the keep-in-sync toggle is currently on. */
	syncing: boolean;
}

export interface RecordBootstrapConfig<T> {
	title: string;
	/** Omit to offer only the "from scratch" path. */
	importSource?: RecordBootstrapImportSource<T>;
	scratch: RecordBootstrapScratch<T>;
	/** Renders the confirm/edit step for the collected field values. */
	renderFields: (props: RecordBootstrapRenderProps<T>) => JSX.Element;
	/**
	 * Optional second edit step shown after the fields (e.g. theming). When
	 * present, the fields step advances to it instead of submitting directly.
	 */
	extraStep?: {
		render: (props: RecordBootstrapRenderProps<T>) => JSX.Element;
		/** Label for the button that advances from the fields step. */
		nextLabel?: string;
	};
	/** Persists the record. Receives the final values and the sync choice. */
	submit: (value: T, opts: { sync: boolean }) => Promise<void>;
	submitLabel?: string;
	/**
	 * Optional element rendered at the start (left) of every step's footer,
	 * separated from the primary actions. Useful for secondary actions like
	 * logging out of an undismissable onboarding flow.
	 */
	footerStart?: JSX.Element;
}

const IMPORT = "import";
const SCRATCH = "scratch";

type Step = "choice" | "loading" | "confirm" | "extra";

export function RecordBootstrapModal<T>(props: {
	config: RecordBootstrapConfig<T>;
	open: boolean;
	onOpenChange?: (open: boolean) => void;
	/** When false, the dialog cannot be closed by the user (escape/overlay). */
	dismissible?: boolean;
}): JSX.Element {
	// With no import source there's only one path, so skip the choice step and
	// drop the user straight into the from-scratch editor.
	const [step, setStep] = createSignal<Step>(
		props.config.importSource ? "choice" : "confirm",
	);
	const [path, setPath] = createSignal<string>(
		props.config.importSource ? IMPORT : SCRATCH,
	);
	const [value, setVal] = createSignal<T | undefined>(
		props.config.importSource ? undefined : props.config.scratch.initial(),
	);
	const [syncing, setSyncing] = createSignal(false);
	const [submitting, setSubmitting] = createSignal(false);

	const dismissible = () => props.dismissible !== false;

	const setValue = (patch: Partial<T>) =>
		setVal((prev) => ({ ...(prev as T), ...patch }) as T);

	const renderProps: RecordBootstrapRenderProps<T> = {
		get value() {
			return value() as T;
		},
		setValue,
		get syncing() {
			return syncing();
		},
	};

	const handleOpenChange = (open: boolean) => {
		// A non-dismissible dialog ignores user-initiated closes; only the flow
		// itself (after submit) drives `onOpenChange(false)`.
		if (!open && !dismissible()) return;
		props.onOpenChange?.(open);
	};

	const proceedFromChoice = async () => {
		const source = props.config.importSource;
		if (path() === IMPORT && source) {
			setStep("loading");
			try {
				const loaded = await source.load();
				setVal(() => loaded);
				setSyncing(source.supportsSync && source.defaultSync === true);
				setStep("confirm");
			} catch (err) {
				console.error("[RecordBootstrap] import failed", err);
				toast.error("Failed to load existing data.");
				setStep("choice");
			}
		} else {
			const initial = props.config.scratch.initial();
			setVal(() => initial);
			setSyncing(false);
			setStep("confirm");
		}
	};

	const save = async () => {
		const current = value();
		if (current === undefined) return;
		setSubmitting(true);
		try {
			await props.config.submit(current, {
				sync: path() === IMPORT && syncing(),
			});
			props.onOpenChange?.(false);
		} catch (err) {
			console.error("[RecordBootstrap] submit failed", err);
			toast.error("Failed to save.");
		} finally {
			setSubmitting(false);
		}
	};

	const showSyncToggle = () =>
		path() === IMPORT && props.config.importSource?.supportsSync === true;

	const footerStart = () => (
		<Show when={props.config.footerStart}>
			<div class="w-full [&>button]:w-full sm:[&>button]:w-fit sm:w-fit sm:mr-auto">
				{props.config.footerStart}
			</div>
		</Show>
	);

	const submitButton = () => (
		<Button onClick={save} disabled={submitting()}>
			<SwitchFlow>
				<Match when={submitting()}>
					<Spinner className="w-4 h-4 animate-spin" />
				</Match>
				<Match when={!submitting()}>{props.config.submitLabel ?? "Save"}</Match>
			</SwitchFlow>
		</Button>
	);

	return (
		<Dialog open={props.open} onOpenChange={handleOpenChange}>
			<DialogPortal>
				<DialogContent
					class="sm:max-w-2xl max-h-[calc(100svh-2rem)] overflow-auto"
					showCloseButton={dismissible()}
				>
					<DialogHeader>
						<h2 class="m-0 text-center">{props.config.title}</h2>
					</DialogHeader>
					<SwitchFlow>
						<Match when={step() === "choice"}>
							<div class="flex flex-row items-center justify-center w-full gap-4">
								<RadioGroup class="w-full" value={path()} onChange={setPath}>
									<RadioGroupItems class="w-full md:flex-row flex-col">
										<Show when={props.config.importSource}>
											{(source) => (
												<RadioGroupItem class="w-full md:flex-1" value={IMPORT}>
													<RadioGroupItemInput />
													<RadioGroupItemLabel class="flex w-full flex-col text-center text-pretty rounded-md p-2 border border-border outline-2 outline-transparent gap-2 data-checked:border-primary data-checked:outline-primary/50 data-checked:bg-primary/10">
														{source().card}
														<strong class="w-full text-lg">
															{source().label}
														</strong>
														<span class="font-normal">
															{source().description}
														</span>
													</RadioGroupItemLabel>
												</RadioGroupItem>
											)}
										</Show>
										<RadioGroupItem class="w-full md:flex-1" value={SCRATCH}>
											<RadioGroupItemInput />
											<RadioGroupItemLabel class="flex w-full flex-col text-center text-pretty rounded-md p-2 border border-border outline-2 outline-transparent gap-2 data-checked:border-primary data-checked:outline-primary/50 data-checked:bg-primary/10">
												{props.config.scratch.card}
												<strong class="w-full text-lg">
													{props.config.scratch.label}
												</strong>
												<span class="font-normal">
													{props.config.scratch.description}
												</span>
											</RadioGroupItemLabel>
										</RadioGroupItem>
									</RadioGroupItems>
								</RadioGroup>
							</div>
							<DialogFooter>
								{footerStart()}
								<Show when={dismissible()}>
									<Button
										variant="secondary"
										onClick={() => props.onOpenChange?.(false)}
									>
										Cancel
									</Button>
								</Show>
								<Button onClick={proceedFromChoice}>Next</Button>
							</DialogFooter>
						</Match>
						<Match when={step() === "loading"}>
							<div class="flex flex-col items-center justify-center gap-3 py-6">
								<Spinner className="w-8 h-8 animate-spin text-muted-foreground" />
								<span class="text-sm text-muted-foreground">
									Loading your data...
								</span>
							</div>
						</Match>
						<Match when={step() === "confirm" && value() !== undefined}>
							<div class="flex flex-col items-center justify-center w-full gap-4">
								{props.config.renderFields(renderProps)}
								<Show when={showSyncToggle()}>
									<Switch
										class="flex flex-row gap-4 items-center w-full justify-between"
										checked={syncing()}
										onChange={setSyncing}
									>
										<div>
											<SwitchLabel>
												{props.config.importSource?.syncLabel ?? "Keep in sync"}
											</SwitchLabel>
											<SwitchDescription>
												{props.config.importSource?.syncDescription ??
													"Automatically reflect future changes from the source."}
											</SwitchDescription>
										</div>
										<div>
											<SwitchInput />
											<SwitchControl>
												<SwitchThumb />
											</SwitchControl>
										</div>
									</Switch>
								</Show>
							</div>
							<DialogFooter>
								{footerStart()}
								<Show when={props.config.importSource}>
									<Button
										variant="secondary"
										disabled={submitting()}
										onClick={() => setStep("choice")}
									>
										Back
									</Button>
								</Show>
								<Show when={props.config.extraStep} fallback={submitButton()}>
									{(extra) => (
										<Button onClick={() => setStep("extra")}>
											{extra().nextLabel ?? "Next"}
										</Button>
									)}
								</Show>
							</DialogFooter>
						</Match>
						<Match when={step() === "extra" && value() !== undefined}>
							<div class="flex flex-col items-center justify-center w-full gap-4">
								{props.config.extraStep?.render(renderProps)}
							</div>
							<DialogFooter>
								{footerStart()}
								<Button
									variant="secondary"
									disabled={submitting()}
									onClick={() => setStep("confirm")}
								>
									Back
								</Button>
								{submitButton()}
							</DialogFooter>
						</Match>
					</SwitchFlow>
				</DialogContent>
			</DialogPortal>
		</Dialog>
	);
}
