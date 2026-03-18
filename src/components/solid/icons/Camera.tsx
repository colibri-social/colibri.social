import { Match, Switch, type Component } from "solid-js";

export const Camera: Component<{
	className?: string;
	size?: number;
	enabled: boolean;
}> = (props) => (
	<Switch>
		<Match when={props.enabled === true}>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width={props.size || 32}
				height={props.size || 32}
				fill="currentColor"
				viewBox="0 0 256 256"
				aria-hidden="true"
				class={props.className}
			>
				<path d="M251.77,73a8,8,0,0,0-8.21.39L208,97.05V72a16,16,0,0,0-16-16H32A16,16,0,0,0,16,72V184a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V159l35.56,23.71A8,8,0,0,0,248,184a8,8,0,0,0,8-8V80A8,8,0,0,0,251.77,73ZM192,184H32V72H192V184Zm48-22.95-32-21.33V116.28L240,95Z"></path>
			</svg>
		</Match>
		<Match when={props.enabled === false}>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width={props.size || 32}
				height={props.size || 32}
				fill="currentColor"
				viewBox="0 0 256 256"
				aria-hidden="true"
				class={props.className}
			>
				<path d="M251.77,73a8,8,0,0,0-8.21.39L208,97.05V72a16,16,0,0,0-16-16H113.06a8,8,0,0,0,0,16H192v87.63a8,8,0,0,0,16,0V159l35.56,23.71A8,8,0,0,0,248,184a8,8,0,0,0,8-8V80A8,8,0,0,0,251.77,73ZM240,161.05l-32-21.33V116.28L240,95ZM53.92,34.62A8,8,0,1,0,42.08,45.38L51.73,56H32A16,16,0,0,0,16,72V184a16,16,0,0,0,16,16H182.64l19.44,21.38a8,8,0,1,0,11.84-10.76ZM32,184V72H66.28L168.1,184Z"></path>
			</svg>
		</Match>
	</Switch>
);
