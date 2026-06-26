import { type Component, createSignal, Match, Switch } from "solid-js";
import CheckIcon from "~icons/ph/check";
import CopyIcon from "~icons/ph/copy";
import { Button } from "../../ui/Button";
import {
	Tooltip,
	TooltipContent,
	TooltipPortal,
	TooltipTrigger,
} from "../../ui/Tooltip";

export const CopyButton: Component<{ value: string }> = (props) => {
	const [active, setActive] = createSignal(false);

	const copyToClipboard = () => {
		navigator.clipboard.writeText(props.value);
		setActive(true);
		setTimeout(() => setActive(false), 2000);
	};

	return (
		<Tooltip>
			<TooltipTrigger class="w-6 h-6 p-0">
				<Button
					size="sm"
					class="w-6 h-6 cursor-pointer"
					classList={{
						"text-green-500 hover:text-green-500": active(),
					}}
					variant="ghost"
					onClick={copyToClipboard}
				>
					<Switch>
						<Match when={active()}>
							<CheckIcon />
						</Match>
						<Match when={!active()}>
							<CopyIcon />
						</Match>
					</Switch>
				</Button>
			</TooltipTrigger>
			<TooltipPortal>
				<TooltipContent>
					<p
						class="m-0"
						classList={{
							"text-green-500": active(),
						}}
					>
						<Switch>
							<Match when={active()}>Copied!</Match>
							<Match when={!active()}>Copy to clipboard</Match>
						</Switch>
					</p>
				</TooltipContent>
			</TooltipPortal>
		</Tooltip>
	);
};
