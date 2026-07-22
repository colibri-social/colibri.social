import { type Component, createSignal, Match, onMount, Switch } from "solid-js";
import { isTauriRuntime } from "../../../notifications/environment";
import {
	getAppVersion,
	type InstallChannel,
	restartToApply,
	runUpdateCheck,
	upgradeCommandFor,
} from "../../../utils/updater";
import { Button } from "../../ui/Button";
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
	const [version, setVersion] = createSignal("");
	const [storeName, setStoreName] = createSignal("app store");
	const [status, setStatus] = createSignal<Status>("idle");
	const [updateVersion, setUpdateVersion] = createSignal("");
	const [updateChannel, setUpdateChannel] =
		createSignal<InstallChannel>("direct");
	const [errorMessage, setErrorMessage] = createSignal("");

	onMount(async () => {
		setVersion(await getAppVersion());
		setStoreName(await storeNameFor());
	});

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
		</SettingsPage>
	);
};
