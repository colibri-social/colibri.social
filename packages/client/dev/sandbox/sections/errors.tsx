import { createSignal, For, Show } from "solid-js";
import { ErrorDetails } from "../../../src/components/ErrorDetails";
import { ErrorState } from "../../../src/components/ErrorState";
import { SectionBoundary } from "../../../src/components/SectionBoundary";
import { Button } from "../../../src/components/ui/Button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "../../../src/components/ui/Table";
import {
	Tabs,
	TabsContent,
	TabsIndicator,
	TabsList,
	TabsTrigger,
} from "../../../src/components/ui/Tabs";
import {
	TextField,
	TextFieldErrorMessage,
	TextFieldInput,
	TextFieldLabel,
} from "../../../src/components/ui/TextField";
import { setReportingAccount } from "../../../src/errors/account";
import { classifyResponse, classifyThrown } from "../../../src/errors/classify";
import {
	ALL_ERROR_CODES,
	type ColibriErrorCode,
} from "../../../src/errors/codes";
import { copyForCode, describeError } from "../../../src/errors/copy";
import { markReportDelivered } from "../../../src/errors/delivery";
import { ColibriError } from "../../../src/errors/error";
import { showError } from "../../../src/errors/show-error";
import { createLogger, formatLog, resetLog } from "../../../src/utils/logger";
import { Demo } from "../helpers";
import type { SandboxCategory } from "../types";

const log = createLogger("sandbox");

const FAKE_EVENT_ID = "4f1c2b9a7e5d40b1a1c3e7f9d2b48c60";

markReportDelivered(FAKE_EVENT_ID);

setReportingAccount({ did: "did:plc:sandboxaccount", optedIn: false });

const errorFor = (code: ColibriErrorCode): ColibriError =>
	new ColibriError({
		code,
		method: "social.colibri.community.getData",
		serverMessage: "the sandbox made this up",
	});

const CopyCatalog = () => (
	<div class="flex flex-col gap-3">
		<h2 class="m-0 text-lg font-bold">Every error, and what it says</h2>
		<p class="m-0 text-sm text-muted-foreground">
			{ALL_ERROR_CODES.length} codes. A row whose title is "Something went
			wrong." has no curated copy and is a bug.
		</p>
		<div class="overflow-x-auto">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Code</TableHead>
						<TableHead>Domain</TableHead>
						<TableHead>Retry</TableHead>
						<TableHead>Title</TableHead>
						<TableHead>Description</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					<For each={[...ALL_ERROR_CODES]}>
						{(code) => {
							const failure = errorFor(code);
							const copy = copyForCode(code);
							return (
								<TableRow>
									<TableCell class="font-mono text-xs">{code}</TableCell>
									<TableCell class="text-xs">{failure.domain}</TableCell>
									<TableCell class="text-xs">
										{failure.retryable ? "yes" : "no"}
									</TableCell>
									<TableCell class="text-xs">{copy.title}</TableCell>
									<TableCell class="text-xs text-muted-foreground">
										{copy.description ?? "—"}
									</TableCell>
								</TableRow>
							);
						}}
					</For>
				</TableBody>
			</Table>
		</div>
	</div>
);

const TOAST_CASES: Array<{ label: string; error: unknown }> = [
	{ label: "Forbidden (no retry)", error: errorFor("Forbidden") },
	{ label: "RateLimited (retryable)", error: errorFor("RateLimited") },
	{ label: "Offline", error: errorFor("Offline") },
	{ label: "PdsUnavailable", error: errorFor("PdsUnavailable") },
	{
		label: "Validation with a field message",
		error: classifyResponse({
			status: 400,
			body: JSON.stringify({
				error: "InvalidRequest",
				message:
					'Failed to validate: [{"path":["name"],"message":"Name is required."}]',
			}),
			method: "social.colibri.community.create",
		}),
	},
	{ label: "Raw thrown Error", error: new Error("some internal detail") },
	{ label: "Thrown string", error: "canceled" },
];

const Toasts = () => (
	<div class="flex flex-col gap-3">
		<h2 class="m-0 text-lg font-bold">Toasts</h2>
		<p class="m-0 text-sm text-muted-foreground">
			Transient failures. A Retry button appears only when the error is
			retryable, even though every call passes one.
		</p>
		<Demo label="showError">
			<For each={TOAST_CASES}>
				{(entry) => (
					<Button
						variant="secondary"
						size="sm"
						onClick={() =>
							showError(entry.error, {
								retry: () => log.info("retry pressed", { case: entry.label }),
							})
						}
					>
						{entry.label}
					</Button>
				)}
			</For>
		</Demo>
	</div>
);

