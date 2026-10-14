import { ModalContent } from "@colibri-social/ui";
import { Match, Switch } from "solid-js";
import { JOIN_COPY, join } from "./join.contract";

export default join.view({
	omit: ["Header"] as const,
	render: ({ slots: s, model: m }) => (
		<ModalContent title={JOIN_COPY.title} class="md:w-[440px]">
			<div data-join="" class="-mx-4 -mb-4 flex flex-col">
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
		</ModalContent>
	),
});
