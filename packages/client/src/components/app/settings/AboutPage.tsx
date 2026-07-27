import {
	type Component,
	createSignal,
	For,
	Match,
	onMount,
	Show,
	Switch,
} from "solid-js";
import { toast } from "somoto";
import CheckIcon from "~icons/ph/check";
import CopyIcon from "~icons/ph/copy";
import { useAuthContext } from "../../../contexts/Auth";
import { useSocketContext } from "../../../contexts/Socket";
import { useUserContext } from "../../../contexts/User";
import { useUserPreferences } from "../../../contexts/UserPreferences";
import { isTauriRuntime } from "../../../notifications/environment";
import {
	collectDiagnostics,
	type DiagnosticsSection,
	formatDiagnostics,
} from "../../../utils/diagnostics";
import {
	getAppVersion,
	type InstallChannel,
	restartToApply,
	runUpdateCheck,
	upgradeCommandFor,
} from "../../../utils/updater";
import { Button } from "../../ui/Button";
import { Separator } from "../../ui/Separator";
import { SettingsPage } from "../common/SettingsModal";

type Status =
	| "idle"
	| "checking"
	| "up-to-date"
	| "unsupported"
	| "error"
	| "available"
	| "downloading"
	| "ready";

const storeNameFor = async (): Promise<string> => {
	try {
		const { platform } = await import("@tauri-apps/plugin-os");
		switch (platform()) {
			case "macos":
				return "Mac App Store";
			case "ios":
				return "App Store";
			case "android":
				return "Google Play";
			case "windows":
				return "Microsoft Store";
			default:
				return "app store";
		}
	} catch {
		return "app store";
	}
};