const INLINE_CASES: ReadonlyArray<ColibriErrorCode> = [
	"UpstreamFailure",
	"NotFound",
	"Forbidden",
	"NetworkFailed",
];

const Inline = () => (
	<div class="flex flex-col gap-3">
		<h2 class="m-0 text-lg font-bold">Inline error state</h2>
		<p class="m-0 text-sm text-muted-foreground">
			What a panel shows instead of rendering blank. Retry only appears for a
			retryable code. Expand Details to see the reference and the optional "Send
			my account".
		</p>
		<Tabs defaultValue={INLINE_CASES[0]} class="w-full">
			<TabsList class="w-full">
				<For each={[...INLINE_CASES]}>
					{(entry) => <TabsTrigger value={entry}>{entry}</TabsTrigger>}
				</For>
				<TabsIndicator />
			</TabsList>
			<For each={[...INLINE_CASES]}>
				{(entry) => (
					<TabsContent value={entry} class="pt-3">
						<div class="rounded-lg border">
							<ErrorState
								error={errorFor(entry)}
								eventId={FAKE_EVENT_ID}
								retry={() => log.info("inline retry pressed", { code: entry })}
							/>
						</div>
					</TabsContent>
				)}
			</For>
		</Tabs>
		<Demo label="compact (used inside embeds)">
			<div class="rounded-lg border w-full max-w-sm">
				<ErrorState error={errorFor("UpstreamFailure")} compact />
			</div>
		</Demo>
	</div>
);

const Crash = (props: { onCrash: () => void }) => {
	queueMicrotask(props.onCrash);
	throw new Error("the sandbox threw while rendering");
};

const Boundary = () => {
	const [armed, setArmed] = createSignal(false);
	const [crashes, setCrashes] = createSignal(0);

	return (
		<div class="flex flex-col gap-3">
			<h2 class="m-0 text-lg font-bold">Contained crash</h2>
			<p class="m-0 text-sm text-muted-foreground">
				Throws while rendering inside a SectionBoundary. Only the bordered box
				below is replaced; everything else on this page keeps working, which is
				the whole point. Press Try again in the box to recover.
			</p>
			<Demo label="SectionBoundary">
				<Button
					variant="destructive"
					size="sm"
					onClick={() => {
						setCrashes((n) => n + 1);
						setArmed(true);
					}}
				>
					Throw while rendering
				</Button>
				<span class="text-xs text-muted-foreground">
					crashed {crashes()} time(s)
				</span>
			</Demo>
			<div class="rounded-lg border p-4">
				<SectionBoundary name="sandbox">
					<Show
						when={armed()}
						fallback={
							<p class="m-0 text-sm text-muted-foreground">
								This subtree is fine.
							</p>
						}
					>
						<Crash onCrash={() => setArmed(false)} />
					</Show>
				</SectionBoundary>
			</div>
		</div>
	);
};

const Details = () => (
	<div class="flex flex-col gap-3">
		<h2 class="m-0 text-lg font-bold">Details disclosure</h2>
		<p class="m-0 text-sm text-muted-foreground">
			The block the full-screen crash surface shows. Copy puts the code and
			reference on the clipboard; "Send my account" is the opt-in.
		</p>
		<div class="rounded-lg border p-4">
			<ErrorDetails code="InternalError" eventId={FAKE_EVENT_ID} />
		</div>
	</div>
);

const Fields = () => {
	const failure = classifyResponse({
		status: 400,
		body: JSON.stringify({
			error: "InvalidRequest",
			message:
				'Failed to validate: [{"path":["name"],"message":"Name is required."}]',
		}),
	});

	return (
		<div class="flex flex-col gap-3">
			<h2 class="m-0 text-lg font-bold">Field-level errors</h2>
			<p class="m-0 text-sm text-muted-foreground">
				Pulled out of the AppView's "Failed to validate" message rather than
				collapsed into one generic toast.
			</p>
			<TextField validationState="invalid" class="max-w-sm">
				<TextFieldLabel>Community name</TextFieldLabel>
				<TextFieldInput value="" />
				<TextFieldErrorMessage errors={failure.fields} />
			</TextField>
			<pre class="m-0 text-xs font-mono whitespace-pre-wrap">
				{JSON.stringify(failure.fields, null, 2)}
			</pre>
		</div>
	);
};

