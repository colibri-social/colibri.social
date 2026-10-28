export type ContributorEntry = {
	name: string;
	handle?: string;
	did?: string;
	role?: string;
};

const ENTRIES: readonly ContributorEntry[] = [
	{
		name: "Louis Escher",
		handle: "lou.gg",
		did: "did:plc:w64dlsa4zwjv2wljlvmymldc",
		role: "Core Maintainer",
	},
	{
		name: "Reuben Tier",
		handle: "otterlord.dev",
		did: "did:plc:dfpvdx5gjxeqtrye4jj76unc",
		role: "Core Maintainer",
	},
	{
		name: "Felix Schneider",
		handle: "felixs.dev",
		did: "did:plc:pbjvqaziagcyv2vqodldn5op",
	},
	{
		name: "Roman",
		handle: "rman.dev",
		did: "did:plc:kv4anwhiuzuljtxqjkzoll6v",
	},
	{
		name: "José Miguel",
		handle: "omixann.me",
		did: "did:plc:l4sh3guti7k2mzcn2gzox2vy",
	},
	{
		name: "Matthew Justice",
	},
	{
		name: "Kyanoxia",
		handle: "kyanoxia.com",
		did: "did:plc:cocpebhxzqhh2vxsp4ivzdbr",
		role: "Sounds, Graphics",
	},
];

export const CONTRIBUTORS: readonly ContributorEntry[] = [...ENTRIES].sort(
	(a, b) => a.name.localeCompare(b.name),
);
