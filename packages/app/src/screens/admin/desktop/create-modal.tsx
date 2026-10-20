import { Show } from "solid-js";
import type { ModalAreaProps } from "../../../shell/desktop/modal-areas";
import { type AdminLayer, layerPath } from "../../../shell/layers";
import { AdminScreen } from "../../../shell/registry";

export default function CreateModal(props: ModalAreaProps) {
	const root = () => props.layers[0] as AdminLayer;
	return (
		<Show when={layerPath(root())} keyed>
			{(_path) => (
				<AdminScreen
					page={root().page}
					args={{ space: root().space, id: root().id }}
				/>
			)}
		</Show>
	);
}
