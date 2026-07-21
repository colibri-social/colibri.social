import { type Component, onCleanup, onMount } from "solid-js";
import { toast } from "somoto";
import { isTauriRuntime } from "../../notifications/environment";
import {
	restartToApply,
	runUpdateCheck,
	upgradeCommandFor,
} from "../../utils/updater";

const CHECK_INTERVAL_MS = 5 * 60 * 60 * 1000;

const checkAndNotify = async () => {
	const result = await runUpdateCheck();
	if (result.status !== "update-available") return;

	if (result.channel !== "direct") {
		toast(`Colibri Social ${result.version} is available`, {
			description: `Run \`${upgradeCommandFor(result.channel)}\` to update.`,
			duration: 15000,
		});
		return;
	}

	try {
		await result.download();
	} catch (err) {
		console.error("[updater] download failed", err);
		return;
	}

	toast("Update ready", {
		description: `Colibri Social ${result.version} was downloaded. Restart to apply it.`,
		duration: Number.POSITIVE_INFINITY,
		action: {
			label: "Restart",
			onClick: () => void restartToApply(),
		},
	});
};

export const AutoUpdater: Component = () => {
	onMount(() => {
		if (!isTauriRuntime()) return;

		void checkAndNotify();
		const interval = setInterval(
			() => void checkAndNotify(),
			CHECK_INTERVAL_MS,
		);
		onCleanup(() => clearInterval(interval));
	});

	return null;
};
