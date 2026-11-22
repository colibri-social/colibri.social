import { MentionCircleIcon } from "@solar-icons/solid/bold/mention-circle";
import { UsersGroupRoundedIcon } from "@solar-icons/solid/bold/users-group-rounded";
import { Chip } from "../Badge/Badge";

const memberFormat = new Intl.NumberFormat("en");

export const formatMemberCount = (count: number) =>
	`${memberFormat.format(count)} ${count === 1 ? "member" : "members"}`;

export const MemberCountChip = (props: {
	count: number;
	label?: string;
	id?: string;
}) => (
	<Chip id={props.id} icon={<UsersGroupRoundedIcon />}>
		{props.label ?? formatMemberCount(props.count)}
	</Chip>
);

export const OwnerChip = (props: {
	handle: string;
	short?: boolean;
	class?: string;
}) => {
	const handle = () => `@${props.handle.replace(/^@/, "")}`;
	return (
		<Chip
			icon={<MentionCircleIcon />}
			data-owner-chip=""
			tooltip={props.short ? `Owner ${handle()}` : undefined}
			class={props.class}
		>
			{props.short ? (
				<>
					<span class="sr-only">Owner </span>
					{handle()}
				</>
			) : (
				`By ${handle()}`
			)}
		</Chip>
	);
};
