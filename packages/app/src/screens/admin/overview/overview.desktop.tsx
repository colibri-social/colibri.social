import { batch, createEffect, untrack } from "solid-js";
import type { AdminPage } from "../../../shell/layers";
import { useStack } from "../../../shell/stack";
import { AdminModalFrame } from "../desktop/modal-frame";
import { adminPageLabel } from "../desktop/page-labels";
import { useSpaceModal } from "../desktop/space-modal-context";
import { overview } from "./overview.contract";

export default overview.view({
	omit: ["Header"] as const,
	render: ({ slots: s, model: m, args }) => {
		const modal = useSpaceModal();
		const stack = useStack();
		const active = () => modal.pages()[0]?.page;
		const select = (page: AdminPage) => {
			const pages = modal.pages();
			if (pages.length === 1 && pages[0]?.page === page) return;
			const base = modal.baseDepth();
			stack.confirmLeave(base, () =>
				batch(() => {
					if (stack.depth() > base) {
						stack.popTo(base);
						if (stack.depth() > base) return;
					}
					stack.push({ kind: "admin", space: args.space, page });
				}),
			);
		};
		let opened = false;
		createEffect(() => {
			if (modal.pages().length > 0) {
				opened = true;
				return;
			}
			if (m.missing() || !m.community()) return;
			if (opened) {
				untrack(() => stack.popTo(modal.areaDepth()));
				return;
			}
			const first = m.sections()[0];
			if (!first) return;
			opened = true;
			untrack(() =>
				stack.push({ kind: "admin", space: args.space, page: first.page }),
			);
		});
		return (
			<>
				<AdminModalFrame
					pages={modal.pages()}
					baseDepth={modal.baseDepth()}
					fallbackTitle="Space settings"
					label={adminPageLabel}
					missing={m.missing()}
					missingView={<s.Missing />}
					sidebar={
						<>
							<s.Summary platform="desktop" />
							<s.Sections
								platform="desktop"
								active={active()}
								onSelect={select}
							/>
							<s.Developer />
							<s.Actions
								platform="desktop"
								active={active()}
								onSelect={select}
							/>
						</>
					}
				/>
				<s.DeleteDialog />
			</>
		);
	},
});