export const AboutPage: Component = () => {
	const user = useUserContext();
	const auth = useAuthContext();
	const socket = useSocketContext();
	const { preferences } = useUserPreferences();

	const [version, setVersion] = createSignal("");
	const [storeName, setStoreName] = createSignal("app store");
	const [status, setStatus] = createSignal<Status>("idle");
	const [updateVersion, setUpdateVersion] = createSignal("");
	const [updateChannel, setUpdateChannel] =
		createSignal<InstallChannel>("direct");
	const [errorMessage, setErrorMessage] = createSignal("");

	const [diagnostics, setDiagnostics] = createSignal<Array<DiagnosticsSection>>(
		[],
	);
	const [copied, setCopied] = createSignal(false);

	onMount(async () => {
		setVersion(await getAppVersion());
		setStoreName(await storeNameFor());
		setDiagnostics(
			await collectDiagnostics({
				did: user.did,
				handle: user.handle,
				pdsHost: user.atproto.pdsHost,
				grantedScopes: auth?.loggedIn ? auth.grantedScopes : undefined,
				socketStatus: socket.status(),
				nativeNotifications: preferences().nativeNotifications,
				experiments: preferences().experiments,
			}),
		);
	});

	const copyDiagnostics = async () => {
		try {
			await navigator.clipboard.writeText(formatDiagnostics(diagnostics()));
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			toast.error("Failed to copy debug information.");
		}
	};

	const check = async () => {
		setStatus("checking");
		const result = await runUpdateCheck();

		if (result.status === "unsupported") {
			setStatus("unsupported");
			return;
		}
		if (result.status === "up-to-date") {
			setStatus("up-to-date");
			return;
		}
		if (result.status === "error") {
			setErrorMessage(result.message);
			setStatus("error");
			return;
		}

		setUpdateVersion(result.version);
		setUpdateChannel(result.channel);

		if (result.channel !== "direct") {
			setStatus("available");
			return;
		}

		setStatus("downloading");
		try {
			await result.download();
			setStatus("ready");
		} catch (err) {
			setErrorMessage(err instanceof Error ? err.message : String(err));
			setStatus("error");
		}
	};

	return (
		<SettingsPage loading={() => false} title="About">
			<div class="flex flex-col gap-1">
				<span class="text-sm font-medium">Colibri Social</span>
				<span class="text-sm text-muted-foreground">
					{isTauriRuntime() ? `Version ${version()}` : "Web"}
				</span>
			</div>

			<Switch>
				<Match when={!isTauriRuntime()}>
					<span class="text-sm text-muted-foreground">
						Updates are applied automatically.
					</span>
				</Match>
				<Match when={status() === "unsupported"}>
					<span class="text-sm text-muted-foreground">
						Updates are managed automatically by the {storeName()}.
					</span>
				</Match>
				<Match when={status() === "available"}>
					<div class="flex flex-col gap-2">
						<span class="text-sm text-muted-foreground">
							Colibri Social {updateVersion()} is available — run{" "}
							<code>{upgradeCommandFor(updateChannel())}</code> to update.
						</span>
					</div>
				</Match>
				<Match when={status() === "ready"}>
					<div class="flex flex-col gap-2">
						<span class="text-sm text-muted-foreground">
							Colibri Social {updateVersion()} was downloaded.
						</span>
						<Button onClick={() => void restartToApply()}>
							Restart to update
						</Button>
					</div>
				</Match>
				<Match when={true}>
					<div class="flex flex-col gap-2">
						<Switch>
							<Match when={status() === "downloading"}>
								<span class="text-sm text-muted-foreground">
									Downloading update…
								</span>
							</Match>
							<Match when={status() === "up-to-date"}>
								<span class="text-sm text-muted-foreground">
									You're up to date.
								</span>
							</Match>
							<Match when={status() === "error"}>
								<span class="text-sm text-destructive">
									Couldn't check for updates: {errorMessage()}
								</span>
							</Match>
						</Switch>
						<Button
							variant="secondary"
							onClick={() => void check()}
							disabled={status() === "checking" || status() === "downloading"}
						>
							{status() === "checking" ? "Checking…" : "Check for Updates"}
						</Button>
					</div>
				</Match>
			</Switch>

			<Separator class="my-2" />

			<div class="flex flex-col gap-3">
				<div class="flex flex-row flex-wrap items-center justify-between gap-4">
					<div class="flex flex-col gap-1">
						<span class="text-sm font-medium">Debug information</span>
						<span class="text-sm text-muted-foreground">
							Include this when reporting a problem.
						</span>
					</div>
					<Button
						variant="secondary"
						onClick={() => void copyDiagnostics()}
						disabled={diagnostics().length === 0}
					>
						<Switch>
							<Match when={copied()}>
								<CheckIcon class="text-green-500" />
								Copied
							</Match>
							<Match when={!copied()}>
								<CopyIcon />
								Copy debug information
							</Match>
						</Switch>
					</Button>
				</div>

				<Show
					when={diagnostics().length > 0}
					fallback={
						<span class="text-sm text-muted-foreground">Gathering…</span>
					}
				>
					<div class="flex flex-col gap-3">
						<For each={diagnostics()}>
							{(section) => (
								<div class="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
									<span class="text-sm font-semibold">{section.title}</span>
									<div class="flex flex-col gap-2.5">
										<For each={section.fields}>
											{(field) => (
												<div class="flex flex-col gap-0.5">
													<span class="text-xs text-muted-foreground">
														{field.label}
													</span>
													<Switch>
														<Match when={field.kind === "value" && field}>
															{(f) => (
																<code class="text-xs break-all leading-relaxed line-clamp-3">
																	{f().value}
																</code>
															)}
														</Match>
														<Match when={field.kind === "list" && field}>
															{(f) => (
																<Show
																	when={f().items.length > 0}
																	fallback={<span class="text-xs">None</span>}
																>
																	<ul class="flex flex-col gap-0.5 list-disc pl-4">
																		<For each={f().items}>
																			{(item) => (
																				<li class="text-xs">{item}</li>
																			)}
																		</For>
																	</ul>
																</Show>
															)}
														</Match>
													</Switch>
												</div>
											)}
										</For>
									</div>
								</div>
							)}
						</For>
					</div>
				</Show>
			</div>
		</SettingsPage>
	);
};
