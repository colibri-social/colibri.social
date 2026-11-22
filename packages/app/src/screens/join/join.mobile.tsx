import { Match, Switch } from "solid-js";
import { join } from "./join.contract";

export default join.view({
	render: ({ slots: s, model: m }) => (
		<div class="flex min-h-0 flex-1 flex-col bg-popover">
			<s.Header />
			<div
				data-scroll-y=""
				class="min-h-0 flex-1 overflow-y-auto overscroll-contain"
			>
				<div class="flex min-h-full flex-col pb-safe-offset-6">
					<Switch>
						<Match when={m.state() === "loading"}>
							<s.Loading />
						</Match>
						<Match when={m.state() === "problem"}>
							<s.Problem />
						</Match>
						<Match when={m.state() === "preview"}>
							<s.Preview />
						</Match>
					</Switch>
				</div>
			</div>
		</div>
	),
});