const Classification = () => {
	const cases = [
		["502 with no body", classifyResponse({ status: 502, body: "" })],
		[
			"403 with a declared code",
			classifyResponse({
				status: 403,
				body: JSON.stringify({ error: "Forbidden", message: "nope" }),
			}),
		],
		[
			"429 with Retry-After",
			classifyResponse({ status: 429, body: "", retryAfter: "30" }),
		],
		["fetch TypeError", classifyThrown(new TypeError("Failed to fetch"))],
		["thrown string", classifyThrown("canceled")],
	] as const;

	return (
		<div class="flex flex-col gap-3">
			<h2 class="m-0 text-lg font-bold">Classification</h2>
			<p class="m-0 text-sm text-muted-foreground">
				What the wire turns into. This is what every XRPC wrapper now returns.
			</p>
			<div class="overflow-x-auto">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Input</TableHead>
							<TableHead>Code</TableHead>
							<TableHead>Retry</TableHead>
							<TableHead>Retry after</TableHead>
							<TableHead>Shown as</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						<For each={[...cases]}>
							{([label, failure]) => (
								<TableRow>
									<TableCell class="text-xs">{label}</TableCell>
									<TableCell class="font-mono text-xs">
										{failure.code}
									</TableCell>
									<TableCell class="text-xs">
										{failure.retryable ? "yes" : "no"}
									</TableCell>
									<TableCell class="text-xs">
										{failure.retryAfterMs ?? "-"}
									</TableCell>
									<TableCell class="text-xs">
										{describeError(failure).title}
									</TableCell>
								</TableRow>
							)}
						</For>
					</TableBody>
				</Table>
			</div>
		</div>
	);
};

const Logging = () => {
	const [dump, setDump] = createSignal<string>("");

	const emitAll = () => {
		const scoped = createLogger("sandbox/demo");
		scoped.debug("a debug line", { detail: "only shown at debug level" });
		scoped.info("an info line", { count: 3 });
		scoped.warn("a warning line", { status: 429 });
		scoped.error("an error line", { error: new TypeError("Failed to fetch") });
		scoped.child("nested").info("a child scope line");
		scoped.info("redaction: token eyJhbG.eyJzdWI.sig and a@b.com", {
			accessToken: "supersecret",
			nested: { password: "hunter2", keep: 1 },
		});
	};

	return (
		<div class="flex flex-col gap-3">
			<h2 class="m-0 text-lg font-bold">Logging</h2>
			<p class="m-0 text-sm text-muted-foreground">
				Open devtools before pressing this. Every level prints once, scoped and
				coloured. The last line proves redaction: the token, the email, the
				accessToken and the nested password are all replaced.
			</p>
			<Demo label="emit">
				<Button variant="secondary" size="sm" onClick={emitAll}>
					Log one of every level
				</Button>
				<Button
					variant="secondary"
					size="sm"
					onClick={() => setDump(formatLog(40))}
				>
					Show the buffer
				</Button>
				<Button
					variant="secondary"
					size="sm"
					onClick={() => {
						resetLog();
						setDump("");
					}}
				>
					Reset
				</Button>
			</Demo>
			<Show when={dump()}>
				<pre class="m-0 max-h-80 overflow-auto rounded-lg border p-3 text-[11px] font-mono whitespace-pre-wrap">
					{dump()}
				</pre>
			</Show>
			<p class="m-0 text-xs text-muted-foreground">
				The same buffer is on <code>window.__colibriLog</code>: try{" "}
				<code>__colibriLog.dump()</code> or <code>__colibriLog.entries()</code>.
			</p>
		</div>
	);
};

const ErrorsGallery = () => (
	<div class="flex flex-col gap-10">
		<Toasts />
		<Inline />
		<Details />
		<Boundary />
		<Fields />
		<Classification />
		<Logging />
		<CopyCatalog />
	</div>
);

export const ERRORS: SandboxCategory = {
	id: "errors",
	title: "Errors",
	items: [
		{ id: "errors", title: "Errors & logging", component: ErrorsGallery },
	],
};
