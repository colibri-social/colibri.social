import { classifyThrown, createLogger } from "@colibri-social/lib";
import {
	type HostCheckState,
	HostMove,
	type HostMoveStep,
	pdsMooverUrl,
	StatusScreen,
	toast,
} from "@colibri-social/ui";
import { DangerTriangleIcon } from "@solar-icons/solid/bold/danger-triangle";
import { createMemo, createSignal, onCleanup, Show } from "solid-js";
import { isNativeShell } from "../../../auth/native";
import { communityHostingFor } from "../../../data/community-hosting";
import { describeError } from "../../../data/error-copy";
import { checkSpacesSupport } from "../../../data/host-check";
import { HostSignInError, prepareExternalTab } from "../../../data/hosting";
import { openExternalUrl } from "../../../native/open-external";
import { defineContract, slot } from "../../../screen/define";
import { HOST_MOVE_ENABLED } from "../../../shell/features";
import type { AdminArgs } from "../../../shell/registry";
import { useStack } from "../../../shell/stack";
import { AdminNavHeader } from "../desktop/page-header";
import { signInFailureCopy } from "../hosting/host-sign-in";
import { useAdminSpace } from "../space-admin";

const log = createLogger("admin-hosting-move");

export const spaceHostingMove = defineContract({
	id: "adminHostingMove",
	model: (args: AdminArgs) => {
		const stack = useStack();
		const admin = useAdminSpace(args.space);
		const { data, community } = admin;
		const hosting = communityHostingFor(data.source);
		const allowed = () => HOST_MOVE_ENABLED && !!community()?.viewer.isOwner;
		const view = createMemo(() => {
			const current = community();
			return current && allowed() ? hosting.get(current.did)() : undefined;
		});
		const [localStep, setLocalStep] = createSignal<HostMoveStep>(1);
		const [server, setServer] = createSignal("");
		const [check, setCheck] = createSignal<HostCheckState>("idle");
		const [email, setEmail] = createSignal("");
		const [password, setPassword] = createSignal<string>();
		const [expiresAt, setExpiresAt] = createSignal<number>();
		const [reconnecting, setReconnecting] = createSignal(false);
		let waiting: AbortController | undefined;
		onCleanup(() => waiting?.abort());

		const step = (): HostMoveStep => {
			const hosted = view();
			const local = localStep();
			if (hosted?.kind === "own" && !hosted.needsSignIn) return 5;
			if (hosted?.needsSignIn && local !== 5) return 4;
			if (
				hosted?.handOverExpiresAt &&
				Date.parse(hosted.handOverExpiresAt) > Date.now() &&
				(local === 1 || local === 2)
			) {
				return 3;
			}
			return local;
		};

		const runCheck = async () => {
			if (!server().trim()) return;
			setCheck("checking");
			try {
				setCheck(
					(await checkSpacesSupport(server())) ? "supported" : "unsupported",
				);
			} catch {
				setCheck("unsupported");
			}
		};

		const handOver = async () => {
			const current = community();
			if (!current) return;
			try {
				const result = await hosting.handOver({
					community: current.did,
					email: email().trim(),
				});
				setPassword(result.password);
				setExpiresAt(Date.parse(result.expiresAt));
				setLocalStep(3);
			} catch (error) {
				log.warn("hand-over failed", { code: classifyThrown(error).code });
				const copy = describeError(error);
				toast.error(copy.title, { description: copy.description });
				throw error;
			}
		};

		const reconnect = async () => {
			const current = community();
			const hosted = view();
			if (!current || !hosted) return;
			const tab = prepareExternalTab(openExternalUrl, isNativeShell());
			waiting?.abort();
			const controller = new AbortController();
			waiting = controller;
			setReconnecting(true);
			try {
				await hosting.reconnect({
					community: current.did,
					identifier: hosted.account,
					tab,
					signal: controller.signal,
				});
				setLocalStep(5);
			} catch (error) {
				if (controller.signal.aborted) return;
				tab.close();
				if (error instanceof HostSignInError) {
					const copy = signInFailureCopy(error, hosted.account);
					toast.error(copy.title, { description: copy.description });
					return;
				}
				const copy = describeError(error);
				toast.error(copy.title, { description: copy.description });
			} finally {
				if (waiting === controller) setReconnecting(false);
			}
		};

		return {
			...admin,
			back: () => stack.pop(),
			allowed,
			view,
			step,
			server,
			setServer: (value: string) => {
				setServer(value);
				setCheck("idle");
			},
			check,
			runCheck,
			continueToKeys: () => setLocalStep(2),
			changeServer: () => {
				setLocalStep(1);
				setCheck("idle");
				setPassword(undefined);
				setExpiresAt(undefined);
			},
			email,
			setEmail,
			password,
			expiresAt,
			handOver,
			restartHandOver: () => {
				setPassword(undefined);
				setExpiresAt(undefined);
				setLocalStep(2);
			},
			openMoover: () => openExternalUrl(pdsMooverUrl(server())),
			moved: () => {
				const current = community();
				setLocalStep(4);
				if (current) void hosting.refresh(current.did);
			},
			reconnecting,
			reconnect,
		};
	},
	slots: {
		Header: slot((m) => (
			<AdminNavHeader
				safeTop
				kind="back"
				onNavigate={m.back}
				title="Move to another server"
			/>
		)),
		Missing: slot((m) => (
			<Show
				when={m.missing()}
				fallback={
					<StatusScreen
						tone="neutral"
						icon={<DangerTriangleIcon />}
						title="Moving Spaces isn't available yet"
						description="Your Space stays where it is for now."
					/>
				}
			>
				<StatusScreen
					tone="destructive"
					icon={<DangerTriangleIcon />}
					title="This Space isn't available"
					description="It may have been deleted, or you're no longer a member."
				/>
			</Show>
		)),
		Intro: slot((m) => (
			<p class="m-0 text-sm text-muted-foreground leading-prose">
				{m.community()?.name ?? "Your Space"} keeps its members, channels and
				history. You'll use PDS MOOver, a free tool, to copy the account.
				Colibri helps before and after.
			</p>
		)),
		Steps: slot((m) => (
			<HostMove
				spaceName={m.community()?.name ?? "This Space"}
				account={m.view()?.account ?? ""}
				step={m.step()}
				server={m.server()}
				onServerChange={m.setServer}
				check={m.check()}
				onCheck={() => void m.runCheck()}
				onContinue={m.continueToKeys}
				onChangeServer={m.changeServer}
				email={m.email()}
				onEmailChange={m.setEmail}
				password={m.password()}
				passwordExpiresAt={m.expiresAt()}
				onHandOver={m.handOver}
				onRestartHandOver={m.restartHandOver}
				onOpenMoover={m.openMoover}
				onMoved={m.moved}
				reconnectBusy={m.reconnecting()}
				onReconnect={() => void m.reconnect()}
				restoreAvailable={false}
				onBackToHosting={m.back}
			/>
		)),
	},
});
