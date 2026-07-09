import { type Component, createSignal, Match, Switch } from "solid-js";
import ArrowLineLeftIcon from "~icons/ph/arrow-line-left";
import { getAppViewDid } from "../../utils/appview";
import { Button } from "../ui/Button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogPortal,
	DialogTitle,
} from "../ui/Dialog";
import { AppViewSwitcher } from "./settings/AppViewSwitcher";

export const AppViewUnreachableModal: Component = () => {
	const [step, setStep] = createSignal<"error" | "switch">("error");

	const appViewName = () =>
		getAppViewDid()
			.replace(/^did:web:/, "")
			.replace(/%3A/g, ":");

	return (
		<Dialog open onOpenChange={() => {}}>
			<DialogPortal>
				<DialogContent showCloseButton={false} class="sm:max-w-md">
					<Switch>
						<Match when={step() === "error"}>
							<DialogHeader>
								<DialogTitle>Unable to reach AppView</DialogTitle>
								<DialogDescription class="my-0">
									Colibri was unable to communicate with the server running at{" "}
									<span class="font-medium text-foreground">
										{appViewName()}
									</span>
									. Please check if the service is running. This may be a
									temporary outage.
								</DialogDescription>
							</DialogHeader>
							<DialogFooter>
								<Button variant="secondary" onClick={() => setStep("switch")}>
									Use different AppView
								</Button>
								<Button onClick={() => window.location.reload()}>Retry</Button>
							</DialogFooter>
						</Match>
						<Match when={step() === "switch"}>
							<DialogHeader>
								<div class="flex items-center gap-2">
									<Button
										variant="ghost"
										size="icon"
										aria-label="Back"
										onClick={() => setStep("error")}
									>
										<ArrowLineLeftIcon />
									</Button>
									<DialogTitle>Use a different AppView</DialogTitle>
								</div>
							</DialogHeader>
							<AppViewSwitcher description="Enter the URL of another Colibri AppView to connect to. We'll verify it's reachable, then sign you back in to authorise it." />
						</Match>
					</Switch>
				</DialogContent>
			</DialogPortal>
		</Dialog>
	);
};
