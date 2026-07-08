import type { BrowserOAuthClient } from "@atproto/oauth-client-browser";
import { createSignal, For } from "solid-js";
import { toast } from "somoto";
import ArrowLineLeftIcon from "~icons/ph/arrow-line-left";
import { buildScopes, scopeSetLabel } from "../../../atproto/scopes";
import { endSession } from "../../../atproto/session";
import { getAppViewDid } from "../../../utils/appview";
import { Spinner } from "../../icons/Spinner";
import { Button } from "../../ui/Button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogPortal,
	DialogTitle,
} from "../../ui/Dialog";
import { SCOPE_REAUTH_FLAG } from "./scope-reauth";

export function ScopeRefreshModal(props: {
	client: BrowserOAuthClient;
	did: string;
	missing: string[];
}) {
	const [loading, setLoading] = createSignal(false);

	const labels = () => [...new Set(props.missing.map(scopeSetLabel))];

	const refresh = async () => {
		if (loading()) return;
		setLoading(true);
		try {
			sessionStorage.setItem(SCOPE_REAUTH_FLAG, "1");
			await props.client.signIn(props.did, {
				signal: new AbortController().signal,
				scope: buildScopes(getAppViewDid()).join(" "),
			});
		} catch (err) {
			sessionStorage.removeItem(SCOPE_REAUTH_FLAG);
			console.error(err);
			toast.error(err as any);
			setLoading(false);
		}
	};

	const logout = async () => {
		if (loading()) return;
		try {
			await props.client.revoke(props.did);
		} finally {
			await endSession();
		}
	};

	return (
		<Dialog open onOpenChange={() => {}}>
			<DialogPortal>
				<DialogContent showCloseButton={false} class="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>New permissions needed</DialogTitle>
						<DialogDescription class="my-0">
							We've added functionality that needs a few extra permissions on
							your account. Grant them to keep using Colibri.
						</DialogDescription>
					</DialogHeader>
					<ul class="flex flex-col gap-2 m-0 p-0 list-none">
						<For each={labels()}>
							{(label) => (
								<li class="flex items-center gap-2 text-sm my-0.5">
									<span class="size-1.5 rounded-full bg-primary shrink-0" />
									{label}
								</li>
							)}
						</For>
					</ul>
					<DialogFooter>
						<div class="w-full [&>button]:w-full sm:[&>button]:w-fit sm:w-fit sm:mr-auto">
							<Button variant="ghost" onClick={logout} disabled={loading()}>
								<ArrowLineLeftIcon />
								Log out
							</Button>
						</div>
						<Button
							class="aria-busy:[&_svg]:flex! aria-busy:[&>span]:hidden"
							aria-busy={loading()}
							onClick={refresh}
						>
							<Spinner className="hidden" />
							<span>Continue</span>
						</Button>
					</DialogFooter>
				</DialogContent>
			</DialogPortal>
		</Dialog>
	);
}
